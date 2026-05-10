import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeLog } from '../time-logs/time-log.entity';
import { ReportQueryDto } from './dto/report-query.dto';

interface DateWindow {
  from: Date;
  to: Date;
}

export interface StaffRow {
  userId: string;
  userName: string;
  userEmail: string;
  totalMinutes: number;
  billableMinutes: number;
  nonBillableMinutes: number;
  totalEntries: number;
  distinctTasks: number;
  distinctClients: number;
  estimatedValuePaise: number;
}

export interface ClientRow {
  customerId: string;
  customerName: string;
  totalMinutes: number;
  billableMinutes: number;
  nonBillableMinutes: number;
  totalEntries: number;
  distinctTasks: number;
  distinctStaff: number;
  estimatedValuePaise: number;
}

export interface WorkLogRow {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
  durationMinutes: number;
  isBillable: boolean;
  hourlyRatePaise: number | null;
  notes: string | null;
  taskId: string;
  taskTitle: string;
  taskStatus: string;
  userId: string;
  userName: string;
  customerId: string | null;
  customerName: string | null;
  serviceId: string | null;
  serviceName: string | null;
}

export interface ReportSummary {
  from: string;
  to: string;
  totalMinutes: number;
  billableMinutes: number;
  nonBillableMinutes: number;
  totalEntries: number;
  distinctTasks: number;
  distinctStaff: number;
  distinctClients: number;
  estimatedValuePaise: number;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(TimeLog)
    private readonly timeLogRepository: Repository<TimeLog>,
  ) {}

  private parseWindow(query: ReportQueryDto): DateWindow {
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Invalid date range');
    }
    // Treat `to` as inclusive end-of-day
    to.setHours(23, 59, 59, 999);
    if (from > to) {
      throw new BadRequestException('`from` must be on or before `to`');
    }
    return { from, to };
  }

  private buildBaseQuery(firmId: string, window: DateWindow, query: ReportQueryDto) {
    const qb = this.timeLogRepository
      .createQueryBuilder('tl')
      .leftJoin('tasks', 't', 't.id = tl.task_id')
      .leftJoin('users', 'u', 'u.id = tl.user_id')
      .leftJoin('customers', 'c', 'c.id = t.customer_id')
      .leftJoin('services_catalog', 's', 's.id = t.service_id')
      .where('tl.firm_id = :firmId', { firmId })
      .andWhere('tl.started_at >= :from', { from: window.from })
      .andWhere('tl.started_at <= :to', { to: window.to });

    if (query.userId) {
      qb.andWhere('tl.user_id = :userId', { userId: query.userId });
    }
    if (query.customerId) {
      qb.andWhere('t.customer_id = :customerId', { customerId: query.customerId });
    }
    if (query.billableOnly === 'true') {
      qb.andWhere('tl.is_billable = TRUE');
    }
    return qb;
  }

  async staffReport(firmId: string, query: ReportQueryDto): Promise<{ summary: ReportSummary; rows: StaffRow[] }> {
    const window = this.parseWindow(query);
    const qb = this.buildBaseQuery(firmId, window, query)
      .select('tl.user_id', 'userId')
      .addSelect('COALESCE(u.name, "Unknown")', 'userName')
      .addSelect('COALESCE(u.email, "")', 'userEmail')
      .addSelect('COALESCE(SUM(tl.duration_minutes), 0)', 'totalMinutes')
      .addSelect('COALESCE(SUM(CASE WHEN tl.is_billable THEN tl.duration_minutes ELSE 0 END), 0)', 'billableMinutes')
      .addSelect('COALESCE(SUM(CASE WHEN tl.is_billable THEN 0 ELSE tl.duration_minutes END), 0)', 'nonBillableMinutes')
      .addSelect('COUNT(tl.id)', 'totalEntries')
      .addSelect('COUNT(DISTINCT tl.task_id)', 'distinctTasks')
      .addSelect('COUNT(DISTINCT t.customer_id)', 'distinctClients')
      .addSelect('COALESCE(SUM(CASE WHEN tl.is_billable AND tl.hourly_rate IS NOT NULL THEN (tl.duration_minutes * tl.hourly_rate / 60) ELSE 0 END), 0)', 'estimatedValuePaise')
      .groupBy('tl.user_id')
      .addGroupBy('u.name')
      .addGroupBy('u.email')
      .orderBy('totalMinutes', 'DESC');

    const raw = await qb.getRawMany();
    const rows: StaffRow[] = raw.map((r) => ({
      userId: r.userId,
      userName: r.userName,
      userEmail: r.userEmail,
      totalMinutes: Number(r.totalMinutes),
      billableMinutes: Number(r.billableMinutes),
      nonBillableMinutes: Number(r.nonBillableMinutes),
      totalEntries: Number(r.totalEntries),
      distinctTasks: Number(r.distinctTasks),
      distinctClients: Number(r.distinctClients),
      estimatedValuePaise: Number(r.estimatedValuePaise),
    }));
    const summary = this.summarize(window, rows, 'staff');
    return { summary, rows };
  }

  async clientReport(firmId: string, query: ReportQueryDto): Promise<{ summary: ReportSummary; rows: ClientRow[] }> {
    const window = this.parseWindow(query);
    const qb = this.buildBaseQuery(firmId, window, query)
      .select('t.customer_id', 'customerId')
      .addSelect('COALESCE(c.name, "Unknown Client")', 'customerName')
      .addSelect('COALESCE(SUM(tl.duration_minutes), 0)', 'totalMinutes')
      .addSelect('COALESCE(SUM(CASE WHEN tl.is_billable THEN tl.duration_minutes ELSE 0 END), 0)', 'billableMinutes')
      .addSelect('COALESCE(SUM(CASE WHEN tl.is_billable THEN 0 ELSE tl.duration_minutes END), 0)', 'nonBillableMinutes')
      .addSelect('COUNT(tl.id)', 'totalEntries')
      .addSelect('COUNT(DISTINCT tl.task_id)', 'distinctTasks')
      .addSelect('COUNT(DISTINCT tl.user_id)', 'distinctStaff')
      .addSelect('COALESCE(SUM(CASE WHEN tl.is_billable AND tl.hourly_rate IS NOT NULL THEN (tl.duration_minutes * tl.hourly_rate / 60) ELSE 0 END), 0)', 'estimatedValuePaise')
      .groupBy('t.customer_id')
      .addGroupBy('c.name')
      .orderBy('totalMinutes', 'DESC');

    const raw = await qb.getRawMany();
    const rows: ClientRow[] = raw.map((r) => ({
      customerId: r.customerId,
      customerName: r.customerName,
      totalMinutes: Number(r.totalMinutes),
      billableMinutes: Number(r.billableMinutes),
      nonBillableMinutes: Number(r.nonBillableMinutes),
      totalEntries: Number(r.totalEntries),
      distinctTasks: Number(r.distinctTasks),
      distinctStaff: Number(r.distinctStaff),
      estimatedValuePaise: Number(r.estimatedValuePaise),
    }));
    const summary = this.summarize(window, rows, 'client');
    return { summary, rows };
  }

  async workLogs(firmId: string, query: ReportQueryDto): Promise<{ summary: ReportSummary; rows: WorkLogRow[] }> {
    const window = this.parseWindow(query);
    const qb = this.buildBaseQuery(firmId, window, query)
      .select('tl.id', 'id')
      .addSelect('tl.started_at', 'startedAt')
      .addSelect('tl.ended_at', 'endedAt')
      .addSelect('COALESCE(tl.duration_minutes, 0)', 'durationMinutes')
      .addSelect('tl.is_billable', 'isBillable')
      .addSelect('tl.hourly_rate', 'hourlyRatePaise')
      .addSelect('tl.notes', 'notes')
      .addSelect('tl.task_id', 'taskId')
      .addSelect('COALESCE(t.title, "(Deleted Task)")', 'taskTitle')
      .addSelect('COALESCE(t.status, "")', 'taskStatus')
      .addSelect('tl.user_id', 'userId')
      .addSelect('COALESCE(u.name, "Unknown")', 'userName')
      .addSelect('t.customer_id', 'customerId')
      .addSelect('c.name', 'customerName')
      .addSelect('t.service_id', 'serviceId')
      .addSelect('s.name', 'serviceName')
      .orderBy('tl.started_at', 'DESC')
      .limit(1000);

    const raw = await qb.getRawMany();
    const rows: WorkLogRow[] = raw.map((r) => ({
      id: r.id,
      startedAt: r.startedAt,
      endedAt: r.endedAt,
      durationMinutes: Number(r.durationMinutes),
      isBillable: !!r.isBillable,
      hourlyRatePaise: r.hourlyRatePaise ? Number(r.hourlyRatePaise) : null,
      notes: r.notes,
      taskId: r.taskId,
      taskTitle: r.taskTitle,
      taskStatus: r.taskStatus,
      userId: r.userId,
      userName: r.userName,
      customerId: r.customerId,
      customerName: r.customerName,
      serviceId: r.serviceId,
      serviceName: r.serviceName,
    }));

    const totalMinutes = rows.reduce((s, r) => s + r.durationMinutes, 0);
    const billableMinutes = rows.filter((r) => r.isBillable).reduce((s, r) => s + r.durationMinutes, 0);
    const summary: ReportSummary = {
      from: window.from.toISOString(),
      to: window.to.toISOString(),
      totalMinutes,
      billableMinutes,
      nonBillableMinutes: totalMinutes - billableMinutes,
      totalEntries: rows.length,
      distinctTasks: new Set(rows.map((r) => r.taskId)).size,
      distinctStaff: new Set(rows.map((r) => r.userId)).size,
      distinctClients: new Set(rows.map((r) => r.customerId).filter(Boolean)).size,
      estimatedValuePaise: rows.reduce((s, r) => s + (r.isBillable && r.hourlyRatePaise ? Math.round((r.durationMinutes * r.hourlyRatePaise) / 60) : 0), 0),
    };

    return { summary, rows };
  }

  private summarize(
    window: DateWindow,
    rows: Array<StaffRow | ClientRow>,
    mode: 'staff' | 'client',
  ): ReportSummary {
    const totalMinutes = rows.reduce((s, r) => s + r.totalMinutes, 0);
    const billableMinutes = rows.reduce((s, r) => s + r.billableMinutes, 0);
    const nonBillableMinutes = rows.reduce((s, r) => s + r.nonBillableMinutes, 0);
    const totalEntries = rows.reduce((s, r) => s + r.totalEntries, 0);
    const distinctTasks = rows.reduce((s, r) => s + r.distinctTasks, 0);
    const estimatedValuePaise = rows.reduce((s, r) => s + r.estimatedValuePaise, 0);
    return {
      from: window.from.toISOString(),
      to: window.to.toISOString(),
      totalMinutes,
      billableMinutes,
      nonBillableMinutes,
      totalEntries,
      distinctTasks,
      distinctStaff: mode === 'staff' ? rows.length : rows.reduce((s, r) => s + ('distinctStaff' in r ? r.distinctStaff : 0), 0),
      distinctClients: mode === 'client' ? rows.length : rows.reduce((s, r) => s + ('distinctClients' in r ? r.distinctClients : 0), 0),
      estimatedValuePaise,
    };
  }
}
