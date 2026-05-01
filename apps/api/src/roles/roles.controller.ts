import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequestUser } from '../common/types/request-user';
import { CreateRoleDto } from './dto/create-role.dto';
import { RoleResponseDto } from './dto/role-response.dto';
import { SetRolePermissionsDto } from './dto/set-role-permissions.dto';
import { RolesService } from './roles.service';

@ApiTags('Roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Permissions('role.view')
  async list(@CurrentUser() user: RequestUser): Promise<RoleResponseDto[]> {
    return this.rolesService.listForFirm(user.firmId);
  }

  @Post()
  @Permissions('role.create')
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateRoleDto): Promise<RoleResponseDto> {
    return this.rolesService.create(user.firmId, dto, user.id);
  }

  @Patch(':id/permissions')
  @Permissions('role.edit')
  async setPermissions(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: SetRolePermissionsDto,
  ): Promise<RoleResponseDto> {
    return this.rolesService.setPermissions(user.firmId, id, dto.permissionIds, user.id);
  }
}
