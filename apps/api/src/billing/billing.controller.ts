import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequestUser } from '../common/types/request-user';
import { BillingService } from './billing.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { Invoice } from './invoice.entity';
import { Payment } from './payment.entity';

@ApiTags('Billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('invoices')
  @Permissions('billing.view')
  async invoices(@CurrentUser() user: RequestUser): Promise<Invoice[]> {
    return this.billingService.listInvoices(user.firmId);
  }

  @Post('invoices')
  @Permissions('invoice.create')
  async createInvoice(@CurrentUser() user: RequestUser, @Body() dto: CreateInvoiceDto): Promise<Invoice> {
    return this.billingService.createInvoice(user.firmId, dto, user.id);
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
}
