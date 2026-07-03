import { Injectable, Logger } from '@nestjs/common';
import { ContributionStatus, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NombaService } from '../nomba/nomba.service';
import {
  NombaWebhookPayload,
  NombaWebhookResult,
} from './interfaces/nomba-webhook-payload.interface';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nombaService: NombaService,
  ) {}

  async handleNombaWebhook(
    payload: NombaWebhookPayload,
  ): Promise<NombaWebhookResult> {
    if (payload.event_type !== 'payment_success') {
      return { status: 'ignored', reason: 'Unsupported webhook event.' };
    }

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

  private isDuplicateWebhookRace(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
