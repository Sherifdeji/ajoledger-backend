import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ContributionStatus,
  MemberRole,
  PayoutStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NombaService } from '../nomba/nomba.service';
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

export interface DisbursePayoutResult {
  payoutId: string;
  merchantTxRef: string;
  amountKobo: number;
  nombaStatus: string;
  round: number;
}

/** ₦20 flat Nomba network fee in kobo — disclosed in AjoLedger T&Cs. */
const NOMBA_NETWORK_FEE_KOBO = 2000;

@Injectable()
export class CyclesService {
  private readonly logger = new Logger(CyclesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nombaService: NombaService,
  ) {}

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
            select: { id: true, payoutTurn: true },
          });

          if (memberships.length === 0) {
            throw new ConflictException(
              'A savings cycle requires at least one group member.',
            );
          }

          const hasUnassignedTurn = memberships.some((m) => m.payoutTurn === null);
          if (hasUnassignedTurn) {
            throw new ConflictException(
              'Cannot start cycle: one or more members do not have a payout turn assigned. The group coordinator must assign payout turns first.',
            );
          }

          for (let i = 0; i < memberships.length; i++) {
            if (memberships[i].payoutTurn !== i + 1) {
              throw new ConflictException(
                'Cannot start cycle: payout turns are not sequential. The group coordinator must reassign payout turns.',
              );
            }
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

  // ─────────────────────────────────────────────────────────────
  // Payout Disbursement
  // ─────────────────────────────────────────────────────────────

  async disburseCyclePayout(
    userId: string,
    groupId: string,
    cycleId: string,
  ): Promise<DisbursePayoutResult> {
    // ── 1. Verify coordinator role ───────────────────────────────
    const coordinatorMembership = await this.prisma.membership.findFirst({
      where: { groupId, userId, role: MemberRole.COORDINATOR },
      select: { id: true },
    });

    if (!coordinatorMembership) {
      throw new ForbiddenException(
        'Only the group coordinator can disburse payouts.',
      );
    }

    // ── 2. Load and validate the cycle ──────────────────────────
    const cycle = await this.prisma.savingsCycle.findUnique({
      where: { id: cycleId },
      select: {
        id: true,
        groupId: true,
        isActive: true,
        currentRound: true,
        totalRounds: true,
        contributionAmountKobo: true,
      },
    });

    if (!cycle || cycle.groupId !== groupId) {
      throw new NotFoundException('Savings cycle not found.');
    }

    if (!cycle.isActive) {
      throw new BadRequestException('This savings cycle is no longer active.');
    }

    // ── 3. Verify all contributions for the current round are PAID ─
    const unpaidCount = await this.prisma.contribution.count({
      where: {
        cycleId,
        roundNumber: cycle.currentRound,
        status: { not: ContributionStatus.PAID },
      },
    });

    if (unpaidCount > 0) {
      throw new BadRequestException(
        `${unpaidCount} contribution(s) for round ${cycle.currentRound} are still unpaid. ` +
          'All members must contribute before disbursement.',
      );
    }

    // ── 4. Find the round winner (payoutTurn === currentRound) ──
    const winnerMembership = await this.prisma.membership.findFirst({
      where: { groupId, payoutTurn: cycle.currentRound },
      select: {
        id: true,
        user: {
          select: {
            payoutBankCode: true,
            payoutAccountNumber: true,
            payoutAccountName: true,
          },
        },
      },
    });

    if (!winnerMembership) {
      // This should never happen if the data is consistent
      throw new InternalServerErrorException(
        `No member found with payout turn ${cycle.currentRound}. ` +
          'Contact support — this indicates a data integrity issue.',
      );
    }

    // ── 5. Verify winner has bank details configured ─────────────
    const { user: winner } = winnerMembership;

    if (
      !winner.payoutBankCode ||
      !winner.payoutAccountNumber ||
      !winner.payoutAccountName
    ) {
      throw new BadRequestException(
        'The round winner has not configured their payout bank account. ' +
          'Ask them to update their payout settings via PATCH /api/v1/users/payout-settings.',
      );
    }

    // ── 6. Idempotency guard — check for an existing payout ─────
    const merchantTxRef = `PAYOUT-${cycleId}-R${cycle.currentRound}`;

    const existingPayout = await this.prisma.payout.findUnique({
      where: { merchantTxRef },
      select: { id: true, status: true },
    });

    if (existingPayout) {
      throw new ConflictException(
        `A payout for round ${cycle.currentRound} has already been initiated ` +
          `(status: ${existingPayout.status}). ` +
          'If it is still PROCESSING, wait for the webhook to confirm.',
      );
    }

    // ── 7. Calculate net payout amount ───────────────────────────
    // Gross = contributionAmountKobo × number of members (totalRounds)
    // Net   = Gross − NOMBA_NETWORK_FEE_KOBO (₦20, per T&Cs)
    const grossPayoutKobo = cycle.contributionAmountKobo * cycle.totalRounds;
    const netPayoutKobo = grossPayoutKobo - NOMBA_NETWORK_FEE_KOBO;

    if (netPayoutKobo <= 0) {
      throw new BadRequestException(
        'Payout amount after network fee deduction is zero or negative. ' +
          'Increase the contribution amount.',
      );
    }

    // ── 8. Call Nomba — OUTSIDE the DB write ─────────────────────
    // Per architectural rule: network calls must not be inside Prisma $transaction blocks.
    // merchantTxRef and X-Idempotent-key ensure Nomba deduplicates on retry.
    this.logger.log(
      `Initiating payout. merchantTxRef=${merchantTxRef} amountKobo=${netPayoutKobo}`,
    );

    const transferResult = await this.nombaService.disbursePayout({
      merchantTxRef,
      amountKobo: netPayoutKobo,
      bankCode: winner.payoutBankCode,
      accountNumber: winner.payoutAccountNumber,
      accountName: winner.payoutAccountName,
      narration: `AjoLedger payout — Round ${cycle.currentRound} of ${cycle.totalRounds}`,
    });

    this.logger.log(
      `Nomba transfer response. merchantTxRef=${merchantTxRef} nombaStatus=${transferResult.status}`,
    );

    // ── 9. Record the payout in the DB ───────────────────────────
    // Status is PROCESSING — the round only advances after payout_success webhook fires.
    // If this write fails, the merchantTxRef unique constraint prevents double-disburse on retry
    // because Nomba's idempotency key will already have deduplicated the transfer.
    try {
      const payout = await this.prisma.payout.create({
        data: {
          cycleId,
          membershipId: winnerMembership.id,
          amountKobo: netPayoutKobo,
          status: PayoutStatus.PROCESSING,
          merchantTxRef,
        },
      });

      return {
        payoutId: payout.id,
        merchantTxRef,
        amountKobo: netPayoutKobo,
        nombaStatus: transferResult.status,
        round: cycle.currentRound,
      };
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        // Race condition: two concurrent disburse calls both passed the existence check
        // and both called Nomba (idempotent), but only one can win the DB write.
        throw new ConflictException(
          `Payout for round ${cycle.currentRound} was already recorded by a concurrent request.`,
        );
      }
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Internal helpers
  // ─────────────────────────────────────────────────────────────

  private isSerializableTransactionConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    );
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
