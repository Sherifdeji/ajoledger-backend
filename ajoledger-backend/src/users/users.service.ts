import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Thin data-access layer for User records.
 * Contains zero business logic — only DB reads and writes.
 * Business logic lives exclusively in AuthService.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { phone } });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async createUser(phone: string, loginPinHash: string): Promise<User> {
    return this.prisma.user.create({
      data: { phone, loginPinHash },
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
}
