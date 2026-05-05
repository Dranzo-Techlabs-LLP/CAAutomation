import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomersModule } from '../customers/customers.module';
import { TasksModule } from '../tasks/tasks.module';
import { EnquiriesController } from './enquiries.controller';
import { EnquiriesService } from './enquiries.service';
import { Enquiry } from './enquiry.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Enquiry]), CustomersModule, forwardRef(() => TasksModule)],
  controllers: [EnquiriesController],
  providers: [EnquiriesService],
  exports: [EnquiriesService, TypeOrmModule],
})
export class EnquiriesModule {}
