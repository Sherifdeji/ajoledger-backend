import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateCycleDto } from './dto/create-cycle.dto';
import { CreateCycleResult, CyclesService } from './cycles.service';

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@ApiTags('Cycles')
@ApiBearerAuth('jwt')
@Controller('groups/:id/cycles')
@UseGuards(JwtAuthGuard)
export class CyclesController {
  constructor(private readonly cyclesService: CyclesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Start a new savings cycle for a group (Coordinator only)' })
  async createCycle(
    @Request() req: RequestWithUser,
    @Param('id') groupId: string,
    @Body() dto: CreateCycleDto,
  ): Promise<{ message: string; data: CreateCycleResult }> {
    const data = await this.cyclesService.createCycle(req.user.id, groupId, dto);
    return { message: 'Savings cycle started successfully.', data };
  }
}

