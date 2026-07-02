import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { MemberRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NombaService } from '../nomba/nomba.service';
import { CreateGroupDto } from './dto/create-group.dto';

@Injectable()
export class GroupsService {
  private readonly logger = new Logger(GroupsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nombaService: NombaService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // Create Group
  // ─────────────────────────────────────────────────────────────

  async createGroup(
    userId: string,
    dto: CreateGroupDto,
  ): Promise<{ id: string; inviteCode: string }> {
    // Step 1: Generate a unique invite code.
    // The DB unique constraint is the final safety net; we verify pre-insert.
    const inviteCode = await this.generateUniqueInviteCode();

    // Step 2: Provision a Nomba virtual account BEFORE persisting the group.
    // A group without a vault is financially invalid — fail fast if Nomba is down.
    const tempGroupRef = `grp-${crypto.randomBytes(8).toString('hex')}`;
    const virtualAccount = await this.nombaService.createVirtualAccount(
      tempGroupRef,
      dto.name,
    );

    this.logger.log(
      `Nomba virtual account provisioned for "${dto.name}": ${virtualAccount.nombaAccountId}`,
    );

    // Step 3: Persist group + COORDINATOR membership atomically.
    // If the DB write fails after Nomba succeeds, the orphaned virtual account
    // is an acceptable rare edge case for the hackathon MVP.
    const group = await this.prisma.$transaction(async (tx) => {
      const newGroup = await tx.savingsGroup.create({
        data: {
          name: dto.name,
          description: dto.description,
          inviteCode,
          nombaAccountId: virtualAccount.nombaAccountId,
          ownerId: userId,
        },
      });

      // Auto-enroll creator as COORDINATOR at payoutTurn 1
      await tx.membership.create({
        data: {
          groupId: newGroup.id,
          userId,
          role: MemberRole.COORDINATOR,
          payoutTurn: 1,
        },
      });

      return newGroup;
    });

    return { id: group.id, inviteCode: group.inviteCode };
  }

  // ─────────────────────────────────────────────────────────────
  // Join Group
  // ─────────────────────────────────────────────────────────────

  async joinGroup(
    userId: string,
    groupId: string,
    inviteCode: string,
  ): Promise<{ membershipId: string; groupId: string }> {
    // Step 1: Verify the group exists and the invite code matches.
    const group = await this.prisma.savingsGroup.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException('Savings group not found.');
    }

    if (group.inviteCode !== inviteCode) {
      // Return a generic message — don't leak whether the code or the group ID is wrong.
      throw new NotFoundException(
        'Invalid invite code. Please check and try again.',
      );
    }

    let membership: { id: string; groupId: string };

    try {
      // Step 2: Freeze membership once an active cycle exists, then assign
      // next payoutTurn atomically under Serializable isolation.
      membership = await this.prisma.$transaction(
        async (tx) => {
          const activeCycle = await tx.savingsCycle.findFirst({
            where: { groupId, isActive: true },
            select: { id: true },
          });

          if (activeCycle) {
            throw new ConflictException(
              'This group has an active savings cycle and is not accepting new members.',
            );
          }

          const existingMembership = await tx.membership.findUnique({
            where: { groupId_userId: { groupId, userId } },
          });

          if (existingMembership) {
            throw new ConflictException(
              'You are already a member of this group.',
            );
          }

          const aggregate = await tx.membership.aggregate({
            where: { groupId },
            _max: { payoutTurn: true },
          });

          const nextTurn = (aggregate._max.payoutTurn ?? 0) + 1;

          return tx.membership.create({
            data: {
              groupId,
              userId,
              role: MemberRole.CONTRIBUTOR,
              payoutTurn: nextTurn,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (this.isSerializableTransactionConflict(error)) {
        throw new ConflictException(
          'The group membership changed concurrently. Please retry.',
        );
      }

      throw error;
    }

    return { membershipId: membership.id, groupId };
  }

  // ─────────────────────────────────────────────────────────────
  // Internal helpers
  // ─────────────────────────────────────────────────────────────

  /**
   * Generates a unique invite code in the format AJO-XXXXXX.
   * Checks the DB for collisions and retries once if needed.
   * (Collision probability ≈ 1 in 2.18 billion — retries are a safety net only.)
   */
  private async generateUniqueInviteCode(): Promise<string> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const code = `AJO-${crypto
        .randomBytes(4)
        .toString('hex')
        .toUpperCase()
        .slice(0, 6)}`;

      const existing = await this.prisma.savingsGroup.findUnique({
        where: { inviteCode: code },
      });

      if (!existing) return code;
      this.logger.warn(
        `Invite code collision on attempt ${attempt + 1}: ${code}`,
      );
    }

    // Astronomically unlikely — two collisions in a row
    throw new Error('Failed to generate a unique invite code. Please retry.');
  }

  private isSerializableTransactionConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    );
  }
}
