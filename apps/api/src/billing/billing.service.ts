import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { InvoiceLineItem } from './invoice-line-item.entity';
import { Invoice, InvoiceStatus } from './invoice.entity';
import { Payment } from './payment.entity';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceLineItem)
    private readonly lineItemRepository: Repository<InvoiceLineItem>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {}

  async createInvoice(firmId: string, dto: CreateInvoiceDto, actorUserId: string): Promise<Invoice> {
    const subtotal = dto.lineItems.reduce((sum, item) => sum + Number(item.amount), 0);
    const cgst = Math.round(subtotal * 0.09);
    const sgst = Math.round(subtotal * 0.09);
    const total = subtotal + cgst + sgst;
    const invoice = await this.invoiceRepository.save(
      this.invoiceRepository.create({
        firmId,
        customerId: dto.customerId,
        invoiceNo: await this.nextInvoiceNo(firmId),
        issueDate: dto.issueDate.slice(0, 10),
        dueDate: dto.dueDate.slice(0, 10),
        subtotal: String(subtotal),
        cgst: String(cgst),
        sgst: String(sgst),
        igst: '0',
        total: String(total),
        notes: dto.notes,
        terms: dto.terms,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      }),
    );
    await this.lineItemRepository.save(
      dto.lineItems.map((item) =>
        this.lineItemRepository.create({
          invoiceId: invoice.id,
          taskId: item.taskId,
          serviceId: item.serviceId,
          description: item.description,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount,
          hsnSac: item.hsnSac,
        }),
      ),
    );
    return invoice;
  }

  async listInvoices(firmId: string): Promise<Invoice[]> {
    return this.invoiceRepository.find({ where: { firmId }, order: { issueDate: 'DESC' }, take: 100 });
  }

  async getInvoiceWithLineItems(firmId: string, invoiceId: string): Promise<Invoice & { lineItems: InvoiceLineItem[] }> {
    const invoice = await this.invoiceRepository.findOne({ where: { firmId, id: invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    const lineItems = await this.lineItemRepository.find({ where: { invoiceId } });
    return { ...invoice, lineItems };
  }

  async recordPayment(firmId: string, invoiceId: string, dto: RecordPaymentDto, actorUserId: string): Promise<Payment> {
    const invoice = await this.invoiceRepository.findOne({ where: { firmId, id: invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    const payment = await this.paymentRepository.save(
      this.paymentRepository.create({
        invoiceId,
        paidOn: dto.paidOn.slice(0, 10),
        amount: dto.amount,
        mode: dto.mode,
        referenceNo: dto.referenceNo,
        recordedByUserId: actorUserId,
      }),
    );
    const paid = await this.totalPaid(invoiceId);
    invoice.status = paid >= Number(invoice.total) ? InvoiceStatus.Paid : InvoiceStatus.PartiallyPaid;
    invoice.updatedBy = actorUserId;
    await this.invoiceRepository.save(invoice);
    return payment;
  }

  private async totalPaid(invoiceId: string): Promise<number> {
    const payments = await this.paymentRepository.find({ where: { invoiceId } });
    return payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  }

  private async nextInvoiceNo(firmId: string): Promise<string> {
    const now = new Date();
    const fyStartYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
    const fy = `FY${String(fyStartYear).slice(2)}-${String(fyStartYear + 1).slice(2)}`;
    const count = await this.invoiceRepository.count({ where: { firmId } });
    return `${fy}/${String(count + 1).padStart(4, '0')}`;
  }
}
