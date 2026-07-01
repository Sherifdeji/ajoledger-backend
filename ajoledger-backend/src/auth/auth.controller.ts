import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SetupTransactionPinDto } from './dto/setup-transaction-pin.dto';
import { VerifyTransactionPinDto } from './dto/verify-transaction-pin.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthenticatedUser } from './strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    const data = await this.authService.register(dto.phone, dto.loginPin);
    return { message: 'Registration successful.', data };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    const data = await this.authService.login(dto.phone, dto.loginPin);
    return { message: 'Login successful.', data };
  }

  @Post('setup-transaction-pin')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
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

  @Post('verify-transaction')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
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
