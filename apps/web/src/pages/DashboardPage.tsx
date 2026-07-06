import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, Calendar, CheckCircle2, Clock, FileText,
  Gauge, Receipt, TrendingDown, TrendingUp, Wallet,
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useUiStore } from '../lib/ui-store';

type Period = 'today' | 'week' | 'month' | 'qtd' | 'ytd';

interface AnalyticsOverview {
  from: string; to: string;
  totalRevenuePaise: number; billableRevenuePaise: number; costPaise: number; marginPaise: number;
  totalMinutes: number; billableMinutes: number; utilizationPct: number; avgRatePaise: number;
  invoicedPaise: number; collectedPaise: number; outstandingPaise: number;
  activeStaff: number; activeClients: number;
  taskCompletionRate: number; avgCompletionDays: number | null; onTimeDeliveryRate: number;
  topStaff: { userId: string; userName: string; revenuePaise: number; hours: number }[];
  topClients: { customerId: string; customerName: string; revenuePaise: number; hours: number }[];
  revenueByMonth: { month: string; revenuePaise: number; hours: number }[];
}
interface StaffRow {
  userId: string; userName: string; revenuePaise: number; totalMinutes: number;
  utilizationPct: number; ratePerHourPaise: number;
}
interface ClientRow {
  customerId: string; customerName: string; revenuePaise: number; outstandingPaise: number; marginPct: number;
}
interface PendingRow {
  taskId: string; title: string; customerName: string; serviceName: string | null;
  completedAt: string | null; suggestedAmountPaise: string | null;
}
interface TaskLite {
  id: string; title: string; status: string; customerId: string;
  assignedToUserId?: string; dueDate?: string; priority: string;
}
interface AuditRow {
  id: string; userId?: string | null; action: string; entityType: string;
  entityId: string; afterJson?: Record<string, unknown> | null; createdAt: string;
}

