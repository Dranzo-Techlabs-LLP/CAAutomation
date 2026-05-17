import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ColumnSpec, buildExport, buildTemplate, parseUpload } from '../common/excel/excel.util';
import { User } from '../users/user.entity';
import { Customer, CustomerStatus, CustomerType, EnquirySource } from './customer.entity';

const CUSTOMER_COLUMNS: ColumnSpec[] = [
  { key: 'name',          header: 'Name',           required: true,  example: 'Acme Pvt Ltd' },
  { key: 'type',          header: 'Type',           required: true,  enumValues: Object.values(CustomerType), example: 'company' },
  { key: 'email',         header: 'Email',          example: 'finance@acme.in' },
  { key: 'contactNo',     header: 'Contact No',     example: '+91 98765 43210' },
  { key: 'gstin',         header: 'GSTIN',          example: '29AAACS1234B1Z5' },
  { key: 'pan',           header: 'PAN',            example: 'AAACS1234B' },
  { key: 'address',       header: 'Address',        example: 'Plot 14, MG Road, Bengaluru' },
  { key: 'enquirySource', header: 'Enquiry Source', required: true, enumValues: Object.values(EnquirySource), example: 'referral' },
  { key: 'status',        header: 'Status',         enumValues: Object.values(CustomerStatus), example: 'enquiry' },
  { key: 'briefText',     header: 'Brief / Notes',  example: 'Annual GST + ITR engagement' },
  { key: 'ownerEmail',    header: 'Owner Email',    note: 'Existing user email (looked up to set owner_user_id). Optional.', example: 'partner@example.com' },
];

const INSTRUCTIONS = [
  'Required columns: Name, Type, Enquiry Source.',
  'Rows are matched to existing customers by Email (case-insensitive). Matched rows are UPDATED; new rows are CREATED.',
  'If you want every row created as new, leave Email blank (a customer with no email cannot be matched).',
  'Owner Email must reference an existing active user in your firm. Blank Owner Email keeps the existing owner (on update) or assigns the importer (on create).',
  'Status defaults to "enquiry" when blank. Setting status to onboarded/active records the onboarding timestamp automatically.',
  'Delete the example row (row 2) before importing — only data rows are processed.',
];

export interface BulkResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: { row: number; reason: string; data?: Record<string, unknown> }[];
}

