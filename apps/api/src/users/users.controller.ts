import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequestUser } from '../common/types/request-user';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersBulkService } from './users.bulk';
import { UsersService } from './users.service';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly bulk: UsersBulkService,
  ) {}

  // ── Bulk operations (declared BEFORE :id catch-all so paths match correctly)
  @Get('bulk/template')
  @Permissions('user.create')
  async downloadTemplate(@CurrentUser() user: RequestUser, @Res() res: Response): Promise<void> {
    const buf = await this.bulk.template(user.firmId);
    res.setHeader('Content-Type', XLSX_MIME);
    res.setHeader('Content-Disposition', 'attachment; filename="users-template.xlsx"');
    res.send(buf);
  }

  @Get('bulk/export')
  @Permissions('user.view')
  async exportData(@CurrentUser() user: RequestUser, @Res() res: Response): Promise<void> {
    const buf = await this.bulk.export(user.firmId);
    res.setHeader('Content-Type', XLSX_MIME);
    res.setHeader('Content-Disposition', `attachment; filename="users-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    res.send(buf);
  }

  @Post('bulk/import')
  @Permissions('user.create')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async importData(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: { buffer: Buffer; mimetype?: string; originalname?: string } | undefined,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('File is required (form field name: file)');
    }
    return this.bulk.import(user.firmId, user.id, file.buffer);
  }

  @Get('me')
  async me(@CurrentUser() user: RequestUser): Promise<UserResponseDto> {
    return this.usersService.getByIdForFirm(user.id, user.firmId);
  }

  @Patch('me/change-password')
  async changeOwnPassword(
    @CurrentUser() user: RequestUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    await this.usersService.changeOwnPassword(user.id, dto.currentPassword, dto.newPassword);
    return { message: 'Password changed successfully' };
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

  @Get('lookup')
  async lookup(@CurrentUser() user: RequestUser): Promise<{ id: string; name: string }[]> {
    const users = await this.usersService.listForFirm(user.firmId);
    return users.map((u) => ({ id: u.id, name: u.name }));
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

  @Patch(':id/rates')
  @Permissions('user.create')
  async updateRates(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { defaultHourlyRate?: string | null; costRate?: string | null },
  ): Promise<UserResponseDto> {
    return this.usersService.updateRates(id, user.firmId, body, user.id);
  }

  @Patch(':id')
  @Permissions('user.create')
  async updateUser(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.updateUser(id, user.firmId, dto, user.id);
  }

  // "Delete" = deactivate (soft) — preserves task/time-log/audit history
  @Delete(':id')
  @Permissions('user.create')
  async deactivate(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<UserResponseDto> {
    return this.usersService.deactivate(id, user.firmId, user.id);
  }
}
