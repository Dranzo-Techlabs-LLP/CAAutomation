import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from '../customers/customer.entity';
import { Firm } from '../common/entities/firm.entity';
import { ServiceCatalog } from '../services-catalog/service-catalog.entity';
import { Task } from '../tasks/task.entity';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { InvoiceLineItem } from './invoice-line-item.entity';
import { Invoice } from './invoice.entity';
import { PaymentAdvice } from './payment-advice.entity';
import { Payment } from './payment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, InvoiceLineItem, Payment, PaymentAdvice, Customer, Firm, Task, ServiceCatalog])],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService, TypeOrmModule],
})
export class BillingModule {}
