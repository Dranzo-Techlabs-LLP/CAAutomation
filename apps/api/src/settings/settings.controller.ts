import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequestUser } from '../common/types/request-user';
import { Firm } from '../common/entities/firm.entity';
import { UpdateFirmDto } from './dto/update-firm.dto';
import { SettingsService } from './settings.service';

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Permissions('settings.edit')
  async get(@CurrentUser() user: RequestUser): Promise<Firm> {
    return this.settingsService.getFirm(user.firmId);
  }

  @Patch()
  @Permissions('settings.edit')
  async update(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateFirmDto,
  ): Promise<Firm> {
    return this.settingsService.updateFirm(user.firmId, dto, user.id);
  }
}
