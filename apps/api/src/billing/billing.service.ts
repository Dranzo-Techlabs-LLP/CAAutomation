import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Customer } from '../customers/customer.entity';
import { Firm } from '../common/entities/firm.entity';
import { ServiceCatalog } from '../services-catalog/service-catalog.entity';
import { Task, TaskGeneratedBy, TaskPriority, TaskStatus } from '../tasks/task.entity';
import { applyRoundOff, rupeesToWords, splitGstForLine, stateCodeFromGstin } from './billing.utils';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreatePaymentAdviceDto } from './dto/create-payment-advice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { InvoiceLineItem } from './invoice-line-item.entity';
import { GstTreatment, Invoice, InvoiceStatus } from './invoice.entity';
import { PaymentAdvice, PaymentAdviceStatus, PaymentAdviceType } from './payment-advice.entity';
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
    @InjectRepository(PaymentAdvice)
    private readonly paymentAdviceRepository: Repository<PaymentAdvice>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Firm)
    private readonly firmRepository: Repository<Firm>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(ServiceCatalog)
    private readonly serviceRepository: Repository<ServiceCatalog>,
  ) {}

  // ── Invoices ──────────────────────────────────────────────────────────────

  async createInvoice(firmId: string, dto: CreateInvoiceDto, actorUserId: string): Promise<Invoice> {
    if (!dto.lineItems?.length) {
      throw new BadRequestException('At least one line item is required');
    }
    const firm = await this.firmRepository.findOne({ where: { id: firmId } });
    if (!firm) throw new NotFoundException('Firm not found');
    const customer = await this.customerRepository.findOne({ where: { id: dto.customerId, firmId } });
    if (!customer) throw new NotFoundException('Customer not found');

    const supplierState = stateCodeFromGstin(firm.gstin) || firm.stateCode || null;
    const customerState = stateCodeFromGstin(customer.gstin);
    const placeOfSupply = (dto.placeOfSupply || customerState || supplierState || '').slice(0, 5) || null;

    const treatment = dto.gstTreatment || GstTreatment.Regular;
    // Export / SEZ → IGST regardless of state codes
    const forceIgst = treatment === GstTreatment.Export || treatment === GstTreatment.ExportWithPayment || treatment === GstTreatment.Sez || (placeOfSupply !== null && supplierState !== null && placeOfSupply !== supplierState);

    let subtotal = 0;
    let cgstSum = 0;
    let sgstSum = 0;
    let igstSum = 0;
    let cessSum = 0;

    const linesPrepared = dto.lineItems.map((item) => {
      const qty = Number(item.quantity);
      const ratePaise = Number(item.rate);
      const taxableValue = Number(item.amount) || Math.round(qty * ratePaise);
      const gstRate = treatment === GstTreatment.Composition || treatment === GstTreatment.Export ? 0 : Number(item.gstRate ?? '18');
      const cessRate = Number(item.cessRate ?? '0');
      const split = splitGstForLine(taxableValue, gstRate, supplierState, placeOfSupply, forceIgst);
      const cessAmount = cessRate > 0 ? Math.round((taxableValue * cessRate) / 100) : 0;
      subtotal += taxableValue;
      cgstSum += split.cgst;
      sgstSum += split.sgst;
      igstSum += split.igst;
      cessSum += cessAmount;
      return {
        ...item,
        qty,
        ratePaise,
        taxableValue,
        gstRate,
        cessRate,
        cessAmount,
        ...split,
      };
    });

    const totalBeforeTds = subtotal + cgstSum + sgstSum + igstSum + cessSum;
    const tdsRate = Number(dto.tdsRate ?? '0');
    const tdsPaise = tdsRate > 0 ? Math.round((subtotal * tdsRate) / 100) : 0; // TDS on taxable value (excl GST) per common practice
    const grossPayable = totalBeforeTds - tdsPaise;
    const { rounded, roundOff } = applyRoundOff(grossPayable);

    const invoiceNo = await this.nextInvoiceNo(firmId);
    const amountInWords = rupeesToWords(rounded / 100);

    const invoice = await this.invoiceRepository.save(
      this.invoiceRepository.create({
        firmId,
        customerId: dto.customerId,
        invoiceNo,
        issueDate: dto.issueDate.slice(0, 10),
        dueDate: dto.dueDate.slice(0, 10),
        currency: 'INR',
        subtotal: String(subtotal),
        cgst: String(cgstSum),
        sgst: String(sgstSum),
        igst: String(igstSum),
        cess: String(cessSum),
        tdsPaise: String(tdsPaise),
        tdsSection: dto.tdsSection ?? null,
        tdsRate: String(tdsRate),
        roundOff: String(roundOff),
        total: String(rounded),
        gstTreatment: treatment,
        placeOfSupply,
        reverseCharge: dto.reverseCharge ?? false,
        customerGstinSnapshot: customer.gstin ?? null,
        customerStateCode: customerState,
        customerNameSnapshot: customer.name,
        customerAddressSnapshot: customer.address ?? null,
        amountInWords,
        notes: dto.notes,
        terms: dto.terms,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      }),
    );

    await this.lineItemRepository.save(
      linesPrepared.map((line) =>
        this.lineItemRepository.create({
          invoiceId: invoice.id,
          taskId: line.taskId,
          serviceId: line.serviceId,
          description: line.description,
          quantity: line.quantity,
          rate: line.rate,
          amount: line.amount,
          hsnSac: line.hsnSac,
          gstRate: String(line.gstRate),
          cessRate: String(line.cessRate),
          cgstAmount: String(line.cgst),
          sgstAmount: String(line.sgst),
          igstAmount: String(line.igst),
          cessAmount: String(line.cessAmount),
        }),
      ),
    );
    return invoice;
  }

  async listInvoices(firmId: string): Promise<Invoice[]> {
    return this.invoiceRepository.find({ where: { firmId }, order: { issueDate: 'DESC' }, take: 200 });
  }

  // ── Billing pipeline ────────────────────────────────────────────────────

  /**
   * Stage 1 — INVOICE PENDING (automatic).
   * Completed, billable tasks that are not yet on any invoice line item.
   * These are "work done, awaiting invoice".
   */
  async listInvoicePending(firmId: string): Promise<
    Array<{
      taskId: string;
      title: string;
      customerId: string;
      customerName: string;
      serviceId: string | null;
      serviceName: string | null;
      completedAt: Date | null;
      estimatedHours: string | null;
      suggestedAmountPaise: string | null;
    }>
  > {
    // Tasks already billed = those referenced by an invoice line item.
    const billedRows = await this.lineItemRepository
      .createQueryBuilder('li')
      .innerJoin(Invoice, 'inv', 'inv.id = li.invoice_id AND inv.firm_id = :firmId', { firmId })
      .select('DISTINCT li.task_id', 'taskId')
      .where('li.task_id IS NOT NULL')
      .getRawMany<{ taskId: string }>();
    const billedTaskIds = new Set(billedRows.map((r) => r.taskId).filter(Boolean));

    const completed = await this.taskRepository.find({
      where: { firmId, status: TaskStatus.Completed, billable: true },
      order: { completedAt: 'DESC' },
      take: 500,
    });
    const pending = completed.filter((t) => !billedTaskIds.has(t.id));
    if (!pending.length) return [];

    const custIds = Array.from(new Set(pending.map((t) => t.customerId).filter(Boolean)));
    const svcIds = Array.from(new Set(pending.map((t) => t.serviceId).filter(Boolean) as string[]));
    const custs = custIds.length ? await this.customerRepository.find({ where: { firmId, id: In(custIds) } }) : [];
    const svcs = svcIds.length ? await this.serviceRepository.find({ where: { firmId, id: In(svcIds) } }) : [];
    const custName = new Map(custs.map((c) => [c.id, c.name]));
    const svc = new Map(svcs.map((s) => [s.id, s]));

    return pending.map((t) => {
      const service = t.serviceId ? svc.get(t.serviceId) : undefined;
      // Suggested amount: explicit task billing amount, else hours × rate (task → service).
      let suggested: string | null = t.billingAmount ?? null;
      if (!suggested) {
        const ratePaise = Number(t.hourlyRate ?? service?.defaultHourlyRate ?? 0);
        const hrs = Number(t.estimatedHours ?? 0);
        if (ratePaise > 0 && hrs > 0) suggested = String(Math.round(ratePaise * hrs));
      }
      return {
        taskId: t.id,
        title: t.title,
        customerId: t.customerId,
        customerName: custName.get(t.customerId) ?? 'Unknown',
        serviceId: t.serviceId ?? null,
        serviceName: service?.name ?? null,
        completedAt: t.completedAt ?? null,
        estimatedHours: t.estimatedHours ?? null,
        suggestedAmountPaise: suggested,
      };
    });
  }

  /**
   * Stage 3 — PAYMENT PENDING.
   * Invoices that are issued but not fully paid (and not cancelled/draft).
   * Returns outstanding balance + any collections follow-up set.
   */
  async listPaymentPending(firmId: string): Promise<
    Array<Invoice & { paidPaise: number; balancePaise: number; customerName: string }>
  > {
    const open = await this.invoiceRepository.find({
      where: {
        firmId,
        status: In([InvoiceStatus.Sent, InvoiceStatus.PartiallyPaid, InvoiceStatus.Overdue]),
      },
      order: { dueDate: 'ASC' },
      take: 300,
    });
    if (!open.length) return [];
    const custIds = Array.from(new Set(open.map((i) => i.customerId).filter(Boolean)));
    const custs = custIds.length ? await this.customerRepository.find({ where: { firmId, id: In(custIds) } }) : [];
    const custName = new Map(custs.map((c) => [c.id, c.name]));
    const out: Array<Invoice & { paidPaise: number; balancePaise: number; customerName: string }> = [];
    for (const inv of open) {
      const paid = await this.totalPaid(inv.id);
      out.push(Object.assign(inv, {
        paidPaise: paid,
        balancePaise: Math.max(0, Number(inv.total) - paid),
        customerName: custName.get(inv.customerId) ?? 'Unknown',
      }));
    }
    return out;
  }

  /**
   * Collections follow-up — record a callback date + note on an unpaid invoice
   * and generate a task for the accountant on that date so it surfaces in their
   * Task view.
   */
  async setFollowUp(
    firmId: string,
    invoiceId: string,
    dto: { date: string; note?: string; assignToUserId?: string },
    actorUserId: string,
  ): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({ where: { firmId, id: invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    invoice.followUpDate = dto.date.slice(0, 10);
    invoice.followUpNote = dto.note ?? null;
    invoice.updatedBy = actorUserId;
    await this.invoiceRepository.save(invoice);

    const assignee = dto.assignToUserId || actorUserId;
    const custName = invoice.customerNameSnapshot
      || (await this.customerRepository.findOne({ where: { firmId, id: invoice.customerId } }))?.name
      || 'client';
    const due = new Date(dto.date.slice(0, 10) + 'T09:00:00');
    await this.taskRepository.save(
      this.taskRepository.create({
        firmId,
        customerId: invoice.customerId,
        serviceId: null,
        title: `Call client — payment follow-up: ${custName}`,
        description:
          `Invoice ${invoice.invoiceNo} (₹${(Number(invoice.total) / 100).toLocaleString('en-IN')}) ` +
          `payment pending.${dto.note ? ` Note: ${dto.note}` : ''}`,
        priority: TaskPriority.High,
        status: assignee ? TaskStatus.Assigned : TaskStatus.Unassigned,
        assignedToUserId: assignee,
        dueDate: due,
        billable: false,
        generatedBy: TaskGeneratedBy.Manual,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      }),
    );
    return invoice;
  }

  async getInvoiceWithLineItems(firmId: string, invoiceId: string): Promise<Invoice & { lineItems: InvoiceLineItem[] }> {
    const invoice = await this.invoiceRepository.findOne({ where: { firmId, id: invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    const lineItems = await this.lineItemRepository.find({ where: { invoiceId } });
    return { ...invoice, lineItems };
  }

  // ── Payments (against invoice) ────────────────────────────────────────────

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

  async listPaymentsForInvoice(firmId: string, invoiceId: string): Promise<Payment[]> {
    const invoice = await this.invoiceRepository.findOne({ where: { firmId, id: invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return this.paymentRepository.find({ where: { invoiceId }, order: { paidOn: 'DESC' } });
  }

  private async totalPaid(invoiceId: string): Promise<number> {
    const payments = await this.paymentRepository.find({ where: { invoiceId } });
    return payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  }

  // ── Payment Advices ───────────────────────────────────────────────────────

  async createPaymentAdvice(firmId: string, dto: CreatePaymentAdviceDto, actorUserId: string): Promise<PaymentAdvice> {
    const gross = Number(dto.grossAmount);
    if (!Number.isFinite(gross) || gross < 0) throw new BadRequestException('Invalid gross amount');
    const tds = Number(dto.tdsAmount ?? '0');
    const otherDed = Number(dto.otherDeductions ?? '0');
    const net = gross - tds - otherDed;
    if (net < 0) throw new BadRequestException('Net amount cannot be negative');

    let partyName = dto.partyName ?? null;
    let partyGstin = dto.partyGstin ?? null;
    let partyPan = dto.partyPan ?? null;
    let partyAddress = dto.partyAddress ?? null;

    if (dto.customerId) {
      const customer = await this.customerRepository.findOne({ where: { id: dto.customerId, firmId } });
      if (!customer) throw new NotFoundException('Customer not found');
      partyName = partyName ?? customer.name;
      partyGstin = partyGstin ?? customer.gstin ?? null;
      partyPan = partyPan ?? customer.pan ?? null;
      partyAddress = partyAddress ?? customer.address ?? null;
    }

    if (dto.invoiceId) {
      const invoice = await this.invoiceRepository.findOne({ where: { id: dto.invoiceId, firmId } });
      if (!invoice) throw new NotFoundException('Linked invoice not found');
    }

    const advice = await this.paymentAdviceRepository.save(
      this.paymentAdviceRepository.create({
        firmId,
        adviceNo: await this.nextAdviceNo(firmId),
        adviceDate: dto.adviceDate.slice(0, 10),
        type: dto.type,
        customerId: dto.customerId ?? null,
        partyName,
        partyGstin,
        partyPan,
        partyAddress,
        invoiceId: dto.invoiceId ?? null,
        grossAmount: String(gross),
        tdsAmount: String(tds),
        tdsSection: dto.tdsSection ?? null,
        tdsRate: String(Number(dto.tdsRate ?? '0')),
        otherDeductions: String(otherDed),
        netAmount: String(net),
        mode: dto.mode,
        referenceNo: dto.referenceNo ?? null,
        bankName: dto.bankName ?? null,
        transactionDate: dto.transactionDate ? dto.transactionDate.slice(0, 10) : null,
        narration: dto.narration ?? null,
        status: PaymentAdviceStatus.Issued,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      }),
    );

    // Auto-record payment against invoice if linked & received
    if (dto.invoiceId && dto.type === PaymentAdviceType.Received) {
      await this.recordPayment(
        firmId,
        dto.invoiceId,
        { paidOn: advice.adviceDate, amount: String(net), mode: advice.mode, referenceNo: advice.referenceNo ?? undefined },
        actorUserId,
      );
    }

    return advice;
  }

  async listPaymentAdvices(firmId: string, type?: PaymentAdviceType): Promise<PaymentAdvice[]> {
    return this.paymentAdviceRepository.find({
      where: type ? { firmId, type } : { firmId },
      order: { adviceDate: 'DESC' },
      take: 200,
    });
  }

  async getPaymentAdvice(firmId: string, id: string): Promise<PaymentAdvice> {
    const advice = await this.paymentAdviceRepository.findOne({ where: { firmId, id } });
    if (!advice) throw new NotFoundException('Payment advice not found');
    return advice;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async nextInvoiceNo(firmId: string): Promise<string> {
    const firm = await this.firmRepository.findOne({ where: { id: firmId } });
    const cfg = (firm?.settingsJson?.invoiceNumberFormat ?? {}) as InvoiceNumberFormat;
    const count = await this.countDocs(firmId, 'invoice', !!cfg.resetOnFy);
    return formatDocNumber(count + 1, 'INV', cfg);
  }

  private async nextAdviceNo(firmId: string): Promise<string> {
    const firm = await this.firmRepository.findOne({ where: { id: firmId } });
    const cfg = (firm?.settingsJson?.paymentAdviceNumberFormat ?? firm?.settingsJson?.invoiceNumberFormat ?? {}) as InvoiceNumberFormat;
    const count = await this.countDocs(firmId, 'advice', !!cfg.resetOnFy);
    return formatDocNumber(count + 1, 'PA', cfg);
  }

  private async countDocs(firmId: string, kind: 'invoice' | 'advice', resetOnFy: boolean): Promise<number> {
    if (!resetOnFy) {
      return kind === 'invoice'
        ? this.invoiceRepository.count({ where: { firmId } })
        : this.paymentAdviceRepository.count({ where: { firmId } });
    }
    const { fyStart, fyEnd } = currentFyRange();
    if (kind === 'invoice') {
      return this.invoiceRepository.createQueryBuilder('i')
        .where('i.firm_id = :firmId', { firmId })
        .andWhere('i.issue_date >= :fyStart', { fyStart })
        .andWhere('i.issue_date <= :fyEnd', { fyEnd })
        .getCount();
    }
    return this.paymentAdviceRepository.createQueryBuilder('p')
      .where('p.firm_id = :firmId', { firmId })
      .andWhere('p.advice_date >= :fyStart', { fyStart })
      .andWhere('p.advice_date <= :fyEnd', { fyEnd })
      .getCount();
  }
}

interface InvoiceNumberFormat {
  prefix?: string;       // e.g. "TBM-"
  suffix?: string;       // e.g. "/A"
  separator?: string;    // default "/"
  includeFy?: boolean;   // include FY26-27 segment, default true
  fyFormat?: 'short' | 'long'; // FY26-27 vs FY2026-2027
  padding?: number;      // pad serial to N digits, default 4
  resetOnFy?: boolean;   // restart counter each FY, default true
  startFrom?: number;    // first serial, default 1
  seriesCode?: string;   // override default 'INV' / 'PA' for invoices/advices respectively
}

function currentFyRange(): { fyStart: string; fyEnd: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const startYear = m >= 3 ? y : y - 1;
  return {
    fyStart: `${startYear}-04-01`,
    fyEnd: `${startYear + 1}-03-31`,
  };
}

function formatDocNumber(serial: number, kind: 'INV' | 'PA', cfg: InvoiceNumberFormat): string {
  const sep = cfg.separator ?? '/';
  const padding = cfg.padding ?? 4;
  const startFrom = cfg.startFrom ?? 1;
  const effective = serial + (startFrom - 1);
  const padded = String(effective).padStart(padding, '0');
  const parts: string[] = [];
  if (cfg.includeFy !== false) {
    const now = new Date();
    const startYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
    const endYear = startYear + 1;
    const fy = cfg.fyFormat === 'long'
      ? `FY${startYear}-${endYear}`
      : `FY${String(startYear).slice(2)}-${String(endYear).slice(2)}`;
    parts.push(fy);
  }
  const code = kind === 'INV'
    ? (cfg.seriesCode !== undefined ? cfg.seriesCode : 'INV')
    : 'PA';
  if (code) parts.push(code);
  parts.push(padded);
  let no = parts.join(sep);
  if (cfg.prefix) no = `${cfg.prefix}${no}`;
  if (cfg.suffix) no = `${no}${cfg.suffix}`;
  return no;
}
