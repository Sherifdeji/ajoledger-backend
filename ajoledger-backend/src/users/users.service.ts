import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePayoutSettingsDto } from './dto/update-payout-settings.dto';

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
   * Persist payout bank details for a user.
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
      select: {
        id: true,
        email: true,
        createdAt: true,
        payoutBankCode: true,
        payoutAccountNumber: true,
        payoutAccountName: true,
        // passwordHash and transactionPinHash deliberately excluded
      },
    });
  }
}

