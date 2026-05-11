import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeLog } from '../time-logs/time-log.entity';

interface DateWindow { from: Date; to: Date; }
export interface AnalyticsQuery { from: string; to: string; userId?: string; customerId?: string; }

export interface KpiOverview {
  from: string;
  to: string;
  totalRevenuePaise: number;
  billableRevenuePaise: number;
  costPaise: number;
  marginPaise: number;
  totalMinutes: number;
  billableMinutes: number;
  utilizationPct: number;
  avgRatePaise: number;
  invoicedPaise: number;
  collectedPaise: number;
  outstandingPaise: number;
  activeStaff: number;
  activeClients: number;
  taskCompletionRate: number; // %
  avgCompletionDays: number | null;
  onTimeDeliveryRate: number; // %
  topStaff: { userId: string; userName: string; revenuePaise: number; hours: number }[];
  topClients: { customerId: string; customerName: string; revenuePaise: number; hours: number }[];
  revenueByMonth: { month: string; revenuePaise: number; hours: number }[];
}

export interface StaffPerf {
  userId: string;
  userName: string;
  email: string;
  totalMinutes: number;
  billableMinutes: number;
  nonBillableMinutes: number;
  revenuePaise: number;
  costPaise: number;
  marginPaise: number;
  marginPct: number;
  utilizationPct: number;
  entries: number;
  distinctTasks: number;
  distinctClients: number;
  tasksCompleted: number;
  avgCompletionDays: number | null;
  onTimePct: number;
  ratePerHourPaise: number;
}

