import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { NombaService } from '../nomba/nomba.service';
import { UsersService } from './users.service';
import { ResolveAccountDto } from './dto/resolve-account.dto';
import { SetupBankDto } from './dto/setup-bank.dto';
import { UpdatePayoutSettingsDto } from './dto/update-payout-settings.dto';

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@ApiTags('Users')
@ApiBearerAuth('jwt')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly nombaService: NombaService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // Bank utilities
  // ─────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/users/banks
   *
   * Returns the list of supported Nigerian banks (bank code + name).
   * Response is served from an in-memory cache after the first Nomba API call,
   * preventing rate-limit issues on every app load.
   */
  @Get('banks')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get list of supported banks (cached from Nomba)' })
  async getBanks() {
    const data = await this.nombaService.getBanks();
    return { message: 'Bank list retrieved successfully.', data };
  }

  /**
   * POST /api/v1/users/resolve-account
   *
   * Resolves the account name for a given bank code + NUBAN account number.
   * The mobile app should call this BEFORE calling /setup-bank or /payout-settings
   * to display the confirmed account name to the user for verification.
   *
   * Response: { success: true, message: "Account resolved successfully", data: { accountName } }
   */
  @Post('resolve-account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Resolve account name from bank code + account number (call before saving bank details)',
  })
  async resolveAccount(@Body() dto: ResolveAccountDto) {
    const accountName = await this.nombaService.resolveAccount(
      dto.bankCode,
      dto.accountNumber,
    );
    return {
      message: 'Account resolved successfully.',
      data: { accountName },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Payout bank settings
  // ─────────────────────────────────────────────────────────────

  /**
   * POST /api/v1/users/setup-bank  (Onboarding)
   *
   * Saves payout bank details for the first time.
   * If bank details are already configured, returns 400 and instructs the
   * user to use PATCH /payout-settings (which requires a Transaction PIN).
   *
   * No PIN required — this endpoint is intended for the onboarding flow
   * before the user would ever need to protect an existing payout destination.
   *
   * Response (201): { success: true, message: "Bank details configured successfully", data: { ...user } }
   * Response (400): { success: false, message: "Bank details already configured...", data: null }
   */
  @Post('setup-bank')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Save payout bank details for the first time (onboarding — no PIN required)',
  })
  async setupBank(@Request() req: RequestWithUser, @Body() dto: SetupBankDto) {
    const data = await this.usersService.setupBankDetails(req.user.id, dto);
    return { message: 'Bank details configured successfully.', data };
  }

  /**
   * PATCH /api/v1/users/payout-settings  (Profile Update)
   *
   * Updates payout bank details for an existing user.
   * Requires a valid 4-digit Transaction PIN as a security gate — prevents
   * a stolen JWT from silently redirecting future payouts to an attacker's account.
   *
   * Orchestration:
   *   1. AuthService.verifyTransactionPinForUser() — 401 on failure
   *   2. UsersService.updatePayoutSettings()       — DB write on PIN pass
   */
  @Patch('payout-settings')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update payout bank details (Transaction PIN required)',
  })
  async updatePayoutSettings(
    @Request() req: RequestWithUser,
    @Body() dto: UpdatePayoutSettingsDto,
  ) {
    // Security gate — must pass before any DB write occurs
    await this.authService.verifyTransactionPinForUser(
      req.user.id,
      dto.transactionPin,
    );

    const data = await this.usersService.updatePayoutSettings(req.user.id, dto);
    return { message: 'Payout settings updated successfully.', data };
  }
}
