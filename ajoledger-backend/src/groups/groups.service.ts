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
import { AssignPayoutOrderDto } from './dto/assign-payout-order.dto';

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

    const owner = await this.getUserForMembershipProvisioning(userId);
    const groupId = crypto.randomUUID();
    const coordinatorMembershipId = crypto.randomUUID();

    const coordinatorVirtualAccount =
      await this.nombaService.createStaticVirtualAccount({
        membershipId: coordinatorMembershipId,
        customerEmail: owner.email,
        customerName: this.buildVirtualAccountName(dto.name, owner.email),
      });

    // Step 3: Persist group + COORDINATOR membership atomically.
    // If the DB write fails after Nomba succeeds, the orphaned virtual account
    // is an acceptable rare edge case for the hackathon MVP.
    const group = await this.prisma.$transaction(async (tx) => {
      const newGroup = await tx.savingsGroup.create({
        data: {
          id: groupId,
          name: dto.name,
          description: dto.description,
          frequency: dto.frequency,
          defaultContributionAmountKobo: Math.round(dto.contributionAmount * 100),
          maxParticipants: dto.numberOfParticipants,
          inviteCode,
          ownerId: userId,
        },
      });

      // Auto-enroll creator as COORDINATOR at payoutTurn 1
      await tx.membership.create({
        data: {
          id: coordinatorMembershipId,
          groupId: newGroup.id,
          userId,
          role: MemberRole.COORDINATOR,
          payoutTurn: null,
          virtualAccountNumber: coordinatorVirtualAccount.accountNumber,
          virtualBankName: coordinatorVirtualAccount.bankName,
          virtualAccountName: coordinatorVirtualAccount.accountName,
          nombaAccountReference: coordinatorVirtualAccount.accountReference,
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
    inviteCode: string,
  ): Promise<{ membershipId: string; groupId: string }> {
    // Step 1: Verify the group exists by invite code.
    const group = await this.prisma.savingsGroup.findUnique({
      where: { inviteCode },
      include: {
        _count: {
          select: { memberships: true },
        },
      },
    });

    if (!group) {
      throw new NotFoundException(
        'Invalid invite code. Please check and try again.',
      );
    }

    if (group._count.memberships >= group.maxParticipants) {
      throw new ConflictException('This group is already full.');
    }

    const groupId = group.id;

    const activeCycle = await this.prisma.savingsCycle.findFirst({
      where: { groupId, isActive: true },
      select: { id: true },
    });

    if (activeCycle) {
      throw new ConflictException(
        'This group has an active savings cycle and is not accepting new members.',
      );
    }

    const existingMembership = await this.prisma.membership.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { id: true },
    });

    if (existingMembership) {
      throw new ConflictException('You are already a member of this group.');
    }

    const user = await this.getUserForMembershipProvisioning(userId);
    const membershipId = crypto.randomUUID();
    const membershipVirtualAccount =
      await this.nombaService.createStaticVirtualAccount({
        membershipId,
        customerEmail: user.email,
        customerName: this.buildVirtualAccountName(group.name, user.email),
      });

    // Step 2: Create membership with a null payoutTurn.
    const membership = await this.prisma.membership.create({
      data: {
        id: membershipId,
        groupId,
        userId,
        role: MemberRole.CONTRIBUTOR,
        payoutTurn: null,
        virtualAccountNumber: membershipVirtualAccount.accountNumber,
        virtualBankName: membershipVirtualAccount.bankName,
        virtualAccountName: membershipVirtualAccount.accountName,
        nombaAccountReference: membershipVirtualAccount.accountReference,
      },
    });

    return { membershipId: membership.id, groupId };
  }

  // ─────────────────────────────────────────────────────────────
  // Fetch User Groups
  // ─────────────────────────────────────────────────────────────

  async getUserGroups(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            memberships: true,
            cycles: {
              where: { isActive: true },
              include: {
                contributions: {
                  where: { status: 'PAID' },
                },
              },
            },
          },
        },
        contributions: {
          where: {
            cycle: { isActive: true },
          },
        },
      },
    });

    return memberships.map((m) => {
      const activeCycle = m.group.cycles[0];
      const memberCount = m.group.memberships.length;
      
      let potCollected = 0;
      let myStatus = 'PENDING';
      
      if (activeCycle) {
        potCollected = activeCycle.contributions.reduce(
          (sum, c) => sum + activeCycle.contributionAmountKobo,
          0,
        );
        
        const myContributions = m.contributions.filter(c => c.roundNumber === activeCycle.currentRound);
        if (myContributions.length > 0) {
          myStatus = myContributions.every(c => c.status === 'PAID') ? 'PAID' : 'PARTIAL';
        }
      }

      return {
        id: m.group.id,
        name: m.group.name,
        inviteCode: m.group.inviteCode,
        cycleDetails: {
          currentCycle: activeCycle?.currentRound ?? 0,
          contributionAmount: activeCycle?.contributionAmountKobo ?? 0,
          potCollected,
          potTarget: activeCycle ? activeCycle.contributionAmountKobo * memberCount : 0,
          nextPayoutDate: activeCycle?.startedAt ?? null, // Simplification for hackathon
        },
        myDetails: {
          position: m.payoutTurn,
          status: myStatus,
          virtualAccountNumber: m.virtualAccountNumber,
          virtualBankName: m.virtualBankName,
          virtualAccountName: m.virtualAccountName,
        },
      };
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Fetch Group Details
  // ─────────────────────────────────────────────────────────────

  async getGroupDetails(userId: string, groupId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });

    if (!membership) {
      throw new NotFoundException('You are not a member of this group.');
    }

    const group = await this.prisma.savingsGroup.findUnique({
      where: { id: groupId },
      include: {
        memberships: {
          include: {
            user: { select: { email: true } }
          },
          orderBy: { payoutTurn: 'asc' }
        },
        cycles: {
          where: { isActive: true },
          take: 1,
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Group not found.');
    }

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      inviteCode: group.inviteCode,
      activeCycle: group.cycles[0] ?? null,
      myDetails: {
        virtualAccountNumber: membership.virtualAccountNumber,
        virtualBankName: membership.virtualBankName,
        virtualAccountName: membership.virtualAccountName,
      },
      members: group.memberships.map((m) => ({
        membershipId: m.id,
        email: m.user.email,
        role: m.role,
        payoutTurn: m.payoutTurn,
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Admin Turn Assignment
  // ─────────────────────────────────────────────────────────────

  async assignPayoutOrder(
    userId: string,
    groupId: string,
    dto: AssignPayoutOrderDto,
  ) {
    const adminMembership = await this.prisma.membership.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });

    if (!adminMembership || adminMembership.role !== MemberRole.COORDINATOR) {
      throw new ConflictException('Only the group coordinator can assign payout turns.');
    }

    const activeCycle = await this.prisma.savingsCycle.findFirst({
      where: { groupId, isActive: true },
    });

    if (activeCycle) {
      throw new ConflictException('Cannot reassign turns while a cycle is active.');
    }

    const members = await this.prisma.membership.findMany({
      where: { groupId },
      select: { id: true },
    });

    const memberIds = new Set(members.map(m => m.id));
    
    if (dto.assignments.length !== members.length) {
      throw new ConflictException('You must assign exactly one turn to every member.');
    }

    const assignedTurns = new Set<number>();
    
    for (const assignment of dto.assignments) {
      if (!memberIds.has(assignment.membershipId)) {
        throw new ConflictException(`Membership ID ${assignment.membershipId} does not belong to this group.`);
      }
      if (assignedTurns.has(assignment.payoutTurn)) {
        throw new ConflictException('Turns must be unique. Duplicate found.');
      }
      assignedTurns.add(assignment.payoutTurn);
    }

    // Check gapless 1..N
    for (let i = 1; i <= members.length; i++) {
      if (!assignedTurns.has(i)) {
        throw new ConflictException(`Turn assignment is missing position ${i}. Turns must be sequential from 1 to ${members.length}.`);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (const assignment of dto.assignments) {
        await tx.membership.update({
          where: { id: assignment.membershipId },
          data: { payoutTurn: assignment.payoutTurn },
        });
      }
    });

    return { success: true };
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

  private async getUserForMembershipProvisioning(
    userId: string,
  ): Promise<{ email: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user;
  }

  private buildVirtualAccountName(groupName: string, email: string): string {
    const emailName = email.split('@')[0] || 'member';
    const rawName = `${groupName} ${emailName}`;
    // Nomba strictly rejects any special characters in the account name
    const sanitizedName = rawName.replace(/[^a-zA-Z0-9 ]/g, '').trim();
    return sanitizedName.slice(0, 100) || 'AjoLedger Member';
  }
}