export interface ClientPerf {
  customerId: string;
  customerName: string;
  totalMinutes: number;
  billableMinutes: number;
  revenuePaise: number;
  invoicedPaise: number;
  collectedPaise: number;
  outstandingPaise: number;
  entries: number;
  distinctTasks: number;
  distinctStaff: number;
  tasksCompleted: number;
  marginPaise: number;
  marginPct: number;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(TimeLog)
    private readonly timeLogRepository: Repository<TimeLog>,
  ) {}

  private parse(query: AnalyticsQuery): DateWindow {
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Invalid date range');
    }
    to.setHours(23, 59, 59, 999);
    if (from > to) throw new BadRequestException('`from` must be on or before `to`');
    return { from, to };
  }

  // ── Per-staff performance + KPIs ──────────────────────────────────────────
  async staff(firmId: string, query: AnalyticsQuery): Promise<{ rows: StaffPerf[]; totals: { revenuePaise: number; hours: number; entries: number } }> {
    const w = this.parse(query);
    const params: Record<string, unknown> = { firmId, from: w.from, to: w.to };
    let userFilter = '';
    if (query.userId) { userFilter = ' AND tl.user_id = :userId'; params.userId = query.userId; }

    // Aggregate via raw query for per-line revenue calc
    const rows = await this.timeLogRepository.query(`
      SELECT
        tl.user_id AS userId,
        COALESCE(u.name, '?') AS userName,
        COALESCE(u.email, '') AS email,
        COALESCE(u.cost_rate, 0) AS costRate,
        COALESCE(SUM(tl.duration_minutes), 0) AS totalMinutes,
        COALESCE(SUM(CASE WHEN tl.is_billable THEN tl.duration_minutes ELSE 0 END), 0) AS billableMinutes,
        COALESCE(SUM(CASE WHEN tl.is_billable THEN 0 ELSE tl.duration_minutes END), 0) AS nonBillableMinutes,
        COALESCE(SUM(CASE WHEN tl.is_billable AND tl.hourly_rate IS NOT NULL THEN ROUND(tl.duration_minutes * tl.hourly_rate / 60) ELSE 0 END), 0) AS revenuePaise,
        COUNT(tl.id) AS entries,
        COUNT(DISTINCT tl.task_id) AS distinctTasks,
        COUNT(DISTINCT t.customer_id) AS distinctClients
      FROM time_logs tl
      LEFT JOIN users u ON u.id = tl.user_id
      LEFT JOIN tasks t ON t.id = tl.task_id
      WHERE tl.firm_id = :firmId
        AND tl.started_at >= :from AND tl.started_at <= :to${userFilter}
      GROUP BY tl.user_id, u.name, u.email, u.cost_rate
      ORDER BY revenuePaise DESC
    `.replace(/:firmId/g, '?').replace(/:from/g, '?').replace(/:to/g, '?').replace(/:userId/g, '?'),
    query.userId ? [firmId, w.from, w.to, query.userId] : [firmId, w.from, w.to]);

    // Per-user task-completion + on-time rate (for staff who completed tasks in window)
    const completedRaw: Array<{ userId: string; tasksCompleted: number; avgCompletionDays: number | null; onTimeCount: number; totalCompleted: number }> =
      await this.timeLogRepository.query(`
        SELECT
          t.assigned_to_user_id AS userId,
          COUNT(*) AS tasksCompleted,
          AVG(TIMESTAMPDIFF(HOUR, t.created_at, t.completed_at)/24) AS avgCompletionDays,
          SUM(CASE WHEN t.due_date IS NULL OR t.completed_at <= t.due_date THEN 1 ELSE 0 END) AS onTimeCount,
          COUNT(*) AS totalCompleted
        FROM tasks t
        WHERE t.firm_id = ?
          AND t.status = 'completed'
          AND t.completed_at IS NOT NULL
          AND t.completed_at >= ? AND t.completed_at <= ?
          AND t.assigned_to_user_id IS NOT NULL
        GROUP BY t.assigned_to_user_id
      `, [firmId, w.from, w.to]);

    const completedMap = new Map(completedRaw.map((x) => [x.userId, x]));

    // Total available minutes per user (8h/day × business days in window) for utilization
    const businessDays = countBusinessDays(w.from, w.to);
    const availableMinutesPerUser = businessDays * 8 * 60;

    const out: StaffPerf[] = rows.map((r: Record<string, unknown>) => {
      const totalMinutes = Number(r.totalMinutes);
      const billableMinutes = Number(r.billableMinutes);
      const nonBillableMinutes = Number(r.nonBillableMinutes);
      const revenuePaise = Number(r.revenuePaise);
      const costRate = Number(r.costRate);
      const costPaise = costRate > 0 ? Math.round((totalMinutes * costRate) / 60) : 0;
      const marginPaise = revenuePaise - costPaise;
      const marginPct = revenuePaise > 0 ? Math.round((marginPaise / revenuePaise) * 1000) / 10 : 0;
      const utilizationPct = availableMinutesPerUser > 0 ? Math.round((billableMinutes / availableMinutesPerUser) * 1000) / 10 : 0;
      const entries = Number(r.entries);
      const distinctTasks = Number(r.distinctTasks);
      const distinctClients = Number(r.distinctClients);
      const ratePerHourPaise = totalMinutes > 0 ? Math.round((revenuePaise * 60) / totalMinutes) : 0;
      const cm = completedMap.get(String(r.userId));
      const tasksCompleted = cm ? Number(cm.tasksCompleted) : 0;
      const avgCompletionDays = cm && cm.avgCompletionDays !== null ? Math.round(Number(cm.avgCompletionDays) * 10) / 10 : null;
      const onTimePct = cm && Number(cm.totalCompleted) > 0 ? Math.round((Number(cm.onTimeCount) / Number(cm.totalCompleted)) * 1000) / 10 : 0;
      return {
        userId: String(r.userId),
        userName: String(r.userName),
        email: String(r.email),
        totalMinutes,
        billableMinutes,
        nonBillableMinutes,
        revenuePaise,
        costPaise,
        marginPaise,
        marginPct,
        utilizationPct,
        entries,
        distinctTasks,
        distinctClients,
        tasksCompleted,
        avgCompletionDays,
        onTimePct,
        ratePerHourPaise,
      };
    });

    const totals = out.reduce(
      (a, r) => ({ revenuePaise: a.revenuePaise + r.revenuePaise, hours: a.hours + r.totalMinutes / 60, entries: a.entries + r.entries }),
      { revenuePaise: 0, hours: 0, entries: 0 },
    );

    return { rows: out, totals };
  }

  // ── Per-client performance ────────────────────────────────────────────────
  async clients(firmId: string, query: AnalyticsQuery): Promise<{ rows: ClientPerf[] }> {
    const w = this.parse(query);
    const filter = query.customerId ? ' AND t.customer_id = ?' : '';
    const args: unknown[] = [firmId, w.from, w.to];
    if (query.customerId) args.push(query.customerId);

    const rows = await this.timeLogRepository.query(`
      SELECT
        t.customer_id AS customerId,
        COALESCE(c.name, 'Unknown') AS customerName,
        COALESCE(SUM(tl.duration_minutes), 0) AS totalMinutes,
        COALESCE(SUM(CASE WHEN tl.is_billable THEN tl.duration_minutes ELSE 0 END), 0) AS billableMinutes,
        COALESCE(SUM(CASE WHEN tl.is_billable AND tl.hourly_rate IS NOT NULL THEN ROUND(tl.duration_minutes * tl.hourly_rate / 60) ELSE 0 END), 0) AS revenuePaise,
        COALESCE(SUM(CASE WHEN u.cost_rate IS NOT NULL THEN ROUND(tl.duration_minutes * u.cost_rate / 60) ELSE 0 END), 0) AS costPaise,
        COUNT(tl.id) AS entries,
        COUNT(DISTINCT tl.task_id) AS distinctTasks,
        COUNT(DISTINCT tl.user_id) AS distinctStaff
      FROM time_logs tl
      LEFT JOIN tasks t ON t.id = tl.task_id
      LEFT JOIN customers c ON c.id = t.customer_id
      LEFT JOIN users u ON u.id = tl.user_id
      WHERE tl.firm_id = ? AND tl.started_at >= ? AND tl.started_at <= ?${filter}
      GROUP BY t.customer_id, c.name
      ORDER BY revenuePaise DESC
    `, args);

    // Invoicing data per customer in window
    const invoiceRows = await this.timeLogRepository.query(`
      SELECT
        i.customer_id AS customerId,
        COALESCE(SUM(i.total), 0) AS invoicedPaise,
        COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.total ELSE 0 END), 0) AS collectedPaise,
        COALESCE(SUM(CASE WHEN i.status IN ('sent','partially_paid','overdue','draft') THEN i.total ELSE 0 END), 0) AS outstandingPaise,
        COALESCE(SUM(CASE WHEN t.id IS NOT NULL AND t.status = 'completed' THEN 1 ELSE 0 END), 0) AS tasksCompleted
      FROM invoices i
      LEFT JOIN tasks t ON t.firm_id = i.firm_id AND t.customer_id = i.customer_id
        AND t.completed_at IS NOT NULL AND t.completed_at >= ? AND t.completed_at <= ?
      WHERE i.firm_id = ? AND i.issue_date >= ? AND i.issue_date <= ?
      GROUP BY i.customer_id
    `, [w.from, w.to, firmId, w.from.toISOString().slice(0, 10), w.to.toISOString().slice(0, 10)]);

    const invoiceMap = new Map<string, Record<string, unknown>>(
      invoiceRows.map((r: Record<string, unknown>) => [String(r.customerId), r] as [string, Record<string, unknown>]),
    );

    const out: ClientPerf[] = rows.map((r: Record<string, unknown>) => {
      const totalMinutes = Number(r.totalMinutes);
      const revenuePaise = Number(r.revenuePaise);
      const costPaise = Number(r.costPaise);
      const marginPaise = revenuePaise - costPaise;
      const inv = invoiceMap.get(String(r.customerId));
      return {
        customerId: String(r.customerId || ''),
        customerName: String(r.customerName),
        totalMinutes,
        billableMinutes: Number(r.billableMinutes),
        revenuePaise,
        invoicedPaise: inv ? Number(inv['invoicedPaise']) : 0,
        collectedPaise: inv ? Number(inv['collectedPaise']) : 0,
        outstandingPaise: inv ? Number(inv['outstandingPaise']) : 0,
        entries: Number(r.entries),
        distinctTasks: Number(r.distinctTasks),
        distinctStaff: Number(r.distinctStaff),
        tasksCompleted: inv ? Number(inv['tasksCompleted']) : 0,
        marginPaise,
        marginPct: revenuePaise > 0 ? Math.round((marginPaise / revenuePaise) * 1000) / 10 : 0,
      };
    });
    return { rows: out };
  }

  // ── Overview / KPIs ───────────────────────────────────────────────────────
  async overview(firmId: string, query: AnalyticsQuery): Promise<KpiOverview> {
    const w = this.parse(query);
    const staffData = await this.staff(firmId, query);
    const clientData = await this.clients(firmId, query);

    const totalMinutes = staffData.rows.reduce((s, r) => s + r.totalMinutes, 0);
    const billableMinutes = staffData.rows.reduce((s, r) => s + r.billableMinutes, 0);
    const totalRevenuePaise = staffData.rows.reduce((s, r) => s + r.revenuePaise, 0);
    const billableRevenuePaise = totalRevenuePaise; // all revenue comes from billable
    const costPaise = staffData.rows.reduce((s, r) => s + r.costPaise, 0);
    const marginPaise = totalRevenuePaise - costPaise;
    const businessDays = countBusinessDays(w.from, w.to);
    const totalAvailableMinutes = businessDays * 8 * 60 * staffData.rows.length;
    const utilizationPct = totalAvailableMinutes > 0 ? Math.round((billableMinutes / totalAvailableMinutes) * 1000) / 10 : 0;
    const avgRatePaise = totalMinutes > 0 ? Math.round((totalRevenuePaise * 60) / totalMinutes) : 0;

    const invoicedPaise = clientData.rows.reduce((s, r) => s + r.invoicedPaise, 0);
    const collectedPaise = clientData.rows.reduce((s, r) => s + r.collectedPaise, 0);
    const outstandingPaise = clientData.rows.reduce((s, r) => s + r.outstandingPaise, 0);

    // Task completion stats (firm-wide in window)
    const taskStats = await this.timeLogRepository.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
        AVG(CASE WHEN status = 'completed' AND completed_at IS NOT NULL THEN TIMESTAMPDIFF(HOUR, created_at, completed_at)/24 END) AS avgDays,
        SUM(CASE WHEN status = 'completed' AND (due_date IS NULL OR completed_at <= due_date) THEN 1 ELSE 0 END) AS onTime
      FROM tasks
      WHERE firm_id = ?
        AND ((status = 'completed' AND completed_at >= ? AND completed_at <= ?)
          OR (status != 'completed' AND created_at >= ? AND created_at <= ?))
    `, [firmId, w.from, w.to, w.from, w.to]);
    const ts = (taskStats[0] || {}) as Record<string, unknown>;
    const totalTasks = Number(ts.total || 0);
    const completedTasks = Number(ts.completed || 0);
    const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 1000) / 10 : 0;
    const avgCompletionDays = ts.avgDays !== null && ts.avgDays !== undefined ? Math.round(Number(ts.avgDays) * 10) / 10 : null;
    const onTimeDeliveryRate = completedTasks > 0 ? Math.round((Number(ts.onTime || 0) / completedTasks) * 1000) / 10 : 0;

    const topStaff = staffData.rows.slice(0, 5).map((r) => ({ userId: r.userId, userName: r.userName, revenuePaise: r.revenuePaise, hours: r.totalMinutes / 60 }));
    const topClients = clientData.rows.slice(0, 5).map((r) => ({ customerId: r.customerId, customerName: r.customerName, revenuePaise: r.revenuePaise, hours: r.totalMinutes / 60 }));

    // Revenue by month
    const monthly = await this.timeLogRepository.query(`
      SELECT
        DATE_FORMAT(tl.started_at, '%Y-%m') AS month,
        COALESCE(SUM(CASE WHEN tl.is_billable AND tl.hourly_rate IS NOT NULL THEN ROUND(tl.duration_minutes * tl.hourly_rate / 60) ELSE 0 END), 0) AS revenuePaise,
        COALESCE(SUM(tl.duration_minutes), 0) AS totalMinutes
      FROM time_logs tl
      WHERE tl.firm_id = ? AND tl.started_at >= ? AND tl.started_at <= ?
      GROUP BY DATE_FORMAT(tl.started_at, '%Y-%m')
      ORDER BY month ASC
    `, [firmId, w.from, w.to]);
    const revenueByMonth = monthly.map((m: Record<string, unknown>) => ({
      month: String(m.month),
      revenuePaise: Number(m.revenuePaise),
      hours: Number(m.totalMinutes) / 60,
    }));

    return {
      from: w.from.toISOString(),
      to: w.to.toISOString(),
      totalRevenuePaise,
      billableRevenuePaise,
      costPaise,
      marginPaise,
      totalMinutes,
      billableMinutes,
      utilizationPct,
      avgRatePaise,
      invoicedPaise,
      collectedPaise,
      outstandingPaise,
      activeStaff: staffData.rows.length,
      activeClients: clientData.rows.length,
      taskCompletionRate,
      avgCompletionDays,
      onTimeDeliveryRate,
      topStaff,
      topClients,
      revenueByMonth,
    };
  }
}

function countBusinessDays(from: Date, to: Date): number {
  let count = 0;
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}
