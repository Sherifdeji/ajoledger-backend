import { Injectable, Logger } from '@nestjs/common';
import {
  ContributionStatus,
  PaymentStatus,
  PayoutStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NombaService } from '../nomba/nomba.service';
import {
  NombaWebhookPayload,
  NombaWebhookResult,
} from './interfaces/nomba-webhook-payload.interface';

/** Number of days ahead to set the due date when seeding next-round contributions. */
const NEXT_ROUND_DUE_DAYS = 30;

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nombaService: NombaService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // Public dispatcher — routes events to the correct handler
  // ─────────────────────────────────────────────────────────────

  async handleNombaWebhook(
    payload: NombaWebhookPayload,
  ): Promise<NombaWebhookResult> {
    if (payload.event_type === 'payment_success') {
      return this.handleContributionPayment(payload);
    }

    if (payload.event_type === 'payout_success') {
      return this.handlePayoutSuccess(payload);
    }

    return { status: 'ignored', reason: 'Unsupported webhook event.' };
  }

  // ─────────────────────────────────────────────────────────────
  // payment_success — inbound contribution via virtual account
  // ─────────────────────────────────────────────────────────────

  private async handleContributionPayment(
    payload: NombaWebhookPayload,
  ): Promise<NombaWebhookResult> {
    const transaction = payload.data?.transaction;

    if (transaction?.type !== 'vact_transfer') {
      return {
        status: 'ignored',
        reason: 'Unsupported payment transaction type.',
      };
    }

    const transactionId = transaction.transactionId;
    const membershipId = transaction.aliasAccountReference;
    const nombaAmount = transaction.transactionAmount;

    if (!transactionId || !membershipId || nombaAmount === undefined) {
      this.logger.warn(
        `Ignoring payment_success webhook with missing reconciliation fields. requestId=${payload.requestId ?? 'unknown'}`,
      );
      return {
        status: 'ignored',
        reason: 'Missing transactionId, aliasAccountReference, or amount.',
      };
    }

    let paidAmountKobo: number;

    try {
      paidAmountKobo = this.nombaService.nombaAmountToKobo(nombaAmount);
    } catch {
      this.logger.warn(
        `Ignoring payment_success webhook with invalid amount. transactionId=${transactionId}`,
      );
      return {
        status: 'ignored',
        reason: 'Invalid payment provider amount.',
      };
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existingPayment = await tx.payment.findUnique({
          where: { nombaTransactionRef: transactionId },
          select: { id: true, contributionId: true },
        });

        if (existingPayment) {
          return {
            status: 'duplicate',
            reason: 'Webhook transaction already processed.',
            paymentId: existingPayment.id,
            contributionId: existingPayment.contributionId ?? undefined,
          };
        }

        const membership = await tx.membership.findUnique({
          where: { id: membershipId },
          select: {
            id: true,
            groupId: true,
          },
        });

        if (!membership) {
          this.logger.warn(
            `Ignoring payment_success for unknown membership reference. transactionId=${transactionId}`,
          );
          return {
            status: 'ignored',
            reason: 'Membership reference not found.',
          };
        }

        const activeCycle = await tx.savingsCycle.findFirst({
          where: { groupId: membership.groupId, isActive: true },
          select: {
            id: true,
            currentRound: true,
            contributionAmountKobo: true,
          },
        });

        if (!activeCycle) {
          this.logger.warn(
            `Ignoring payment_success for group without active cycle. transactionId=${transactionId} groupId=${membership.groupId}`,
          );
          return {
            status: 'ignored',
            reason: 'No active savings cycle for membership group.',
          };
        }

        const contribution = await tx.contribution.findFirst({
          where: {
            membershipId: membership.id,
            cycleId: activeCycle.id,
            roundNumber: activeCycle.currentRound,
            status: ContributionStatus.PENDING,
          },
          select: {
            id: true,
            payment: { select: { id: true } },
          },
        });

        if (!contribution) {
          this.logger.warn(
            `Ignoring payment_success with no pending contribution. transactionId=${transactionId} membershipId=${membership.id} cycleId=${activeCycle.id}`,
          );
          return {
            status: 'ignored',
            reason: 'No pending contribution for the active round.',
          };
        }

        if (contribution.payment) {
          return {
            status: 'duplicate',
            reason: 'Contribution already has a payment record.',
            paymentId: contribution.payment.id,
            contributionId: contribution.id,
          };
        }

        if (paidAmountKobo !== activeCycle.contributionAmountKobo) {
          this.logger.warn(
            `Ignoring amount mismatch. transactionId=${transactionId} paid=${paidAmountKobo} expected=${activeCycle.contributionAmountKobo}`,
          );
          return {
            status: 'ignored',
            reason: 'Paid amount does not match expected contribution amount.',
          };
        }

        const payment = await tx.payment.create({
          data: {
            contributionId: contribution.id,
            amountKobo: paidAmountKobo,
            status: PaymentStatus.SUCCESS,
            nombaTransactionRef: transactionId,
          },
        });

        await tx.contribution.update({
          where: { id: contribution.id },
          data: { status: ContributionStatus.PAID },
        });

        this.logger.log(
          `✅ Payment of ${paidAmountKobo} Kobo successfully processed for membership ${membership.id} in cycle ${activeCycle.id}`,
        );

        return {
          status: 'processed',
          paymentId: payment.id,
          contributionId: contribution.id,
        };
      });
    } catch (error) {
      if (this.isDuplicateWebhookRace(error)) {
        return {
          status: 'duplicate',
          reason: 'Webhook transaction already processed.',
        };
      }

      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // payout_success — outbound disbursement confirmed by Nomba
  // ─────────────────────────────────────────────────────────────

  private async handlePayoutSuccess(
    payload: NombaWebhookPayload,
  ): Promise<NombaWebhookResult> {
    const merchantTxRef = payload.data?.transaction?.merchantTxRef;

    if (!merchantTxRef) {
      this.logger.warn(
        `payout_success missing merchantTxRef. requestId=${payload.requestId ?? 'unknown'}`,
      );
      return {
        status: 'ignored',
        reason: 'Missing merchantTxRef in payout_success event.',
      };
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // ── 1. Find payout by our deterministic merchantTxRef ──────
        const payout = await tx.payout.findUnique({
          where: { merchantTxRef },
          select: { id: true, status: true, cycleId: true },
        });

        if (!payout) {
          this.logger.warn(
            `payout_success for unknown merchantTxRef=${merchantTxRef}`,
          );
          return {
            status: 'ignored',
            reason: 'Payout record not found for given merchantTxRef.',
          };
        }

        // ── 2. Idempotency — if already completed, return early ────
        if (payout.status === PayoutStatus.COMPLETED) {
          this.logger.log(
            `Duplicate payout_success ignored. payoutId=${payout.id}`,
          );
          return {
            status: 'duplicate',
            reason: 'Payout already marked as completed.',
            payoutId: payout.id,
          };
        }

        // ── 3. Mark payout COMPLETED with timestamp ────────────────
        await tx.payout.update({
          where: { id: payout.id },
          data: { status: PayoutStatus.COMPLETED, paidAt: new Date() },
        });

        // ── 4. Load cycle data for round advancement ───────────────
        const cycle = await tx.savingsCycle.findUnique({
          where: { id: payout.cycleId },
          select: {
            id: true,
            groupId: true,
            currentRound: true,
            totalRounds: true,
          },
        });

        if (!cycle) {
          // Data integrity failure — should never happen
          this.logger.error(
            `Cycle not found for payoutId=${payout.id} cycleId=${payout.cycleId}`,
          );
          throw new Error(
            'Data integrity error: savings cycle not found during payout completion.',
          );
        }

        const nextRound = cycle.currentRound + 1;
        const cycleComplete = nextRound > cycle.totalRounds;

        if (cycleComplete) {
          // ── 5a. All rounds done — close the cycle ───────────────
          await tx.savingsCycle.update({
            where: { id: cycle.id },
            data: { isActive: false, currentRound: nextRound },
          });

          this.logger.log(
            `Cycle ${cycle.id} completed after ${cycle.totalRounds} rounds.`,
          );
        } else {
          // ── 5b. Advance round and seed next round contributions ──
          await tx.savingsCycle.update({
            where: { id: cycle.id },
            data: { currentRound: nextRound },
          });

          const memberships = await tx.membership.findMany({
            where: { groupId: cycle.groupId },
            select: { id: true },
          });

          // Due date: 30 days from today.
          // Production improvement: derive from coordinator-configurable cycle settings.
          const nextDueDate = new Date();
          nextDueDate.setDate(nextDueDate.getDate() + NEXT_ROUND_DUE_DAYS);

          await tx.contribution.createMany({
            data: memberships.map((m) => ({
              cycleId: cycle.id,
              membershipId: m.id,
              roundNumber: nextRound,
              dueDate: nextDueDate,
              status: ContributionStatus.PENDING,
            })),
          });

          this.logger.log(
            `Round ${nextRound} seeded for cycle ${cycle.id}. ` +
              `${memberships.length} contributions created.`,
          );
        }

        return { status: 'processed', payoutId: payout.id };
      });
    } catch (error) {
      if (this.isDuplicateWebhookRace(error)) {
        return {
          status: 'duplicate',
          reason: 'Payout already processed (concurrent webhook delivery).',
        };
      }

      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Internal helpers
  // ─────────────────────────────────────────────────────────────

  private isDuplicateWebhookRace(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
