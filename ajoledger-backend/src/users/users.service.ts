import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePayoutSettingsDto } from './dto/update-payout-settings.dto';
import { SetupBankDto } from './dto/setup-bank.dto';

/** Shared Prisma select that strips all credential hashes from user responses. */
const SAFE_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phoneNumber: true,
  createdAt: true,
  isDeactivated: true,
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

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id }, select: SAFE_USER_SELECT });
  }

  async findRawById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async createUser(email: string, passwordHash: string) {
    return this.prisma.user.create({
      data: { email, passwordHash },
    });
  }

  async createUserGoogle(
    email: string,
    googleId: string,
    firstName?: string,
    lastName?: string,
  ) {
    return this.prisma.user.create({
      data: {
        email,
        googleId,
        firstName,
        lastName,
        authProvider: 'GOOGLE',
      },
    });
  }

  async linkGoogleAccount(userId: string, googleId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        googleId,
        authProvider: 'BOTH',
      },
    });
  }

  async addPassword(userId: string, passwordHash: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        authProvider: 'BOTH',
      },
    });
  }

  async setTransactionPin(
    userId: string,
    transactionPinHash: string,
  ) {
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
  ) {
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
  ) {
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
  ) {
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

  async updateProfile(
    userId: string,
    dto: { firstName?: string; lastName?: string; phoneNumber?: string },
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phoneNumber: dto.phoneNumber,
      },
      select: SAFE_USER_SELECT,
    });
  }

  async updatePassword(userId: string, newPasswordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Soft Deletion & Reactivation
  // ─────────────────────────────────────────────────────────────

  async initiateSoftDeletion(userId: string, reason?: string): Promise<{ otp: string }> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found.');

    // Generate a secure 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(otp, salt);
    
    // Expires in 15 minutes
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        deletionReason: reason,
        deletionOtpHash: otpHash,
        deletionOtpExpiresAt: expiresAt,
      },
    });

    // In a real application, send this OTP via email/SMS.
    // For this hackathon demo, we return it in the payload.
    return { otp };
  }

  async verifySoftDeletion(userId: string, otp: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    if (!user.deletionOtpHash || !user.deletionOtpExpiresAt) {
      throw new BadRequestException('No deletion request found.');
    }

    if (user.deletionOtpExpiresAt < new Date()) {
      throw new BadRequestException('Deletion OTP has expired. Please initiate again.');
    }

    const isMatch = await bcrypt.compare(otp, user.deletionOtpHash);
    if (!isMatch) {
      throw new BadRequestException('Invalid OTP.');
    }

    const scheduledDeletionDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isDeactivated: true,
        scheduledDeletionDate,
        deletionOtpHash: null,
        deletionOtpExpiresAt: null,
      },
    });
  }

  async reactivateAccount(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    if (!user.isDeactivated) {
      throw new BadRequestException('Account is not deactivated.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isDeactivated: false,
        scheduledDeletionDate: null,
        deletionReason: null,
      },
    });
  }
}
