import { useCallback, useEffect, useState } from 'react';
import { Activity, BarChart3, Briefcase, ClipboardCheck, Clock, DollarSign, Download, Percent, ReceiptText, Target, TrendingUp, Users, Wallet } from 'lucide-react';
import { api } from '../lib/api';

type Preset = 'today' | 'week' | 'month' | 'lastmonth' | 'qtd' | 'ytd' | 'custom';

interface Overview {
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
interface StaffPerf {
  userId: string; userName: string; email: string;
  totalMinutes: number; billableMinutes: number; nonBillableMinutes: number;
  revenuePaise: number; costPaise: number; marginPaise: number; marginPct: number;
  utilizationPct: number; entries: number; distinctTasks: number; distinctClients: number;
  tasksCompleted: number; avgCompletionDays: number | null; onTimePct: number; ratePerHourPaise: number;
}
interface ClientPerf {
  customerId: string; customerName: string;
  totalMinutes: number; billableMinutes: number;
  revenuePaise: number; invoicedPaise: number; collectedPaise: number; outstandingPaise: number;
  entries: number; distinctTasks: number; distinctStaff: number; tasksCompleted: number;
  marginPaise: number; marginPct: number;
}

const fmtP = (p: number) => `₹${(p / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmtPdec = (p: number) => `₹${(p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtH = (m: number) => (m / 60).toFixed(2);
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

function isoDay(d: Date) {
  const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function presetWindow(preset: Preset): { from: string; to: string } {
  const now = new Date();
  const today = isoDay(now);
  if (preset === 'today') return { from: today, to: today };
  if (preset === 'week') {
    const start = new Date(now); const dow = (start.getDay() + 6) % 7; start.setDate(start.getDate() - dow);
    return { from: isoDay(start), to: today };
  }
  if (preset === 'month') return { from: isoDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
  if (preset === 'lastmonth') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: isoDay(start), to: isoDay(end) };
  }
  if (preset === 'qtd') {
    const q = Math.floor(now.getMonth() / 3) * 3;
    return { from: isoDay(new Date(now.getFullYear(), q, 1)), to: today };
  }
  if (preset === 'ytd') {
    const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return { from: isoDay(new Date(y, 3, 1)), to: today };
  }
  return { from: today, to: today };
}

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

export default function AnalyticsPage() {
  const [preset, setPreset] = useState<Preset>('ytd');
  const initial = presetWindow('ytd');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [tab, setTab] = useState<'overview' | 'staff' | 'clients'>('overview');

  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [filterUserId, setFilterUserId] = useState('');
  const [filterCustomerId, setFilterCustomerId] = useState('');

  const [overview, setOverview] = useState<Overview | null>(null);
  const [staffRows, setStaffRows] = useState<StaffPerf[]>([]);
  const [clientRows, setClientRows] = useState<ClientPerf[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p !== 'custom') { const w = presetWindow(p); setFrom(w.from); setTo(w.to); }
  };

  const buildQs = useCallback((extra: Record<string, string> = {}) => {
    const params = new URLSearchParams({ from, to, ...extra });
    if (filterUserId) params.set('userId', filterUserId);
    if (filterCustomerId) params.set('customerId', filterCustomerId);
    return params.toString();
  }, [from, to, filterUserId, filterCustomerId]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const qs = buildQs();
      const [ov, st, cl] = await Promise.all([
        api<Overview>(`/analytics/overview?${qs}`),
        api<{ rows: StaffPerf[] }>(`/analytics/staff?${qs}`),
        api<{ rows: ClientPerf[] }>(`/analytics/clients?${qs}`),
      ]);
      setOverview(ov); setStaffRows(st.rows || []); setClientRows(cl.rows || []);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to load analytics'); }
    finally { setLoading(false); }
  }, [buildQs]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api<{ id: string; name: string }[]>('/users').then(setUsers).catch(() => {});
    api<{ id: string; name: string }[]>('/customers').then(setCustomers).catch(() => {});
  }, []);

