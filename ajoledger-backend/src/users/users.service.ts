import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePayoutSettingsDto } from './dto/update-payout-settings.dto';
import { SetupBankDto } from './dto/setup-bank.dto';

/** Shared Prisma select that strips all credential hashes from user responses. */
const SAFE_USER_SELECT = {
  id: true,
  email: true,
  createdAt: true,
  payoutBankCode: true,
  payoutAccountNumber: true,
  payoutAccountName: true,
  // passwordHash and transactionPinHash deliberately excluded
} as const;

/**
 * Thin data-access layer for User records.
 * Contains zero business logic — only DB reads and writes.
 * Business logic lives exclusively in AuthService (or the calling controller).
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async createUser(email: string, passwordHash: string): Promise<User> {
    return this.prisma.user.create({
      data: { email, passwordHash },
    });
  }

  async setTransactionPin(
    userId: string,
    transactionPinHash: string,
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { transactionPinHash },
    });
  }

  /**
   * Returns the current user's profile with payout bank details.
   * payoutBankCode / payoutAccountNumber / payoutAccountName are null
   * if not yet configured — the mobile app uses this to decide whether
   * to show the bank setup modal.
   */
  async getProfile(
    userId: string,
  ): Promise<Omit<User, 'passwordHash' | 'transactionPinHash'> | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: SAFE_USER_SELECT,
    });
  }

  /**
   * First-time bank detail setup (onboarding).
   *
   * Uses an atomic updateMany with `payoutBankCode: null` guard to prevent
   * overwriting existing bank details without a PIN. This eliminates the
   * TOCTOU race condition that a check-then-update pattern would introduce.
   *
   * Throws:
   *  - NotFoundException    if the userId doesn't exist in the DB
   *  - BadRequestException  if bank details are already configured
   */
  async setupBankDetails(
    userId: string,
    dto: SetupBankDto,
  ): Promise<Omit<User, 'passwordHash' | 'transactionPinHash'>> {
    const result = await this.prisma.user.updateMany({
      where: { id: userId, payoutBankCode: null },
      data: {
        payoutBankCode: dto.bankCode,
        payoutAccountNumber: dto.accountNumber,
        payoutAccountName: dto.accountName,
      },
    });

    if (result.count === 0) {
      // Either user doesn't exist, or bank details already set.
      // Disambiguate with a read to surface the correct error.
      const user = await this.prisma.user.findUnique({ where: { id: userId } });

      if (!user) {
        throw new NotFoundException('User not found.');
      }

      throw new BadRequestException(
        'Bank details already configured. Please use the profile settings to update them.',
      );
    }

    // Re-fetch with safe select — updateMany does not support inline select
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: SAFE_USER_SELECT,
    });
  }

  /**
   * Updates payout bank details for a user (post-onboarding profile update).
   * PIN verification MUST be performed by the caller before invoking this method.
   * Returns the updated user with credential hashes explicitly excluded.
   */
  async updatePayoutSettings(
    userId: string,
    dto: UpdatePayoutSettingsDto,
  ): Promise<Omit<User, 'passwordHash' | 'transactionPinHash'>> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        payoutBankCode: dto.bankCode,
        payoutAccountNumber: dto.accountNumber,
        payoutAccountName: dto.accountName,
      },
      select: SAFE_USER_SELECT,
    });
  }
}
