import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, BarChart3, Briefcase, Calendar, CheckCircle2, Clock, FileText, Percent, ReceiptText, Target, TrendingUp, Users, Wallet } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

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

interface TaskLite {
  id: string;
  title: string;
  status: string;
  customerId: string;
  assignedToUserId?: string;
  dueDate?: string;
  priority: string;
}

function fmtP(p: number) {
  const r = p / 100;
  if (r >= 10000000) return `₹${(r / 10000000).toFixed(2)}Cr`;
  if (r >= 100000) return `₹${(r / 100000).toFixed(2)}L`;
  if (r >= 1000) return `₹${(r / 1000).toFixed(1)}K`;
  return `₹${r.toFixed(0)}`;
}
function fmtH(m: number) { return (m / 60).toFixed(1); }
function isoDay(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function periodWindow(p: Period) {
  const now = new Date();
  const today = isoDay(now);
  if (p === 'today') return { from: today, to: today };
  if (p === 'week') {
    const start = new Date(now); const dow = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - dow);
    return { from: isoDay(start), to: today };
  }
  if (p === 'month') return { from: isoDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
  if (p === 'qtd') {
    const q = Math.floor(now.getMonth() / 3) * 3;
    return { from: isoDay(new Date(now.getFullYear(), q, 1)), to: today };
  }
  // ytd (FY)
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return { from: isoDay(new Date(y, 3, 1)), to: today };
}

export default function DashboardPage() {
  const { hasPermission } = useAuth();
  const canViewReports = hasPermission('report.view');
  const isPartner = hasPermission('dashboard.partner');
  const isManager = hasPermission('dashboard.manager');
  const canViewAll = isPartner || isManager;

  const [period, setPeriod] = useState<Period>('month');
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [tasks, setTasks] = useState<TaskLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshAt, setRefreshAt] = useState(Date.now());

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const w = periodWindow(period);
      const promises: Promise<unknown>[] = [];
      if (canViewReports) {
        promises.push(
          api<AnalyticsOverview>(`/analytics/overview?from=${w.from}&to=${w.to}`).then(setOverview).catch(() => setOverview(null)),
        );
      } else {
        setOverview(null);
      }
      // Fetch all task pages
      const base = canViewAll ? '/tasks' : '/tasks/my';
      const all: TaskLite[] = [];
      const fetchPage = async (cursor?: string): Promise<void> => {
        const url = cursor ? `${base}?limit=100&cursor=${cursor}` : `${base}?limit=100`;
        const r = await api<{ data: TaskLite[]; nextCursor?: string }>(url);
        all.push(...(r.data || []));
        if (r.nextCursor) await fetchPage(r.nextCursor);
      };
      promises.push(fetchPage().then(() => setTasks(all)));
      await Promise.all(promises);
    } finally {
      setLoading(false);
    }
  }, [period, canViewReports, canViewAll]);

  useEffect(() => { loadAll(); }, [loadAll, refreshAt]);

  // Derived metrics from tasks
  const now = new Date();
  const next7 = new Date(); next7.setDate(next7.getDate() + 7);
  const statusCounts = useMemo(() => tasks.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {}), [tasks]);
  const overdueTasks = tasks.filter((t) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed' && t.status !== 'cancelled');
  const wipTasks = tasks.filter((t) => t.status === 'in_progress');
  const upcomingTasks = tasks
    .filter((t) => t.dueDate && new Date(t.dueDate) >= now && new Date(t.dueDate) <= next7 && t.status !== 'completed' && t.status !== 'cancelled')
    .sort((a, b) => new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime())
    .slice(0, 7);

  const workloadData = Object.entries(statusCounts).map(([name, count]) => ({ name: name.replace(/_/g, ' '), count }));

  const PERIODS: { key: Period; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'qtd', label: 'QTD' },
    { key: 'ytd', label: 'YTD' },
  ];

  const collectionRate = overview && overview.invoicedPaise > 0 ? Math.round((overview.collectedPaise / overview.invoicedPaise) * 1000) / 10 : 0;
  const marginPct = overview && overview.totalRevenuePaise > 0 ? Math.round((overview.marginPaise / overview.totalRevenuePaise) * 1000) / 10 : 0;

  return (
    <section className="space-y-5 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Dashboard</h2>
          <p className="text-xs text-muted-foreground">{canViewAll ? 'Firm-wide overview' : 'Your work at a glance'} {loading && '· refreshing…'}</p>
        </div>
        <div className="flex items-center gap-2">
          <div role="tablist" className="inline-flex rounded-lg border border-border bg-panel p-0.5">
            {PERIODS.map((p) => (
              <button key={p.key} role="tab" aria-selected={period === p.key} onClick={() => setPeriod(p.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${period === p.key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={() => setRefreshAt(Date.now())} className="secondary-button text-xs" title="Refresh">
            <Activity className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Revenue KPIs (only for users with report.view) */}
      {canViewReports && overview && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Revenue" value={fmtP(overview.totalRevenuePaise)} sub={`Avg rate ${fmtP(overview.avgRatePaise)}/hr`} icon={<TrendingUp />} color="emerald" />
            <Kpi label="Margin" value={fmtP(overview.marginPaise)} sub={`${marginPct}% of revenue · Cost ${fmtP(overview.costPaise)}`} icon={<Wallet />} color="indigo" />
            <Kpi label="Invoiced" value={fmtP(overview.invoicedPaise)} sub={`Outstanding ${fmtP(overview.outstandingPaise)}`} icon={<ReceiptText />} color="amber" />
            <Kpi label="Collected" value={fmtP(overview.collectedPaise)} sub={`${collectionRate}% collection rate`} icon={<CheckCircle2 />} color="emerald" />
          </div>

          {/* Productivity KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Total Hours" value={fmtH(overview.totalMinutes)} sub={`${fmtH(overview.billableMinutes)} billable`} icon={<Clock />} color="blue" />
            <Kpi label="Utilization" value={`${overview.utilizationPct}%`} sub="Billable / capacity" icon={<Percent />} color={overview.utilizationPct >= 60 ? 'emerald' : overview.utilizationPct >= 30 ? 'amber' : 'red'} />
            <Kpi label="Completion Rate" value={`${overview.taskCompletionRate}%`} sub={overview.avgCompletionDays !== null ? `Avg ${overview.avgCompletionDays}d to close` : 'No completed tasks'} icon={<Target />} color="indigo" />
            <Kpi label="On-time Delivery" value={`${overview.onTimeDeliveryRate}%`} sub="Closed by due date" icon={<Calendar />} color={overview.onTimeDeliveryRate >= 80 ? 'emerald' : overview.onTimeDeliveryRate >= 50 ? 'amber' : 'red'} />
          </div>
        </>
      )}

      {/* Task health row (uses task list — always available) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label={canViewAll ? 'WIP Tasks' : 'My WIP'} value={String(wipTasks.length)} sub="In progress" icon={<Clock />} color="blue" />
        <Kpi label={canViewAll ? 'Overdue' : 'My Overdue'} value={String(overdueTasks.length)} sub={overdueTasks.length === 0 ? 'All on track' : 'Need attention'} icon={<AlertTriangle />} color={overdueTasks.length > 0 ? 'red' : 'emerald'} />
        <Kpi label="Due Next 7 Days" value={String(upcomingTasks.length)} sub="Upcoming workload" icon={<Calendar />} color="amber" />
        <Kpi label="Total Active" value={String(tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled').length)} sub={`${tasks.length} all time`} icon={<FileText />} color="indigo" />
      </div>

      {/* Charts + top lists */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Status distribution */}
        <div className="panel lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <div className="panel-title mb-0">{canViewAll ? 'Task Distribution by Status' : 'My Tasks by Status'}</div>
            <Link to="/tasks" className="text-[11px] font-medium text-primary hover:underline">Open Board →</Link>
          </div>
          {workloadData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workloadData} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border))',
                      background: 'hsl(var(--panel))',
                      boxShadow: 'var(--shadow-md)',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BarChart3 className="mb-2 h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No task data yet</p>
            </div>
          )}
        </div>

        {/* Upcoming due */}
        <div className="panel">
          <div className="mb-3 flex items-center justify-between">
            <div className="panel-title mb-0">Due Next 7 Days</div>
            <Link to="/compliance" className="text-[11px] font-medium text-primary hover:underline">Calendar →</Link>
          </div>
          {upcomingTasks.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Nothing due this week 🎉</p>
          ) : (
            <ul className="space-y-2">
              {upcomingTasks.map((t) => {
                const days = Math.ceil((new Date(t.dueDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <li key={t.id} className="rounded-md border border-border p-2.5 hover:bg-accent/30">
                    <div className="flex items-start justify-between gap-2">
                      <span className="truncate text-[13px] font-medium text-foreground">{t.title}</span>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-semibold ${days <= 1 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : days <= 3 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                        {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days}d`}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10.5px] text-muted-foreground">
                      {t.status.replace(/_/g, ' ')} · {new Date(t.dueDate!).toLocaleDateString('en-IN')}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Top staff + clients (only for users with report.view) */}
      {canViewReports && overview && (overview.topStaff.length > 0 || overview.topClients.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Leaderboard title="Top Staff by Revenue" icon={<Users className="h-4 w-4 text-primary" />} link="/analytics"
            rows={overview.topStaff.map((r) => ({ name: r.userName, revenue: r.revenuePaise, sub: `${r.hours.toFixed(2)} hrs logged` }))} />
          <Leaderboard title="Top Clients by Revenue" icon={<Briefcase className="h-4 w-4 text-primary" />} link="/analytics"
            rows={overview.topClients.map((r) => ({ name: r.customerName, revenue: r.revenuePaise, sub: `${r.hours.toFixed(2)} hrs logged` }))} />
        </div>
      )}

      {/* Overdue task list (manager+ only) */}
      {canViewAll && overdueTasks.length > 0 && (
        <div className="panel">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <h3 className="text-sm font-semibold">Overdue Tasks ({overdueTasks.length})</h3>
            </div>
            <Link to="/tasks" className="text-[11px] font-medium text-primary hover:underline">View all →</Link>
          </div>
          <ul className="divide-y divide-border">
            {overdueTasks.slice(0, 8).map((t) => {
              const lateDays = Math.floor((now.getTime() - new Date(t.dueDate!).getTime()) / (1000 * 60 * 60 * 24));
              return (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">{t.title}</div>
                    <div className="text-[11px] text-muted-foreground">{t.status.replace(/_/g, ' ')} · Due {new Date(t.dueDate!).toLocaleDateString('en-IN')}</div>
                  </div>
                  <span className="rounded bg-red-100 px-2 py-0.5 text-[10.5px] font-bold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                    {lateDays} day{lateDays === 1 ? '' : 's'} late
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

const COLOR_MAP: Record<string, { bg: string; icon: string }> = {
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: 'text-emerald-600 dark:text-emerald-400' },
  blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', icon: 'text-blue-600 dark:text-blue-400' },
  red: { bg: 'bg-red-50 dark:bg-red-900/20', icon: 'text-red-600 dark:text-red-400' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-900/20', icon: 'text-amber-600 dark:text-amber-400' },
  indigo: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', icon: 'text-indigo-600 dark:text-indigo-400' },
};

function Kpi({ label, value, sub, icon, color }: { label: string; value: string; sub?: string; icon: React.ReactNode; color: string }) {
  const c = COLOR_MAP[color] || COLOR_MAP.blue;
  return (
    <div className="metric group">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">{value}</p>
          {sub && <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">{sub}</p>}
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${c.bg} transition-transform group-hover:scale-110`}>
          {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: `h-4 w-4 ${c.icon}` })}
        </div>
      </div>
    </div>
  );
}

function Leaderboard({ title, rows, icon, link }: { title: string; rows: { name: string; revenue: number; sub: string }[]; icon: React.ReactNode; link?: string }) {
  const max = Math.max(...rows.map((r) => r.revenue), 1);
  return (
    <div className="panel">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        {link && <Link to={link} className="text-[11px] font-medium text-primary hover:underline">Details →</Link>}
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">No data</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((r, i) => (
            <li key={`${r.name}-${i}`} className="flex items-center gap-3">
              <span className="w-5 text-center text-[11px] font-bold text-muted-foreground">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate font-medium text-foreground">{r.name}</span>
                  <span className="ml-2 font-mono text-xs tabular-nums text-foreground">{fmtP(r.revenue)}</span>
                </div>
                <div className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-accent/50">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-primary/70" style={{ width: `${(r.revenue / max) * 100}%` }} />
                </div>
                <div className="mt-0.5 text-[10.5px] text-muted-foreground">{r.sub}</div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
