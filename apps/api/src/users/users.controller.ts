import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequestUser } from '../common/types/request-user';
import { CreateUserDto } from './dto/create-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(@CurrentUser() user: RequestUser): Promise<UserResponseDto> {
    return this.usersService.getByIdForFirm(user.id, user.firmId);
  }

  @Post()
  @Permissions('user.create')
  async create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.createForFirm(user.firmId, dto, user.id);
  }

  @Get()
  @Permissions('user.view')
  async list(@CurrentUser() user: RequestUser): Promise<UserResponseDto[]> {
    return this.usersService.listForFirm(user.firmId);
  }

  @Get(':id')
  @Permissions('user.view')
  async getOne(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<UserResponseDto> {
    return this.usersService.getByIdForFirm(id, user.firmId);
  }

  @Patch(':id/reset-password')
  @Permissions('user.create')
  async resetPassword(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    await this.usersService.resetPassword(id, user.firmId, dto.newPassword);
    return { message: 'Password reset successfully' };
  }
}
