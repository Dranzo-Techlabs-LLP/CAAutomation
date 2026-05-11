import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceCatalog } from '../services-catalog/service-catalog.entity';
import { TasksModule } from '../tasks/tasks.module';
import { User } from '../users/user.entity';
import { TimeLog } from './time-log.entity';
import { TimeLogsController } from './time-logs.controller';
import { TimeLogsService } from './time-logs.service';

@Module({
  imports: [TypeOrmModule.forFeature([TimeLog, ServiceCatalog, User]), TasksModule],
  controllers: [TimeLogsController],
  providers: [TimeLogsService],
  exports: [TimeLogsService, TypeOrmModule],
})
export class TimeLogsModule {}