  const PRESET_TABS: { key: Preset; label: string }[] = [
    { key: 'today', label: 'Today' }, { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' }, { key: 'lastmonth', label: 'Last Month' },
    { key: 'qtd', label: 'QTD' }, { key: 'ytd', label: 'YTD (FY)' },
    { key: 'custom', label: 'Custom' },
  ];

  const exportCsv = () => {
    if (tab === 'staff') {
      downloadCsv(
        `staff-analytics_${from}_${to}.csv`,
        ['Staff', 'Email', 'Total Hrs', 'Billable Hrs', 'Util %', 'Revenue (₹)', 'Cost (₹)', 'Margin (₹)', 'Margin %', 'Avg Rate (₹/hr)', 'Tasks', 'Completed', 'Avg Completion (days)', 'On-time %'],
        staffRows.map((r) => [
          r.userName, r.email, fmtH(r.totalMinutes), fmtH(r.billableMinutes), r.utilizationPct,
          (r.revenuePaise / 100).toFixed(2), (r.costPaise / 100).toFixed(2), (r.marginPaise / 100).toFixed(2), r.marginPct,
          (r.ratePerHourPaise / 100).toFixed(0), r.distinctTasks, r.tasksCompleted, r.avgCompletionDays ?? '-', r.onTimePct,
        ]),
      );
    } else if (tab === 'clients') {
      downloadCsv(
        `client-analytics_${from}_${to}.csv`,
        ['Client', 'Hours', 'Revenue (₹)', 'Cost (₹)', 'Margin (₹)', 'Margin %', 'Invoiced (₹)', 'Collected (₹)', 'Outstanding (₹)', 'Tasks', 'Staff'],
        clientRows.map((r) => [
          r.customerName, fmtH(r.totalMinutes), (r.revenuePaise / 100).toFixed(2), ((r.revenuePaise - r.marginPaise) / 100).toFixed(2),
          (r.marginPaise / 100).toFixed(2), r.marginPct,
          (r.invoicedPaise / 100).toFixed(2), (r.collectedPaise / 100).toFixed(2), (r.outstandingPaise / 100).toFixed(2),
          r.distinctTasks, r.distinctStaff,
        ]),
      );
    }
  };

  return (
    <section className="space-y-4 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Business Analytics</h2>
          <p className="text-xs text-muted-foreground">Revenue, productivity, and performance KPIs.</p>
        </div>
        <div className="flex items-center gap-2">
          {(tab === 'staff' || tab === 'clients') && (
            <button className="secondary-button text-xs" onClick={exportCsv}><Download className="h-3.5 w-3.5" /> Export CSV</button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="panel space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" className="inline-flex flex-wrap rounded-lg border border-border bg-panel p-0.5">
            {PRESET_TABS.map((t) => (
              <button key={t.key} role="tab" aria-selected={preset === t.key} onClick={() => applyPreset(t.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${preset === t.key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-5">
          <div>
            <label className="field-label">From</label>
            <input type="date" className="input-field" value={from} onChange={(e) => { setFrom(e.target.value); setPreset('custom'); }} />
          </div>
          <div>
            <label className="field-label">To</label>
            <input type="date" className="input-field" value={to} onChange={(e) => { setTo(e.target.value); setPreset('custom'); }} />
          </div>
          <div>
            <label className="field-label">Filter Staff</label>
            <select className="input-field" value={filterUserId} onChange={(e) => setFilterUserId(e.target.value)}>
              <option value="">All Staff</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Filter Client</label>
            <select className="input-field" value={filterCustomerId} onChange={(e) => setFilterCustomerId(e.target.value)}>
              <option value="">All Clients</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button className="primary-button text-xs w-full" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
          </div>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">{error}</div>}

      {/* Tabs */}
      <div className="inline-flex rounded-lg border border-border bg-panel p-0.5">
        {([
          { key: 'overview', label: 'Overview', icon: <BarChart3 className="h-3.5 w-3.5" /> },
          { key: 'staff', label: 'Staff Performance', icon: <Users className="h-3.5 w-3.5" /> },
          { key: 'clients', label: 'Client Profitability', icon: <Briefcase className="h-3.5 w-3.5" /> },
        ] as const).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${tab === t.key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && overview && (
        <div className="space-y-4">
          {/* KPI cards row 1: revenue/margin */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi icon={<DollarSign className="h-4 w-4" />} label="Total Revenue" value={fmtP(overview.totalRevenuePaise)} sub={`Avg rate ${fmtP(overview.avgRatePaise)}/hr`} tone="primary" />
            <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Margin" value={fmtP(overview.marginPaise)} sub={`Cost ${fmtP(overview.costPaise)} · ${overview.totalRevenuePaise > 0 ? Math.round((overview.marginPaise / overview.totalRevenuePaise) * 1000) / 10 : 0}%`} tone="success" />
            <Kpi icon={<ReceiptText className="h-4 w-4" />} label="Invoiced" value={fmtP(overview.invoicedPaise)} sub={`Outstanding ${fmtP(overview.outstandingPaise)}`} tone="amber" />
            <Kpi icon={<Wallet className="h-4 w-4" />} label="Collected" value={fmtP(overview.collectedPaise)} sub={`${overview.invoicedPaise > 0 ? Math.round((overview.collectedPaise / overview.invoicedPaise) * 1000) / 10 : 0}% of invoiced`} tone="indigo" />
          </div>

          {/* KPI row 2: productivity */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi icon={<Clock className="h-4 w-4" />} label="Total Hours" value={fmtH(overview.totalMinutes)} sub={`Billable ${fmtH(overview.billableMinutes)}`} tone="primary" />
            <Kpi icon={<Percent className="h-4 w-4" />} label="Utilization" value={`${overview.utilizationPct}%`} sub={`Billable / capacity (8h × business days)`} tone="success" />
            <Kpi icon={<ClipboardCheck className="h-4 w-4" />} label="Completion Rate" value={`${overview.taskCompletionRate}%`} sub={overview.avgCompletionDays !== null ? `Avg ${overview.avgCompletionDays}d to close` : 'No completed tasks'} tone="amber" />
            <Kpi icon={<Target className="h-4 w-4" />} label="On-time Delivery" value={`${overview.onTimeDeliveryRate}%`} sub={`Closed by due date`} tone="indigo" />
          </div>

          {/* Top staff + top clients */}
          <div className="grid gap-3 lg:grid-cols-2">
            <Leaderboard title="Top 5 Staff by Revenue" rows={overview.topStaff.map((r) => ({ name: r.userName, revenue: r.revenuePaise, hours: r.hours }))} icon={<Users className="h-4 w-4 text-primary" />} />
            <Leaderboard title="Top 5 Clients by Revenue" rows={overview.topClients.map((r) => ({ name: r.customerName, revenue: r.revenuePaise, hours: r.hours }))} icon={<Briefcase className="h-4 w-4 text-primary" />} />
          </div>

          {/* Revenue by month bar chart (CSS) */}
          {overview.revenueByMonth.length > 0 && (
            <div className="panel">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Revenue by Month</h3>
                </div>
                <span className="text-[11px] text-muted-foreground">{fmtDate(overview.from)} → {fmtDate(overview.to)}</span>
              </div>
              {(() => {
                const max = Math.max(...overview.revenueByMonth.map((m) => m.revenuePaise), 1);
                return (
                  <div className="space-y-2">
                    {overview.revenueByMonth.map((m) => (
                      <div key={m.month} className="flex items-center gap-3">
                        <div className="w-20 text-[11px] font-mono text-muted-foreground">{m.month}</div>
                        <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-accent/40">
                          <div className="absolute inset-y-0 left-0 rounded-md bg-primary/80" style={{ width: `${(m.revenuePaise / max) * 100}%` }} />
                          <div className="absolute inset-0 flex items-center justify-end pr-2">
                            <span className="text-[10.5px] font-semibold text-foreground mix-blend-difference">{fmtP(m.revenuePaise)}</span>
                          </div>
                        </div>
                        <div className="w-16 text-right text-[11px] text-muted-foreground">{m.hours.toFixed(1)} h</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* STAFF PERF */}
      {tab === 'staff' && (
        <div className="panel overflow-hidden p-0">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">Staff Performance & Appraisal Data</h3>
            <p className="text-[11px] text-muted-foreground">Productivity, billability, revenue and quality metrics for performance reviews.</p>
          </div>
          {staffRows.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">No staff activity in this window.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="bg-background text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-semibold">Staff</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Hrs</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Bill Hrs</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Util %</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Revenue</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Cost</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Margin</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Margin %</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Avg Rate</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Tasks</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Completed</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Avg Days</th>
                    <th className="px-3 py-2.5 text-right font-semibold">On-time %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {staffRows.map((r) => (
                    <tr key={r.userId} className="hover:bg-accent/30">
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-foreground">{r.userName}</div>
                        <div className="text-[11px] text-muted-foreground">{r.email}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">{fmtH(r.totalMinutes)}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">{fmtH(r.billableMinutes)}</td>
                      <td className={`px-3 py-2.5 text-right font-mono tabular-nums ${r.utilizationPct >= 70 ? 'text-green-700 dark:text-green-400' : r.utilizationPct >= 40 ? 'text-amber-700 dark:text-amber-400' : 'text-red-700 dark:text-red-400'}`}>{r.utilizationPct}%</td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums">{fmtP(r.revenuePaise)}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-muted-foreground">{fmtP(r.costPaise)}</td>
                      <td className={`px-3 py-2.5 text-right font-mono font-semibold tabular-nums ${r.marginPaise >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>{fmtP(r.marginPaise)}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">{r.marginPct}%</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">{fmtP(r.ratePerHourPaise)}/h</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.distinctTasks}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.tasksCompleted}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.avgCompletionDays ?? '-'}</td>
                      <td className={`px-3 py-2.5 text-right font-mono tabular-nums ${r.onTimePct >= 80 ? 'text-green-700 dark:text-green-400' : r.onTimePct >= 50 ? 'text-amber-700 dark:text-amber-400' : 'text-red-700 dark:text-red-400'}`}>{r.onTimePct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CLIENT PROFITABILITY */}
      {tab === 'clients' && (
        <div className="panel overflow-hidden p-0">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">Client Profitability</h3>
            <p className="text-[11px] text-muted-foreground">Revenue earned vs effort spent and invoicing status per client.</p>
          </div>
          {clientRows.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">No client activity in this window.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-sm">
                <thead className="bg-background text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-semibold">Client</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Hrs</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Revenue</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Cost</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Margin</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Margin %</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Invoiced</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Collected</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Outstanding</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Tasks</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Staff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {clientRows.map((r) => {
                    const cost = r.revenuePaise - r.marginPaise;
                    return (
                      <tr key={r.customerId || 'unknown'} className="hover:bg-accent/30">
                        <td className="px-3 py-2.5 font-medium">{r.customerName}</td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums">{fmtH(r.totalMinutes)}</td>
                        <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums">{fmtP(r.revenuePaise)}</td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums text-muted-foreground">{fmtP(cost)}</td>
                        <td className={`px-3 py-2.5 text-right font-mono font-semibold tabular-nums ${r.marginPaise >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>{fmtP(r.marginPaise)}</td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums">{r.marginPct}%</td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums">{fmtP(r.invoicedPaise)}</td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums text-green-700 dark:text-green-400">{fmtP(r.collectedPaise)}</td>
                        <td className={`px-3 py-2.5 text-right font-mono tabular-nums ${r.outstandingPaise > 0 ? 'text-amber-700 dark:text-amber-400' : ''}`}>{fmtP(r.outstandingPaise)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{r.distinctTasks}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{r.distinctStaff}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Kpi({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub: string; tone: 'primary' | 'success' | 'amber' | 'indigo' | 'red' }) {
  const tones: Record<typeof tone, string> = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  };
  return (
    <div className="metric flex items-center gap-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-lg font-bold text-foreground tabular-nums">{value}</p>
        <p className="text-[10.5px] text-muted-foreground truncate">{sub}</p>
      </div>
    </div>
  );
}

function Leaderboard({ title, rows, icon }: { title: string; rows: { name: string; revenue: number; hours: number }[]; icon: React.ReactNode }) {
  const max = Math.max(...rows.map((r) => r.revenue), 1);
  return (
    <div className="panel">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">No data</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="w-5 text-center text-[11px] font-bold text-muted-foreground">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate font-medium text-foreground">{r.name}</span>
                  <span className="ml-2 font-mono text-xs tabular-nums text-foreground">{fmtPdec(r.revenue)}</span>
                </div>
                <div className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-accent/50">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-primary/70" style={{ width: `${(r.revenue / max) * 100}%` }} />
                </div>
                <div className="mt-0.5 text-[10.5px] text-muted-foreground">{r.hours.toFixed(2)} hrs logged</div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
