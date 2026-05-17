import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { In, Repository } from 'typeorm';
import { ColumnSpec, buildExport, buildTemplate, parseUpload } from '../common/excel/excel.util';
import { Role } from '../roles/role.entity';
import { User } from './user.entity';

function userColumns(opts: { roleNames: string[] }): ColumnSpec[] {
  return [
    { key: 'name',                header: 'Name',                  required: true, example: 'Riya Kapoor' },
    { key: 'email',               header: 'Email',                 required: true, example: 'riya@firm.in', note: 'Used as the unique key for upsert' },
    { key: 'phone',               header: 'Phone',                 example: '+91 90000 00001' },
    {
      key: 'roleName',
      header: 'Role Name',
      required: true,
      lookupSheet: opts.roleNames.length ? 'Roles' : undefined,
      enumValues: opts.roleNames.length ? undefined : ['Associate', 'Manager', 'Partner'],
      example: opts.roleNames[0] ?? 'Associate',
      note: 'Pick from the dropdown — must match an existing role in your firm.',
    },
    { key: 'isActive',            header: 'Active',                enumValues: ['true', 'false'], example: 'true' },
    { key: 'defaultHourlyRate',   header: 'Default Hourly Rate (INR)', example: 1500, note: 'Stored as paise internally — value in rupees per hour' },
    { key: 'costRate',            header: 'Cost Rate (INR/hr)',    example: 900,  note: 'Stored as paise internally — value in rupees per hour' },
    { key: 'password',            header: 'Password',              note: 'Required ONLY when creating a new user. Ignored on update.' },
  ];
}

const INSTRUCTIONS = [
  'Required columns: Name, Email, Role Name. Password required only for NEW users.',
  'Rows are matched to existing users by Email (case-insensitive). Existing rows are UPDATED; new rows are CREATED.',
  'Role Name must match a role that already exists in your firm — create the roles first under Settings → Roles.',
  'Default Hourly Rate and Cost Rate are in INR per hour. They are stored internally in paise (multiplied by 100).',
  'Active column accepts true / false. Leave blank to keep the existing value (defaults to true for new users).',
  'Delete the example row (row 2) before importing — only data rows are processed.',
];

export interface BulkResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: { row: number; reason: string; data?: Record<string, unknown> }[];
}

