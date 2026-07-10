import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './strategies/jwt.strategy';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly oauthClient: OAuth2Client;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {
    this.oauthClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }

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

    if (user && user.authProvider === 'GOOGLE' && !user.passwordHash) {
      throw new UnauthorizedException(
        "This account uses Google Sign-In. Please click 'Continue with Google' to log in, then set a password in your security settings to be able to login with password later.",
      );
    }

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
  // Google OAuth Login
  // ─────────────────────────────────────────────────────────────

  async googleLogin(idToken: string): Promise<{ accessToken: string; user: { id: string; email: string } }> {
    let ticket;
    try {
      ticket = await this.oauthClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
    } catch (error) {
      throw new UnauthorizedException('Invalid Google ID Token.');
    }

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new BadRequestException('Google token payload is missing email.');
    }

    const { email, sub: googleId, given_name: firstName, family_name: lastName, email_verified } = payload;

    let user = await this.usersService.findByEmail(email);

    if (user) {
      // Scenario B: Local user tries Google login
      if (user.authProvider === 'LOCAL') {
        if (!email_verified) {
          throw new UnauthorizedException('Google email is not verified.');
        }
        user = await this.usersService.linkGoogleAccount(user.id, googleId);
      }
    } else {
      // New user via Google
      if (!email_verified) {
        throw new UnauthorizedException('Google email is not verified.');
      }
      user = await this.usersService.createUserGoogle(email, googleId, firstName, lastName);
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
    const user = await this.usersService.findRawById(userId);
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
    const user = await this.usersService.findRawById(userId);
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
  // Internal helper for issuing tokens
  // ─────────────────────────────────────────────────────────────

  async changePassword(
    userId: string,
    currentPasswordUnhashed: string | undefined,
    newPasswordUnhashed: string,
  ): Promise<void> {
    const user = await this.usersService.findRawById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    // THE CRITICAL GUARD RAIL:
    if (user.authProvider !== 'GOOGLE' && !currentPasswordUnhashed) {
      throw new BadRequestException('Current password is required for this account type.');
    }

    // Only proceed to bypass if the user is strictly GOOGLE-only
    if (user.authProvider === 'GOOGLE' || !user.passwordHash) {
      const salt = await bcrypt.genSalt(10);
      const newPasswordHash = await bcrypt.hash(newPasswordUnhashed, salt);
      await this.usersService.addPassword(userId, newPasswordHash);
    } else {
      // Compare dto.currentPassword with user.passwordHash using bcrypt
      const isMatch = await bcrypt.compare(currentPasswordUnhashed!, user.passwordHash);
      if (!isMatch) {
        throw new BadRequestException('Current password is incorrect.');
      }

      const salt = await bcrypt.genSalt(10);
      const newPasswordHash = await bcrypt.hash(newPasswordUnhashed, salt);
      await this.usersService.addPassword(userId, newPasswordHash); // Using addPassword since it upgrades to BOTH if needed
    }
  }

  // ─────────────────────────────────────────────────────────────

  private signToken(userId: string, email: string): string {
    const payload: JwtPayload = { sub: userId, email };
    // secret and expiresIn are configured at module level via JwtModule.registerAsync
    return this.jwtService.sign(payload);
  }
}
