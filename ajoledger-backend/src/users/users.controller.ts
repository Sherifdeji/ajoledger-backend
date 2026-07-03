import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { UsersService } from './users.service';
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
  ) {}

  /**
   * PATCH /api/v1/users/payout-settings
   *
   * Security gate: Transaction PIN is verified before any data is written.
   * Orchestration order:
   *   1. AuthService.verifyTransactionPinForUser() — throws 401 if PIN is wrong
   *   2. UsersService.updatePayoutSettings()       — pure DB write, only if PIN passed
   *
   * This keeps business logic (PIN verification) in AuthService and
   * data access (DB write) in UsersService, consistent with the rest of the system.
   */
  @Patch('payout-settings')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Save payout bank account details (Transaction PIN required)',
  })
  async updatePayoutSettings(
    @Request() req: RequestWithUser,
    @Body() dto: UpdatePayoutSettingsDto,
  ) {
    // Step 1 — Authenticate the financial intent with the Transaction PIN.
    // verifyTransactionPinForUser() throws UnauthorizedException on failure,
    // which propagates through the global HttpExceptionFilter automatically.
    await this.authService.verifyTransactionPinForUser(req.user.id, dto.pin);

    // Step 2 — PIN verified. Persist the bank details.
    const data = await this.usersService.updatePayoutSettings(req.user.id, dto);

    return { message: 'Payout settings updated successfully.', data };
  }
}