@Injectable()
export class UsersBulkService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    private readonly config: ConfigService,
  ) {}

  async template(firmId: string): Promise<Buffer> {
    const firmRoles = await this.roles.find({ where: { firmId }, order: { name: 'ASC' } });
    const roleNames = firmRoles.map((r) => r.name).filter(Boolean);
    return buildTemplate({
      sheetName: 'Users',
      columns: userColumns({ roleNames }),
      instructions: INSTRUCTIONS,
      lookupSheets: roleNames.length ? [{ name: 'Roles', values: roleNames }] : undefined,
    });
  }

  async export(firmId: string): Promise<Buffer> {
    const rows = await this.users.find({ where: { firmId }, order: { name: 'ASC' } });
    const roleIds = Array.from(new Set(rows.map((r) => r.roleId)));
    const roles = roleIds.length ? await this.roles.find({ where: { firmId, id: In(roleIds) } }) : [];
    const roleById = new Map(roles.map((r) => [r.id, r.name]));
    const exportRows = rows.map((u) => ({
      name: u.name,
      email: u.email,
      phone: u.phone ?? '',
      roleName: roleById.get(u.roleId) ?? '',
      isActive: u.isActive ? 'true' : 'false',
      defaultHourlyRate: u.defaultHourlyRate ? Number(u.defaultHourlyRate) / 100 : '',
      costRate: u.costRate ? Number(u.costRate) / 100 : '',
      password: '',
    }));
    return buildExport({ sheetName: 'Users', columns: userColumns({ roleNames: [] }), rows: exportRows });
  }

  async import(firmId: string, actorUserId: string, buffer: Buffer): Promise<BulkResult> {
    type Row = {
      name?: string;
      email?: string;
      phone?: string;
      roleName?: string;
      isActive?: string | boolean;
      defaultHourlyRate?: string | number;
      costRate?: string | number;
      password?: string;
    };
    const rows = await parseUpload<Row>({ buffer, columns: userColumns({ roleNames: [] }) });

    const firmRoles = await this.roles.find({ where: { firmId } });
    const roleByName = new Map(firmRoles.map((r) => [r.name.toLowerCase(), r]));

    const existingUsers = await this.users.find({ where: { firmId } });
    const userByEmail = new Map(existingUsers.map((u) => [u.email.toLowerCase(), u]));

    const result: BulkResult = { inserted: 0, updated: 0, skipped: 0, errors: [] };
    const rounds = Number(this.config.get<string>('BCRYPT_ROUNDS') ?? 12);

    const toPaise = (v: unknown): string | null | undefined => {
      if (v === undefined || v === null || v === '') return undefined;
      const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.]/g, ''));
      if (Number.isNaN(n)) return undefined;
      return String(Math.round(n * 100));
    };

    const parseBool = (v: unknown): boolean | undefined => {
      if (v === undefined || v === null || v === '') return undefined;
      const s = String(v).trim().toLowerCase();
      if (['true', 'yes', '1', 'y'].includes(s)) return true;
      if (['false', 'no', '0', 'n'].includes(s)) return false;
      return undefined;
    };

    let rowNumber = 1;
    for (const raw of rows) {
      rowNumber += 1;
      const name = raw.name?.toString().trim();
      const email = raw.email?.toString().trim().toLowerCase();
      const roleName = raw.roleName?.toString().trim();

      if (!name) { result.errors.push({ row: rowNumber, reason: 'Name is required' }); result.skipped += 1; continue; }
      if (!email) { result.errors.push({ row: rowNumber, reason: 'Email is required' }); result.skipped += 1; continue; }
      if (!roleName) { result.errors.push({ row: rowNumber, reason: 'Role Name is required' }); result.skipped += 1; continue; }
      const role = roleByName.get(roleName.toLowerCase());
      if (!role) {
        result.errors.push({ row: rowNumber, reason: `Role "${roleName}" not found in this firm`, data: { name, email } });
        result.skipped += 1; continue;
      }

      const isActive = parseBool(raw.isActive);
      const defaultHourlyRate = toPaise(raw.defaultHourlyRate);
      const costRate = toPaise(raw.costRate);

      const existing = userByEmail.get(email);
      try {
        if (existing) {
          existing.name = name;
          if (raw.phone !== undefined) existing.phone = raw.phone?.toString() || null;
          existing.roleId = role.id;
          if (isActive !== undefined) existing.isActive = isActive;
          if (defaultHourlyRate !== undefined) existing.defaultHourlyRate = defaultHourlyRate;
          if (costRate !== undefined) existing.costRate = costRate;
          existing.updatedBy = actorUserId;
          await this.users.save(existing);
          result.updated += 1;
        } else {
          const password = raw.password?.toString();
          if (!password || password.length < 6) {
            result.errors.push({ row: rowNumber, reason: 'Password is required (>=6 chars) when creating a NEW user', data: { name, email } });
            result.skipped += 1; continue;
          }
          const created = this.users.create({
            firmId,
            name,
            email,
            phone: raw.phone?.toString() || null,
            roleId: role.id,
            isActive: isActive ?? true,
            defaultHourlyRate: defaultHourlyRate ?? null,
            costRate: costRate ?? null,
            passwordHash: await bcrypt.hash(password, rounds),
            createdBy: actorUserId,
            updatedBy: actorUserId,
          });
          const saved = await this.users.save(created);
          userByEmail.set(saved.email.toLowerCase(), saved);
          result.inserted += 1;
        }
      } catch (err) {
        result.errors.push({ row: rowNumber, reason: err instanceof Error ? err.message : 'Save failed', data: { name, email } });
        result.skipped += 1;
      }
    }

    return result;
  }
}
