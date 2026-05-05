import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequestUser } from '../common/types/request-user';
import { CreateTeamDto } from './dto/create-team.dto';
import { TeamResponseDto } from './dto/team-response.dto';
import { TeamsService } from './teams.service';

@ApiTags('Teams')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  @Permissions('team.view')
  async list(@CurrentUser() user: RequestUser): Promise<TeamResponseDto[]> {
    return this.teamsService.list(user.firmId);
  }

  @Post()
  @Permissions('team.create')
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateTeamDto): Promise<TeamResponseDto> {
    return this.teamsService.create(user.firmId, dto, user.id);
  }

  @Patch(':id')
  @Permissions('team.create')
  async update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: Partial<CreateTeamDto>): Promise<TeamResponseDto> {
    return this.teamsService.update(user.firmId, id, dto, user.id);
  }

  @Delete(':id')
  @Permissions('team.create')
  async delete(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<{ deleted: boolean }> {
    await this.teamsService.delete(user.firmId, id);
    return { deleted: true };
  }
}
