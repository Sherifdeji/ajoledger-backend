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
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { JoinGroupDto } from './dto/join-group.dto';

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

  @Post(':id/join')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Join an existing savings group using an invite code' })
  async joinGroup(
    @Request() req: RequestWithUser,
    @Param('id') groupId: string,
    @Body() dto: JoinGroupDto,
  ) {
    const data = await this.groupsService.joinGroup(
      req.user.id,
      groupId,
      dto.inviteCode,
    );
    return { message: 'Successfully joined the group.', data };
  }
}

