import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './strategies/jwt.strategy';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // Registration
  // ─────────────────────────────────────────────────────────────

  async register(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; user: { id: string; email: string } }> {
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new ConflictException(
        'An account with this email address already exists.',
      );
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await this.usersService.createUser(email, passwordHash);
    const accessToken = this.signToken(user.id, user.email);

    return {
      accessToken,
      user: { id: user.id, email: user.email },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Login
  // ─────────────────────────────────────────────────────────────

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; user: { id: string; email: string } }> {
    const user = await this.usersService.findByEmail(email);

    // Constant-time comparison path whether user exists or not,
    // to avoid timing-based email enumeration attacks.
    const hashToCheck =
      user?.passwordHash ??
      '$2b$12$invalidhashpaddinginvalidhashpaddinginvalidhashpadding00';
    const isMatch = await bcrypt.compare(password, hashToCheck);

    if (!user || !isMatch) {
      throw new UnauthorizedException('Invalid email address or password.');
    }

    const accessToken = this.signToken(user.id, user.email);
    return {
      accessToken,
      user: { id: user.id, email: user.email },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Progressive Profiling — Transaction PIN Setup
  // ─────────────────────────────────────────────────────────────

  async setupTransactionPin(
    userId: string,
    transactionPin: string,
  ): Promise<{ status: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    if (user.transactionPinHash) {
      throw new ConflictException(
        'Transaction PIN is already configured. Use the change PIN flow.',
      );
    }

    const transactionPinHash = await bcrypt.hash(transactionPin, BCRYPT_ROUNDS);
    await this.usersService.setTransactionPin(userId, transactionPinHash);

    return { status: 'configured' };
  }

  // ─────────────────────────────────────────────────────────────
  // UI Pre-flight Transaction PIN Verification
  // ─────────────────────────────────────────────────────────────

  async verifyTransactionPin(
    userId: string,
    transactionPin: string,
  ): Promise<{ status: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    if (!user.transactionPinHash) {
      throw new BadRequestException(
        'Transaction PIN not configured. Please complete your account setup.',
      );
    }

    const isMatch = await bcrypt.compare(
      transactionPin,
      user.transactionPinHash,
    );
    if (!isMatch) {
      throw new UnauthorizedException('Invalid transaction PIN.');
    }

    return { status: 'verified' };
  }

  // ─────────────────────────────────────────────────────────────
  // Exported helper for inline use by PaymentsService (M7)
  // ─────────────────────────────────────────────────────────────

  async verifyTransactionPinForUser(
    userId: string,
    transactionPin: string,
  ): Promise<void> {
    await this.verifyTransactionPin(userId, transactionPin);
  }

  // ─────────────────────────────────────────────────────────────
  // Internal helpers
  // ─────────────────────────────────────────────────────────────

  private signToken(userId: string, email: string): string {
    const payload: JwtPayload = { sub: userId, email };
    // secret and expiresIn are configured at module level via JwtModule.registerAsync
    return this.jwtService.sign(payload);
  }
}
