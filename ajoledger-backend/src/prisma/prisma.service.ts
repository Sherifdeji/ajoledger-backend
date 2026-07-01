import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Singleton Prisma client managed by NestJS DI.
 * Never instantiate PrismaClient directly outside this service.
 *
 * Uses Prisma 5 (prisma-client-js generator) — fully CommonJS-compatible
 * with NestJS. Connects via DATABASE_URL environment variable.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
