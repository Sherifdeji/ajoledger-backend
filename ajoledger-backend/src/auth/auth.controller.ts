import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SetupTransactionPinDto } from './dto/setup-transaction-pin.dto';
import { VerifyTransactionPinDto } from './dto/verify-transaction-pin.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthenticatedUser } from './strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user account' })
  async register(@Body() dto: RegisterDto) {
    const data = await this.authService.register(dto.email, dto.password);
    return { message: 'Registration successful.', data };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and receive a JWT access token' })
  async login(@Body() dto: LoginDto) {
    const data = await this.authService.login(dto.email, dto.password);
    return { message: 'Login successful.', data };
  }

  @Patch('password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change user password' })
  async changePassword(
    @Request() req: RequestWithUser,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(
      req.user.id,
      dto.currentPassword,
      dto.newPassword,
    );
    return { message: 'Password changed successfully.', data: null };
  }

  // ── Transaction PIN endpoints — untouched by the email/password pivot ──

  @Post('setup-transaction-pin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set up a 4-digit Transaction PIN for the authenticated user',
  })
  async setupTransactionPin(
    @Request() req: RequestWithUser,
    @Body() dto: SetupTransactionPinDto,
  ) {
    const data = await this.authService.setupTransactionPin(
      req.user.id,
      dto.transactionPin,
    );
    return { message: 'Transaction PIN configured successfully.', data };
  }

  @Post('verify-transaction-pin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify the Transaction PIN (UI pre-flight check)' })
  async verifyTransaction(
    @Request() req: RequestWithUser,
    @Body() dto: VerifyTransactionPinDto,
  ) {
    const data = await this.authService.verifyTransactionPin(
      req.user.id,
      dto.transactionPin,
    );
    return { message: 'Transaction PIN verified.', data };
  }
}