function fmtP(p: number) {
  const r = (p || 0) / 100;
  if (Math.abs(r) >= 10000000) return `₹${(r / 10000000).toFixed(2)}Cr`;
  if (Math.abs(r) >= 100000) return `₹${(r / 100000).toFixed(2)}L`;
  if (Math.abs(r) >= 1000) return `₹${(r / 1000).toFixed(1)}K`;
  return `₹${r.toFixed(0)}`;
}
function isoDay(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function windowFor(p: Period) {
  const now = new Date(); const today = isoDay(now);
  if (p === 'today') return { from: today, to: today };
  if (p === 'week') { const s = new Date(now); s.setDate(s.getDate() - ((s.getDay() + 6) % 7)); return { from: isoDay(s), to: today }; }
  if (p === 'month') return { from: isoDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
  if (p === 'qtd') { const q = Math.floor(now.getMonth() / 3) * 3; return { from: isoDay(new Date(now.getFullYear(), q, 1)), to: today }; }
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return { from: isoDay(new Date(y, 3, 1)), to: today };
}
function prevWindow(p: Period) {
  const now = new Date();
  if (p === 'month') { const f = new Date(now.getFullYear(), now.getMonth() - 1, 1); const t = new Date(now.getFullYear(), now.getMonth(), 0); return { from: isoDay(f), to: isoDay(t), label: f.toLocaleDateString('en-IN', { month: 'short' }) }; }
  const cur = windowFor(p); const f = new Date(cur.from); const t = new Date(cur.to);
  const len = Math.max(1, Math.round((t.getTime() - f.getTime()) / 864e5) + 1);
  const pt = new Date(f); pt.setDate(pt.getDate() - 1); const pf = new Date(pt); pf.setDate(pf.getDate() - len + 1);
  return { from: isoDay(pf), to: isoDay(pt), label: 'prev' };
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  assigned: { label: 'Assigned', color: '#3b82f6' },
  in_progress: { label: 'In Progress', color: '#f59e0b' },
  on_hold: { label: 'On Hold', color: '#eab308' },
  unassigned: { label: 'Unassigned', color: '#a855f7' },
  completed: { label: 'Completed', color: '#10b981' },
  cancelled: { label: 'Cancelled', color: '#94a3b8' },
  review: { label: 'Review', color: '#06b6d4' },
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function DashboardPage() {
  const { hasPermission } = useAuth();
  const openTask = useUiStore((s) => s.openTask);
  const canViewReports = hasPermission('report.view');
  const canViewAll = hasPermission('dashboard.partner') || hasPermission('dashboard.manager');
  const canViewAudit = hasPermission('audit.view');

  const [period, setPeriod] = useState<Period>('month');
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [prev, setPrev] = useState<AnalyticsOverview | null>(null);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [tasks, setTasks] = useState<TaskLite[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshAt, setRefreshAt] = useState(Date.now());

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const w = windowFor(period); const pw = prevWindow(period);
      const jobs: Promise<unknown>[] = [];
      if (canViewReports) {
        jobs.push(api<AnalyticsOverview>(`/analytics/overview?from=${w.from}&to=${w.to}`).then(setOverview).catch(() => setOverview(null)));
        jobs.push(api<AnalyticsOverview>(`/analytics/overview?from=${pw.from}&to=${pw.to}`).then(setPrev).catch(() => setPrev(null)));
        jobs.push(api<{ rows: StaffRow[] }>(`/analytics/staff?from=${w.from}&to=${w.to}`).then((r) => setStaff(r.rows || [])).catch(() => setStaff([])));
        jobs.push(api<{ rows: ClientRow[] }>(`/analytics/clients?from=${w.from}&to=${w.to}`).then((r) => setClients(r.rows || [])).catch(() => setClients([])));
        jobs.push(api<PendingRow[]>('/invoices-pending').then(setPending).catch(() => setPending([])));
      }
      if (canViewAudit) jobs.push(api<AuditRow[]>('/audit-logs').then(setAudit).catch(() => setAudit([])));
      jobs.push(api<{ id: string; name: string }[]>('/users/lookup').then((u) => setUserMap(Object.fromEntries(u.map((x) => [x.id, x.name])))).catch(() => {}));
      const base = canViewAll ? '/tasks' : '/tasks/my';
      const all: TaskLite[] = [];
      const page = async (cursor?: string): Promise<void> => {
        const r = await api<{ data: TaskLite[]; nextCursor?: string }>(`${base}?limit=100${cursor ? `&cursor=${cursor}` : ''}`);
        all.push(...(r.data || [])); if (r.nextCursor) await page(r.nextCursor);
      };
      jobs.push(page().then(() => setTasks(all)));
      await Promise.all(jobs);
    } finally { setLoading(false); }
  }, [period, canViewReports, canViewAll, canViewAudit]);

  useEffect(() => { loadAll(); }, [loadAll, refreshAt]);

  const now = new Date();
  const in3 = new Date(); in3.setDate(in3.getDate() + 3);
  const isOpen = (t: TaskLite) => t.status !== 'completed' && t.status !== 'cancelled';
  const overdue = useMemo(() => tasks.filter((t) => t.dueDate && new Date(t.dueDate) < now && isOpen(t))
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()), [tasks]);
  const dueSoon = useMemo(() => tasks.filter((t) => t.dueDate && new Date(t.dueDate) >= now && new Date(t.dueDate) <= in3 && isOpen(t))
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()), [tasks]);
  const todayStr = isoDay(now);
  const dueToday = useMemo(() => tasks
    .filter((t) => t.dueDate && isoDay(new Date(t.dueDate)) === todayStr && isOpen(t))
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()), [tasks, todayStr]);
  // Overdue tasks grouped per assignee → the "Staff Overdue" report card.
  const staffOverdue = useMemo(() => {
    const counts = new Map<string, number>();
    overdue.forEach((t) => {
      const key = t.assignedToUserId || 'unassigned';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return [...counts.entries()]
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count);
  }, [overdue]);
  // Per-staff utilization (billable/capacity), highest first.
  const staffUtil = useMemo(() => [...staff].sort((a, b) => b.utilizationPct - a.utilizationPct).slice(0, 6), [staff]);
  const statusCounts = useMemo(() => tasks.reduce<Record<string, number>>((a, t) => { a[t.status] = (a[t.status] || 0) + 1; return a; }, {}), [tasks]);
  const activeCount = tasks.filter(isOpen).length;

  const collectionRate = overview && overview.invoicedPaise > 0 ? Math.round((overview.collectedPaise / overview.invoicedPaise) * 1000) / 10 : 0;
  const marginPct = overview && overview.totalRevenuePaise > 0 ? Math.round((overview.marginPaise / overview.totalRevenuePaise) * 1000) / 10 : 0;
  const pct = (cur?: number, p?: number) => (cur != null && p != null && p > 0 ? Math.round(((cur - p) / p) * 1000) / 10 : null);

  const donut = useMemo(() => Object.entries(statusCounts)
    .map(([k, v]) => ({ key: k, name: STATUS_META[k]?.label ?? k.replace(/_/g, ' '), value: v, color: STATUS_META[k]?.color ?? '#94a3b8' }))
    .sort((a, b) => b.value - a.value), [statusCounts]);
  const donutTotal = donut.reduce((s, d) => s + d.value, 0);

  const finChart = useMemo(() => (overview?.revenueByMonth || []).map((m) => {
    const mi = Number(m.month?.split('-')[1]) - 1;
    return { month: MONTHS[mi] ?? m.month, revenue: m.revenuePaise / 100 };
  }), [overview]);

  const ops = [
    { key: 'completed', label: 'Completed', color: '#10b981', count: statusCounts['completed'] || 0 },
    { key: 'in_progress', label: 'In Progress', color: '#f59e0b', count: statusCounts['in_progress'] || 0 },
    { key: 'on_hold', label: 'On Hold', color: '#eab308', count: statusCounts['on_hold'] || 0 },
    { key: 'overdue', label: 'Overdue', color: '#ef4444', count: overdue.length },
    { key: 'unassigned', label: 'Unassigned', color: '#a855f7', count: statusCounts['unassigned'] || 0 },
  ];
  const opsTotal = Math.max(1, ops.reduce((s, o) => s + o.count, 0));

  const topStaff = [...staff].sort((a, b) => b.revenuePaise - a.revenuePaise).slice(0, 5);
  const topClients = [...clients].sort((a, b) => b.revenuePaise - a.revenuePaise).slice(0, 5);
  const highValue = [...pending]
    .filter((p) => p.suggestedAmountPaise)
    .sort((a, b) => Number(b.suggestedAmountPaise) - Number(a.suggestedAmountPaise))
    .slice(0, 5);

  const PERIODS: { key: Period; label: string }[] = [
    { key: 'today', label: 'Today' }, { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' }, { key: 'qtd', label: 'This Quarter' }, { key: 'ytd', label: 'This FY' },
  ];
  const prevLabel = prevWindow(period).label;

  return (
    <section className="space-y-5 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Dashboard <span className="ml-1 text-sm font-normal text-muted-foreground">{canViewAll ? 'Firm-wide overview' : 'Your work at a glance'}</span></h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden h-9 items-center gap-1.5 rounded-lg border border-border bg-panel px-3 text-xs font-medium text-muted-foreground sm:inline-flex">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            {now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
          <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="input-field h-9 min-h-0 w-auto py-0 text-xs font-medium">
            {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <button onClick={() => setRefreshAt(Date.now())} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-panel px-3 text-xs font-medium text-foreground hover:bg-accent" title="Refresh">
            <Activity className={`h-3.5 w-3.5 ${loading ? 'animate-pulse' : ''}`} /> {loading ? '…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi tone="emerald" icon={<TrendingUp />} label="Revenue (MTD)" value={canViewReports && overview ? fmtP(overview.totalRevenuePaise) : '—'}
          delta={pct(overview?.totalRevenuePaise, prev?.totalRevenuePaise)} deltaSuffix={`vs ${prevLabel}`} spark={finChart.map((f) => f.revenue)} />
        <Kpi tone="violet" icon={<Wallet />} label="Cash Collected (MTD)" value={canViewReports && overview ? fmtP(overview.collectedPaise) : '—'}
          sub={`${collectionRate}% collection rate`} delta={pct(overview?.collectedPaise, prev?.collectedPaise)} deltaSuffix={`vs ${prevLabel}`} />
        <Kpi tone="blue" icon={<Gauge />} label="Realization Rate" value={canViewReports && overview ? `${fmtP(overview.avgRatePaise)}/hr` : '—'}
          sub="Avg. billing rate" delta={pct(overview?.avgRatePaise, prev?.avgRatePaise)} deltaSuffix={`vs ${prevLabel}`} />
        <Kpi tone="amber" icon={<Activity />} label="Utilization" value={canViewReports && overview ? `${overview.utilizationPct}%` : '—'}
          sub="Billable / capacity" delta={pct(overview?.utilizationPct, prev?.utilizationPct)} deltaSuffix={`vs ${prevLabel}`} />
        <Kpi tone="red" alert icon={<AlertTriangle />} label="Overdue Tasks" value={String(overdue.length)}
          sub={overdue.length ? 'Need immediate attention' : 'All on track'} />
      </div>

      {/* Action Center + Task Distribution */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="panel lg:col-span-2">
          <div className="mb-3 flex items-center justify-between"><div className="panel-title mb-0">Action Center</div></div>
          <div className="grid gap-4 md:grid-cols-3">
            {/* Overdue */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wide text-red-600">Overdue Tasks (Top 5)</span>
              </div>
              {overdue.length === 0 ? <Empty text="None overdue 🎉" /> : (
                <ul className="space-y-2">
                  {overdue.slice(0, 5).map((t) => {
                    const late = Math.floor((now.getTime() - new Date(t.dueDate!).getTime()) / 864e5);
                    return (
                      <li key={t.id}>
                        <button type="button" onClick={() => openTask(t.id)} className="flex w-full items-center justify-between gap-2 rounded-md px-1.5 py-1 text-left text-[13px] transition-colors hover:bg-accent/60" title="Open task">
                          <span className="flex min-w-0 items-center gap-1.5"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" /><span className="truncate">{t.title}</span></span>
                          <span className="shrink-0 text-[11px] font-medium text-red-600">{late}d late</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <Link to="/tasks" className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-red-600 hover:underline">View all overdue <ArrowRight className="h-3 w-3" /></Link>
            </div>
            {/* Due soon */}
            <div>
              <span className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-amber-600">Due in Next 3 Days</span>
              {dueSoon.length === 0 ? <Empty text="Nothing due soon" /> : (
                <ul className="space-y-2">
                  {dueSoon.slice(0, 5).map((t) => (
                    <li key={t.id}>
                      <button type="button" onClick={() => openTask(t.id)} className="flex w-full items-center justify-between gap-2 rounded-md px-1.5 py-1 text-left text-[13px] transition-colors hover:bg-accent/60" title="Open task">
                        <span className="flex min-w-0 items-center gap-1.5"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" /><span className="truncate">{t.title}</span></span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{new Date(t.dueDate!).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <Link to="/compliance" className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 hover:underline">View all upcoming <ArrowRight className="h-3 w-3" /></Link>
            </div>
            {/* High value pending */}
            <div>
              <span className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-blue-600">High Value Pending</span>
              {highValue.length === 0 ? <Empty text={canViewReports ? 'No pending invoices' : 'No access'} /> : (
                <ul className="space-y-2">
                  {highValue.map((p) => (
                    <li key={p.taskId} className="flex items-center justify-between gap-2 text-[13px]">
                      <span className="flex min-w-0 items-center gap-1.5"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" /><span className="truncate">{p.customerName} – {p.title}</span></span>
                      <span className="shrink-0 font-mono text-[11px] tabular-nums">{fmtP(Number(p.suggestedAmountPaise))}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link to="/invoices" className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline">View all <ArrowRight className="h-3 w-3" /></Link>
            </div>
          </div>
        </div>

        {/* Task distribution donut */}
        <div className="panel">
          <div className="mb-2 flex items-center justify-between">
            <div className="panel-title mb-0">Task Distribution</div>
            <Link to="/tasks" className="text-[11px] font-medium text-primary hover:underline">View Board →</Link>
          </div>
          {donutTotal === 0 ? <Empty text="No task data" /> : (
            <div className="flex items-center gap-3">
              <div className="relative h-36 w-36 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donut} dataKey="value" innerRadius={46} outerRadius={68} paddingAngle={2} stroke="none" isAnimationActive={false}>
                      {donut.map((d) => <Cell key={d.key} fill={d.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--panel))', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold leading-none tabular-nums">{donutTotal}</span>
                  <span className="text-[10px] text-muted-foreground">All Time</span>
                </div>
              </div>
              <ul className="min-w-0 flex-1 space-y-1.5">
                {donut.map((d) => (
                  <li key={d.key} className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="flex min-w-0 items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: d.color }} /><span className="truncate">{d.name}</span></span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{d.value} <span className="text-[10px]">({Math.round((d.value / donutTotal) * 1000) / 10}%)</span></span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Due Today · Staff Overdue · Staff Utilization */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Due Today */}
        <div className="panel">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="panel-title mb-0 flex items-center gap-1.5"><Calendar className="h-4 w-4 text-amber-600" /> Due Today</div>
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">{dueToday.length}</span>
          </div>
          {dueToday.length === 0 ? <Empty text="Nothing due today 🎉" /> : (
            <ul className="space-y-0.5">
              {dueToday.slice(0, 6).map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => openTask(t.id)} className="flex w-full items-center justify-between gap-2 rounded-md px-1.5 py-1.5 text-left text-[13px] transition-colors hover:bg-accent/60" title="Open task">
                    <span className="flex min-w-0 items-center gap-1.5"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" /><span className="truncate">{t.title}</span></span>
                    <StatusPill status={t.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {dueToday.length > 6 && <p className="mt-2 px-1.5 text-[11px] text-muted-foreground">+{dueToday.length - 6} more due today</p>}
        </div>

        {/* Staff Overdue Report */}
        <div className="panel">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="panel-title mb-0 flex items-center gap-1.5"><AlertTriangle className="h-4 w-4 text-red-600" /> Staff Overdue Report</div>
            <Link to="/tasks" className="shrink-0 text-[11px] font-medium text-primary hover:underline">View →</Link>
          </div>
          {staffOverdue.length === 0 ? <Empty text="No overdue tasks 🎉" /> : (
            <ul className="space-y-2.5">
              {staffOverdue.slice(0, 6).map((s) => {
                const name = s.userId === 'unassigned' ? 'Unassigned' : (userMap[s.userId] || 'User');
                const max = staffOverdue[0]?.count || 1;
                return (
                  <li key={s.userId} className="text-[13px]">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate" title={name}>{name}</span>
                      <span className="shrink-0 font-semibold tabular-nums text-red-600">{s.count}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-accent/40">
                      <div className="h-full rounded-full bg-red-500" style={{ width: `${(s.count / max) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Staff Utilization */}
        <div className="panel">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="panel-title mb-0 flex items-center gap-1.5"><Gauge className="h-4 w-4 text-blue-600" /> Staff Utilization</div>
            <Link to="/analytics" className="shrink-0 text-[11px] font-medium text-primary hover:underline">View →</Link>
          </div>
          {staffUtil.length === 0 ? <Empty text={canViewReports ? 'No utilization data' : 'Reporting access required'} /> : (
            <ul className="space-y-2.5">
              {staffUtil.map((s) => {
                const u = Math.round(s.utilizationPct);
                const color = u >= 85 ? '#ef4444' : u >= 60 ? '#10b981' : u >= 35 ? '#f59e0b' : '#94a3b8';
                return (
                  <li key={s.userId} className="text-[13px]">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate" title={s.userName}>{s.userName}</span>
                      <span className="shrink-0 font-semibold tabular-nums" style={{ color }}>{u}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-accent/40">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, u)}%`, background: color }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Financial Performance + Operations Overview */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel">
          <div className="mb-3 flex items-center justify-between"><div className="panel-title mb-0">Financial Performance</div><span className="text-[11px] text-muted-foreground">{PERIODS.find((p) => p.key === period)?.label}</span></div>
          {!canViewReports || !overview ? <Empty text="Reporting access required" /> : (
            <>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                <Stat label="Revenue" value={fmtP(overview.totalRevenuePaise)} delta={pct(overview.totalRevenuePaise, prev?.totalRevenuePaise)} deltaSuffix={`vs ${prevLabel}`} />
                <Stat label="Margin" value={fmtP(overview.marginPaise)} sub={`${marginPct}% of revenue`} tone="emerald" />
                <Stat label="Outstanding" value={fmtP(overview.outstandingPaise)} />
                <Stat label="Collection Rate" value={`${collectionRate}%`} />
              </div>
              <div className="mt-3 h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={finChart} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} width={42} tickFormatter={(v) => `₹${v >= 100000 ? (v / 100000).toFixed(1) + 'L' : v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v}`} />
                    <Tooltip formatter={(v: number) => fmtP(v * 100)} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--panel))', fontSize: 12 }} />
                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#revFill)" dot={{ r: 2.5 }} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>

        <div className="panel">
          <div className="mb-3 flex items-center justify-between"><div className="panel-title mb-0">Operations Overview</div><span className="text-[11px] text-muted-foreground">{PERIODS.find((p) => p.key === period)?.label}</span></div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            <Stat label="Completion Rate" value={overview ? `${overview.taskCompletionRate}%` : '—'} delta={pct(overview?.taskCompletionRate, prev?.taskCompletionRate)} deltaSuffix={`vs ${prevLabel}`} />
            <Stat label="On-time Delivery" value={overview ? `${overview.onTimeDeliveryRate}%` : '—'} delta={pct(overview?.onTimeDeliveryRate, prev?.onTimeDeliveryRate)} deltaSuffix={`vs ${prevLabel}`} />
            <Stat label="Avg Turnaround" value={overview?.avgCompletionDays != null ? `${overview.avgCompletionDays} Days` : '—'} />
            <Stat label="Active Tasks" value={String(activeCount)} sub={`${tasks.length} all time`} />
          </div>
          <div className="mt-5">
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-accent/40">
              {ops.map((o) => o.count > 0 && <div key={o.key} style={{ width: `${(o.count / opsTotal) * 100}%`, background: o.color }} title={`${o.label}: ${o.count}`} />)}
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
              {ops.map((o) => (
                <li key={o.key} className="flex items-center gap-1.5 text-[12px]">
                  <span className="h-2 w-2 rounded-sm" style={{ background: o.color }} />
                  <span className="text-muted-foreground">{o.label}</span>
                  <span className="ml-auto tabular-nums font-medium">{o.count} <span className="text-[10px] text-muted-foreground">({Math.round((o.count / opsTotal) * 1000) / 10}%)</span></span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Top staff / clients / activity */}
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="panel lg:col-span-5">
          <div className="mb-2 flex items-center justify-between"><div className="panel-title mb-0">Top Staff by Revenue</div><Link to="/analytics" className="text-[11px] font-medium text-primary hover:underline">View all →</Link></div>
          {topStaff.length === 0 ? <Empty text={canViewReports ? 'No data' : 'Reporting access required'} /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-[13px]">
                <thead className="text-[10.5px] uppercase text-muted-foreground"><tr><th className="py-1.5 font-medium">#</th><th className="font-medium">Staff</th><th className="whitespace-nowrap text-right font-medium">Revenue</th><th className="whitespace-nowrap text-right font-medium">Hours</th><th className="whitespace-nowrap text-right font-medium">Util</th><th className="whitespace-nowrap text-right font-medium">Realization</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {topStaff.map((s, i) => (
                    <tr key={s.userId}>
                      <td className="py-2 pr-2 text-muted-foreground">{i + 1}</td>
                      <td className="pr-3 font-medium"><span className="block max-w-[150px] truncate" title={s.userName}>{s.userName}</span></td>
                      <td className="whitespace-nowrap text-right font-mono tabular-nums">{fmtP(s.revenuePaise)}</td>
                      <td className="whitespace-nowrap pl-3 text-right tabular-nums text-muted-foreground">{(s.totalMinutes / 60).toFixed(2)}</td>
                      <td className="whitespace-nowrap pl-3 text-right tabular-nums text-muted-foreground">{s.utilizationPct}%</td>
                      <td className="whitespace-nowrap pl-3 text-right font-mono tabular-nums text-muted-foreground">{fmtP(s.ratePerHourPaise)}/hr</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel lg:col-span-4">
          <div className="mb-2 flex items-center justify-between"><div className="panel-title mb-0">Top Clients by Revenue</div><Link to="/analytics" className="text-[11px] font-medium text-primary hover:underline">View all →</Link></div>
          {topClients.length === 0 ? <Empty text={canViewReports ? 'No data' : 'Reporting access required'} /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[360px] text-left text-[13px]">
                <thead className="text-[10.5px] uppercase text-muted-foreground"><tr><th className="py-1.5 font-medium">#</th><th className="font-medium">Client</th><th className="whitespace-nowrap text-right font-medium">Revenue</th><th className="whitespace-nowrap text-right font-medium">Outstanding</th><th className="whitespace-nowrap text-right font-medium">Profit.</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {topClients.map((c, i) => (
                    <tr key={c.customerId}>
                      <td className="py-2 pr-2 text-muted-foreground">{i + 1}</td>
                      <td className="pr-3 font-medium"><span className="block max-w-[130px] truncate" title={c.customerName}>{c.customerName}</span></td>
                      <td className="whitespace-nowrap text-right font-mono tabular-nums">{fmtP(c.revenuePaise)}</td>
                      <td className="whitespace-nowrap pl-3 text-right font-mono tabular-nums text-muted-foreground">{fmtP(c.outstandingPaise)}</td>
                      <td className="whitespace-nowrap pl-3 text-right tabular-nums">
                        <span className={`inline-flex items-center gap-1 ${c.marginPct >= 50 ? 'text-emerald-600' : c.marginPct >= 0 ? 'text-amber-600' : 'text-red-600'}`}>
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'currentColor' }} />{c.marginPct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel lg:col-span-3">
          <div className="mb-2 flex items-center justify-between"><div className="panel-title mb-0">Recently Updated</div></div>
          {!canViewAudit ? <Empty text="No access" /> : audit.length === 0 ? <Empty text="No recent activity" /> : (
            <ul className="space-y-3">
              {audit.slice(0, 6).map((a) => (
                <li key={a.id} className="flex gap-2.5">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/60"><FileText className="h-3 w-3 text-muted-foreground" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium leading-tight">{auditTitle(a)}</p>
                    <p className="text-[10.5px] text-muted-foreground">By {a.userId ? userMap[a.userId] || 'User' : 'System'} · {new Date(a.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function auditTitle(a: AuditRow): string {
  const name = (a.afterJson?.title || a.afterJson?.name || a.afterJson?.invoiceNo || a.afterJson?.customerNameSnapshot) as string | undefined;
  const verb = a.action.replace(/^[a-z]+\./, '').replace(/_/g, ' ');
  const entity = a.entityType.replace(/_/g, ' ');
  return name ? `${name} — ${verb}` : `${entity} ${verb}`;
}

const TONES: Record<string, { ring: string; bg: string; icon: string }> = {
  emerald: { ring: 'border-border', bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: 'text-emerald-600' },
  violet: { ring: 'border-border', bg: 'bg-violet-50 dark:bg-violet-900/20', icon: 'text-violet-600' },
  blue: { ring: 'border-border', bg: 'bg-blue-50 dark:bg-blue-900/20', icon: 'text-blue-600' },
  amber: { ring: 'border-border', bg: 'bg-amber-50 dark:bg-amber-900/20', icon: 'text-amber-600' },
  red: { ring: 'border-red-300 dark:border-red-900/50', bg: 'bg-red-100 dark:bg-red-900/30', icon: 'text-red-600' },
};

function Kpi({ label, value, sub, icon, tone, delta, deltaSuffix, spark, alert }: {
  label: string; value: string; sub?: string; icon: React.ReactNode; tone: string;
  delta?: number | null; deltaSuffix?: string; spark?: number[]; alert?: boolean;
}) {
  const t = TONES[tone] || TONES.blue;
  return (
    <div className={`min-w-0 overflow-hidden rounded-xl border bg-panel p-4 shadow-sm ${alert ? t.ring + ' ' + (t.bg && 'bg-red-50/50 dark:bg-red-900/10') : 'border-border'}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground" title={label}>{label}</p>
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${t.bg}`}>{React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: `h-3.5 w-3.5 ${t.icon}` })}</span>
      </div>
      <p className={`mt-1.5 truncate text-2xl font-bold tracking-tight tabular-nums ${alert ? 'text-red-600' : ''}`} title={value}>{value}</p>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        {delta != null && (
          <span className={`inline-flex shrink-0 items-center gap-0.5 text-[10.5px] font-semibold ${delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{Math.abs(delta)}%
          </span>
        )}
        {(sub || deltaSuffix) && <span className="min-w-0 truncate text-[10.5px] text-muted-foreground">{delta != null ? deltaSuffix : sub}</span>}
      </div>
      {spark && spark.length > 1 && <Spark data={spark} className={t.icon} />}
    </div>
  );
}

function Spark({ data, className }: { data: number[]; className?: string }) {
  const max = Math.max(...data, 1); const min = Math.min(...data, 0);
  const range = max - min || 1; const w = 100; const h = 22;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-6 w-full" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth={2} className={className} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Stat({ label, value, sub, delta, deltaSuffix, tone }: { label: string; value: string; sub?: string; delta?: number | null; deltaSuffix?: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground" title={label}>{label}</p>
      <p className={`mt-0.5 truncate text-lg font-bold tabular-nums ${tone === 'emerald' ? 'text-emerald-600' : ''}`} title={value}>{value}</p>
      {delta != null ? (
        <span className={`inline-flex items-center gap-0.5 text-[10.5px] font-semibold ${delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
          {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{Math.abs(delta)}% <span className="font-normal text-muted-foreground">{deltaSuffix}</span>
        </span>
      ) : sub ? <p className="text-[10.5px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-8 text-center text-xs text-muted-foreground">{text}</p>;
}

function StatusPill({ status }: { status: string }) {
  const m = STATUS_META[status];
  const color = m?.color ?? '#94a3b8';
  return (
    <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: `${color}22`, color }}>
      {m?.label ?? status.replace(/_/g, ' ')}
    </span>
  );
}
