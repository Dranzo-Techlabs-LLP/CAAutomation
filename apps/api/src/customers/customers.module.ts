import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Customer } from './customer.entity';
import { CustomersBulkService } from './customers.bulk';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  imports: [TypeOrmModule.forFeature([Customer, User])],
  controllers: [CustomersController],
  providers: [CustomersService, CustomersBulkService],
  exports: [CustomersService, TypeOrmModule],
})
export class CustomersModule {}
