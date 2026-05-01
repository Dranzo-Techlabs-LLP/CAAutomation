import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksModule } from '../tasks/tasks.module';
import { TimeLog } from './time-log.entity';
import { TimeLogsController } from './time-logs.controller';
import { TimeLogsService } from './time-logs.service';

@Module({
  imports: [TypeOrmModule.forFeature([TimeLog]), TasksModule],
  controllers: [TimeLogsController],
  providers: [TimeLogsService],
  exports: [TimeLogsService, TypeOrmModule],
})
export class TimeLogsModule {}
