import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { Notification } from './notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  async create(firmId: string, dto: CreateNotificationDto): Promise<Notification> {
    return this.notificationRepository.save(this.notificationRepository.create({ firmId, ...dto }));
  }

  async unread(firmId: string, userId: string): Promise<Notification[]> {
    return this.notificationRepository.find({
      where: { firmId, userId, readAt: IsNull() },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async markRead(firmId: string, userId: string, id: string): Promise<void> {
    await this.notificationRepository.update({ firmId, userId, id }, { readAt: new Date() });
  }
}
