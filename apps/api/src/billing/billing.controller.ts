import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequestUser } from '../common/types/request-user';
import { BillingService } from './billing.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreatePaymentAdviceDto } from './dto/create-payment-advice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { Invoice } from './invoice.entity';
import { PaymentAdvice, PaymentAdviceType } from './payment-advice.entity';
import { Payment } from './payment.entity';

@ApiTags('Billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // Invoices
  @Get('invoices')
  @Permissions('billing.view')
  async invoices(@CurrentUser() user: RequestUser): Promise<Invoice[]> {
    return this.billingService.listInvoices(user.firmId);
  }

  @Get('invoices/:id')
  @Permissions('billing.view')
  async getInvoice(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.billingService.getInvoiceWithLineItems(user.firmId, id);
  }

  @Post('invoices')
  @Permissions('invoice.create')
  async createInvoice(@CurrentUser() user: RequestUser, @Body() dto: CreateInvoiceDto): Promise<Invoice> {
    return this.billingService.createInvoice(user.firmId, dto, user.id);
  }

  // Payments
  @Get('invoices/:id/payments')
  @Permissions('billing.view')
  async listPayments(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<Payment[]> {
    return this.billingService.listPaymentsForInvoice(user.firmId, id);
  }

  @Post('invoices/:id/payments')
  @Permissions('payment.create')
  async recordPayment(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: RecordPaymentDto,
  ): Promise<Payment> {
    return this.billingService.recordPayment(user.firmId, id, dto, user.id);
  }

  // Payment Advices
  @Get('payment-advices')
  @Permissions('billing.view')
  async listAdvices(
    @CurrentUser() user: RequestUser,
    @Query('type') type?: PaymentAdviceType,
  ): Promise<PaymentAdvice[]> {
    return this.billingService.listPaymentAdvices(user.firmId, type);
  }

  @Get('payment-advices/:id')
  @Permissions('billing.view')
  async getAdvice(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<PaymentAdvice> {
    return this.billingService.getPaymentAdvice(user.firmId, id);
  }

  @Post('payment-advices')
  @Permissions('payment.create')
  async createAdvice(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreatePaymentAdviceDto,
  ): Promise<PaymentAdvice> {
    return this.billingService.createPaymentAdvice(user.firmId, dto, user.id);
  }
}
