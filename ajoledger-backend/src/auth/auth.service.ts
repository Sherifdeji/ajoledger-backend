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
    phone: string,
    loginPin: string,
  ): Promise<{ accessToken: string; user: { id: string; phone: string } }> {
    const existing = await this.usersService.findByPhone(phone);
    if (existing) {
      throw new ConflictException(
        'An account with this phone number already exists.',
      );
    }

    const loginPinHash = await bcrypt.hash(loginPin, BCRYPT_ROUNDS);
    const user = await this.usersService.createUser(phone, loginPinHash);
    const accessToken = this.signToken(user.id, user.phone);

    return {
      accessToken,
      user: { id: user.id, phone: user.phone },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Login
  // ─────────────────────────────────────────────────────────────

  async login(
    phone: string,
    loginPin: string,
  ): Promise<{ accessToken: string; user: { id: string; phone: string } }> {
    const user = await this.usersService.findByPhone(phone);

    // Use a constant-time comparison path whether user exists or not
    // to avoid timing-based phone enumeration attacks.
    const pinToCheck =
      user?.loginPinHash ??
      '$2b$12$invalidhashpadding000000000000000000000000000000000000000';
    const isMatch = await bcrypt.compare(loginPin, pinToCheck);

    if (!user || !isMatch) {
      throw new UnauthorizedException('Invalid phone number or PIN.');
    }

    const accessToken = this.signToken(user.id, user.phone);
    return {
      accessToken,
      user: { id: user.id, phone: user.phone },
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
  // Internal helpers
  // ─────────────────────────────────────────────────────────────

  /**
   * Exposed for use by other services that need to perform inline
   * transaction PIN verification (e.g. PaymentsService).
   */
  async verifyTransactionPinForUser(
    userId: string,
    transactionPin: string,
  ): Promise<void> {
    await this.verifyTransactionPin(userId, transactionPin);
  }

  private signToken(userId: string, phone: string): string {
    const payload: JwtPayload = { sub: userId, phone };
    // secret and expiresIn are already configured at module level via JwtModule.registerAsync
    return this.jwtService.sign(payload);
  }
}
