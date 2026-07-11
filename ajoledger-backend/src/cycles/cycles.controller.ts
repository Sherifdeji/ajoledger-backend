import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

import { DisburseCycleDto } from './dto/disburse-cycle.dto';
import {
  CreateCycleResult,
  CyclesService,
  DisbursePayoutResult,
} from './cycles.service';

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@ApiTags('Cycles')
@ApiBearerAuth('jwt')
@Controller('groups/:id/cycles')
@UseGuards(JwtAuthGuard)
export class CyclesController {
  constructor(
    private readonly cyclesService: CyclesService,
    private readonly authService: AuthService,
  ) {}

  @Get('current/payment-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Poll the payment status of the current user for the active cycle',
  })
  async getCurrentPaymentStatus(
    @Request() req: RequestWithUser,
    @Param('id') groupId: string,
  ): Promise<{ message: string; data: { status: string } }> {
    const data = await this.cyclesService.getCurrentPaymentStatus(
      req.user.id,
      groupId,
    );
    return { message: 'Payment status retrieved successfully.', data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Start a new savings cycle for a group (Coordinator only)',
  })
  async createCycle(
    @Request() req: RequestWithUser,
    @Param('id') groupId: string,
  ): Promise<{ message: string; data: CreateCycleResult }> {
    const data = await this.cyclesService.createCycle(req.user.id, groupId);
    return { message: 'Savings cycle started successfully.', data };
  }

  @Post(':cycleId/disburse')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Disburse payout to the current round winner (Coordinator only). ' +
      'Requires Transaction PIN. Note: ₦20 network fee is deducted per T&Cs.',
  })
  async disburseCyclePayout(
    @Request() req: RequestWithUser,
    @Param('id') groupId: string,
    @Param('cycleId') cycleId: string,
    @Body() dto: DisburseCycleDto,
  ): Promise<{ message: string; data: DisbursePayoutResult }> {
    // Security gate: Transaction PIN verified before any financial action executes
    await this.authService.verifyTransactionPinForUser(
      req.user.id,
      dto.transactionPin,
    );

    const data = await this.cyclesService.disburseCyclePayout(
      req.user.id,
      groupId,
      cycleId,
    );

    return { message: 'Payout disbursement initiated successfully.', data };
  }
}
