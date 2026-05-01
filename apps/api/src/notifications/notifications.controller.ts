import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequestUser } from '../common/types/request-user';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { Notification } from './notification.entity';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('unread')
  async unread(@CurrentUser() user: RequestUser): Promise<Notification[]> {
    return this.notificationsService.unread(user.firmId, user.id);
  }

  @Post()
  @Permissions('notification.create')
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateNotificationDto): Promise<Notification> {
    return this.notificationsService.create(user.firmId, dto);
  }

  @Patch(':id/read')
  async markRead(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<{ message: string }> {
    await this.notificationsService.markRead(user.firmId, user.id, id);
    return { message: 'Notification marked read' };
  }
}
