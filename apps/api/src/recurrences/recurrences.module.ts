import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssignmentModule } from '../assignment/assignment.module';
import { CustomersModule } from '../customers/customers.module';
import { Task } from '../tasks/task.entity';
import { RecurrenceRunLog } from './recurrence-run-log.entity';
import { RecurrenceCalculatorService } from './recurrence-calculator.service';
import { RecurrencesController } from './recurrences.controller';
import { RecurrencesService } from './recurrences.service';
import { TaskRecurrence } from './task-recurrence.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([TaskRecurrence, RecurrenceRunLog, Task]),
    CustomersModule,
    AssignmentModule,
  ],
  controllers: [RecurrencesController],
  providers: [RecurrencesService, RecurrenceCalculatorService],
  exports: [RecurrencesService, RecurrenceCalculatorService, TypeOrmModule],
})
export class RecurrencesModule {}
