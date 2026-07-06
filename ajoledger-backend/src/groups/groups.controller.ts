import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { JoinGroupDto } from './dto/join-group.dto';
import { AssignPayoutOrderDto } from './dto/assign-payout-order.dto';

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@ApiTags('Groups')
@ApiBearerAuth('jwt')
@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new savings group and provision its Nomba virtual account' })
  async createGroup(
    @Request() req: RequestWithUser,
    @Body() dto: CreateGroupDto,
  ) {
    const data = await this.groupsService.createGroup(req.user.id, dto);
    return { message: 'Savings group created successfully.', data };
  }

  @Post('join')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Join an existing savings group using an invite code' })
  async joinGroup(
    @Request() req: RequestWithUser,
    @Body() dto: JoinGroupDto,
  ) {
    const data = await this.groupsService.joinGroup(
      req.user.id,
      dto.inviteCode,
    );
    return { message: 'Successfully joined the group.', data };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all groups the authenticated user belongs to' })
  async getUserGroups(@Request() req: RequestWithUser) {
    const data = await this.groupsService.getUserGroups(req.user.id);
    return { message: 'Groups retrieved successfully.', data };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get full details of a specific group' })
  async getGroupDetails(
    @Request() req: RequestWithUser,
    @Param('id') groupId: string,
  ) {
    const data = await this.groupsService.getGroupDetails(req.user.id, groupId);
    return { message: 'Group details retrieved successfully.', data };
  }

  @Patch(':id/payout-order')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin explicitly assigns payout turns to all members' })
  async assignPayoutOrder(
    @Request() req: RequestWithUser,
    @Param('id') groupId: string,
    @Body() dto: AssignPayoutOrderDto,
  ) {
    const data = await this.groupsService.assignPayoutOrder(
      req.user.id,
      groupId,
      dto,
    );
    return { message: 'Payout order assigned successfully.', data };
  }
}
