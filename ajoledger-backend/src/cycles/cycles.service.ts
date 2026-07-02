import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContributionStatus, MemberRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCycleDto } from './dto/create-cycle.dto';

export interface CreateCycleResult {
  id: string;
  groupId: string;
  contributionAmountKobo: number;
  totalRounds: number;
  currentRound: number;
  isActive: boolean;
  seededContributions: number;
}

@Injectable()
export class CyclesService {
  constructor(private readonly prisma: PrismaService) {}

  async createCycle(
    userId: string,
    groupId: string,
    dto: CreateCycleDto,
  ): Promise<CreateCycleResult> {
    const dueDate = new Date(dto.dueDate);

    if (dueDate.getTime() <= Date.now()) {
      throw new BadRequestException('dueDate must be in the future.');
    }

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const group = await tx.savingsGroup.findUnique({
            where: { id: groupId },
            select: { id: true },
          });

          if (!group) {
            throw new NotFoundException('Savings group not found.');
          }

          const coordinatorMembership = await tx.membership.findFirst({
            where: {
              groupId,
              userId,
              role: MemberRole.COORDINATOR,
            },
            select: { id: true },
          });

          if (!coordinatorMembership) {
            throw new ForbiddenException(
              'Only the group coordinator can start a savings cycle.',
            );
          }

          const activeCycle = await tx.savingsCycle.findFirst({
            where: { groupId, isActive: true },
            select: { id: true },
          });

          if (activeCycle) {
            throw new ConflictException(
              'This group already has an active savings cycle.',
            );
          }

          const memberships = await tx.membership.findMany({
            where: { groupId },
            orderBy: { payoutTurn: 'asc' },
            select: { id: true },
          });

          if (memberships.length === 0) {
            throw new ConflictException(
              'A savings cycle requires at least one group member.',
            );
          }

          const cycle = await tx.savingsCycle.create({
            data: {
              groupId,
              contributionAmountKobo: dto.contributionAmountKobo,
              totalRounds: memberships.length,
              currentRound: 1,
              isActive: true,
            },
          });

          const seeded = await tx.contribution.createMany({
            data: memberships.map((membership) => ({
              cycleId: cycle.id,
              membershipId: membership.id,
              roundNumber: 1,
              dueDate,
              status: ContributionStatus.PENDING,
            })),
          });

          return {
            id: cycle.id,
            groupId: cycle.groupId,
            contributionAmountKobo: cycle.contributionAmountKobo,
            totalRounds: cycle.totalRounds,
            currentRound: cycle.currentRound,
            isActive: cycle.isActive,
            seededContributions: seeded.count,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (this.isSerializableTransactionConflict(error)) {
        throw new ConflictException(
          'Savings cycle could not be started because the group changed concurrently. Please retry.',
        );
      }

      throw error;
    }
  }

  private isSerializableTransactionConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    );
  }
}