@Injectable()
export class CustomersBulkService {
  constructor(
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  template(): Promise<Buffer> {
    return buildTemplate({
      sheetName: 'Customers',
      columns: CUSTOMER_COLUMNS,
      instructions: INSTRUCTIONS,
    });
  }

  async export(firmId: string): Promise<Buffer> {
    const rows = await this.customers.find({
      where: { firmId },
      order: { updatedAt: 'DESC' },
    });
    const userIds = Array.from(new Set(rows.map((r) => r.ownerUserId).filter(Boolean) as string[]));
    const owners = userIds.length
      ? await this.users.find({ where: { firmId, id: In(userIds) } })
      : [];
    const ownerById = new Map(owners.map((u) => [u.id, u.email]));
    const exportRows = rows.map((c) => ({
      name: c.name,
      type: c.type,
      email: c.email ?? '',
      contactNo: c.contactNo ?? '',
      gstin: c.gstin ?? '',
      pan: c.pan ?? '',
      address: c.address ?? '',
      enquirySource: c.enquirySource,
      status: c.status,
      briefText: c.briefText ?? '',
      ownerEmail: c.ownerUserId ? ownerById.get(c.ownerUserId) ?? '' : '',
    }));
    return buildExport({ sheetName: 'Customers', columns: CUSTOMER_COLUMNS, rows: exportRows });
  }

  async import(firmId: string, actorUserId: string, buffer: Buffer): Promise<BulkResult> {
    type Row = {
      name?: string;
      type?: string;
      email?: string;
      contactNo?: string;
      gstin?: string;
      pan?: string;
      address?: string;
      enquirySource?: string;
      status?: string;
      briefText?: string;
      ownerEmail?: string;
    };
    const rows = await parseUpload<Row>({ buffer, columns: CUSTOMER_COLUMNS });

    // Preload firm users keyed by lowercase email for owner lookup.
    const firmUsers = await this.users.find({ where: { firmId } });
    const userByEmail = new Map(firmUsers.map((u) => [u.email.toLowerCase(), u]));

    // Preload existing customers keyed by lowercase email for upsert match.
    const allCustomers = await this.customers.find({ where: { firmId } });
    const customerByEmail = new Map(
      allCustomers
        .filter((c) => c.email)
        .map((c) => [c.email!.toLowerCase(), c]),
    );

    const result: BulkResult = { inserted: 0, updated: 0, skipped: 0, errors: [] };
    const typeValues = new Set(Object.values(CustomerType) as string[]);
    const sourceValues = new Set(Object.values(EnquirySource) as string[]);
    const statusValues = new Set(Object.values(CustomerStatus) as string[]);

    let rowNumber = 1; // header is row 1; first data is row 2
    for (const raw of rows) {
      rowNumber += 1;
      const name = raw.name?.toString().trim();
      const type = raw.type?.toString().trim().toLowerCase();
      const enquirySource = raw.enquirySource?.toString().trim().toLowerCase();
      const status = raw.status?.toString().trim().toLowerCase();
      const email = raw.email?.toString().trim().toLowerCase();

      if (!name) { result.errors.push({ row: rowNumber, reason: 'Name is required' }); result.skipped += 1; continue; }
      if (!type || !typeValues.has(type)) {
        result.errors.push({ row: rowNumber, reason: `Type must be one of ${[...typeValues].join('/')}`, data: { name } });
        result.skipped += 1; continue;
      }
      if (!enquirySource || !sourceValues.has(enquirySource)) {
        result.errors.push({ row: rowNumber, reason: `Enquiry Source must be one of ${[...sourceValues].join('/')}`, data: { name } });
        result.skipped += 1; continue;
      }
      if (status && !statusValues.has(status)) {
        result.errors.push({ row: rowNumber, reason: `Status must be one of ${[...statusValues].join('/')}`, data: { name } });
        result.skipped += 1; continue;
      }

      let ownerUserId: string | undefined;
      if (raw.ownerEmail) {
        const owner = userByEmail.get(raw.ownerEmail.toString().trim().toLowerCase());
        if (!owner) {
          result.errors.push({ row: rowNumber, reason: `Owner Email "${raw.ownerEmail}" not found in this firm`, data: { name } });
          result.skipped += 1; continue;
        }
        ownerUserId = owner.id;
      }

      const existing = email ? customerByEmail.get(email) : undefined;
      try {
        if (existing) {
          existing.name = name;
          existing.type = type as CustomerType;
          existing.contactNo = raw.contactNo ?? existing.contactNo ?? null;
          existing.gstin = raw.gstin ?? existing.gstin ?? null;
          existing.pan = raw.pan ?? existing.pan ?? null;
          existing.address = raw.address ?? existing.address ?? null;
          existing.enquirySource = enquirySource as EnquirySource;
          if (status) {
            const next = status as CustomerStatus;
            if (
              !existing.onboardedAt &&
              (next === CustomerStatus.Onboarded || next === CustomerStatus.Active)
            ) {
              existing.onboardedAt = new Date();
            }
            existing.status = next;
          }
          if (raw.briefText !== undefined) existing.briefText = raw.briefText;
          if (ownerUserId) existing.ownerUserId = ownerUserId;
          existing.updatedBy = actorUserId;
          await this.customers.save(existing);
          result.updated += 1;
        } else {
          const next: CustomerStatus = status
            ? (status as CustomerStatus)
            : CustomerStatus.Enquiry;
          const created = this.customers.create({
            firmId,
            name,
            type: type as CustomerType,
            email: email || null,
            contactNo: raw.contactNo ?? null,
            gstin: raw.gstin ?? null,
            pan: raw.pan ?? null,
            address: raw.address ?? null,
            enquirySource: enquirySource as EnquirySource,
            status: next,
            briefText: raw.briefText ?? null,
            ownerUserId: ownerUserId ?? actorUserId,
            onboardedAt:
              next === CustomerStatus.Onboarded || next === CustomerStatus.Active
                ? new Date()
                : null,
            createdBy: actorUserId,
            updatedBy: actorUserId,
          });
          const saved = await this.customers.save(created);
          if (saved.email) customerByEmail.set(saved.email.toLowerCase(), saved);
          result.inserted += 1;
        }
      } catch (err) {
        result.errors.push({ row: rowNumber, reason: err instanceof Error ? err.message : 'Save failed', data: { name } });
        result.skipped += 1;
      }
    }

    return result;
  }
}
