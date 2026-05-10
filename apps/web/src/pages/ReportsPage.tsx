import { useEffect, useMemo, useState, useCallback } from 'react';
import { Users, Briefcase, Download, Calendar, X, Clock, CheckCircle2, Wallet, FileSpreadsheet } from 'lucide-react';
import { api } from '../lib/api';

type ReportMode = 'staff' | 'client';
type Preset = 'today' | 'week' | 'month' | 'lastmonth' | 'custom';

interface StaffRow {
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

interface ClientRow {
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

interface WorkLogRow {
  id: string;
  startedAt: string;
  endedAt: string | null;
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

interface ReportSummary {
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

const fmtMin = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
const fmtHrs = (mins: number) => (mins / 60).toFixed(2);
const fmtPaise = (p: number) => `₹${(p / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtDateTime = (d: string | Date) => new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

function isoDay(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function presetWindow(preset: Preset): { from: string; to: string } {
  const now = new Date();
  const today = isoDay(now);
  if (preset === 'today') return { from: today, to: today };
  if (preset === 'week') {
    const start = new Date(now);
    const dow = (start.getDay() + 6) % 7; // Mon=0
    start.setDate(start.getDate() - dow);
    return { from: isoDay(start), to: today };
  }
  if (preset === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: isoDay(start), to: today };
  }
  if (preset === 'lastmonth') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: isoDay(start), to: isoDay(end) };
  }
  return { from: today, to: today };
}

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [mode, setMode] = useState<ReportMode>('staff');
  const [preset, setPreset] = useState<Preset>('month');
  const initial = presetWindow('month');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [billableOnly, setBillableOnly] = useState(false);
  const [filterUserId, setFilterUserId] = useState('');
  const [filterCustomerId, setFilterCustomerId] = useState('');

  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [staffRows, setStaffRows] = useState<StaffRow[]>([]);
  const [clientRows, setClientRows] = useState<ClientRow[]>([]);
  const [drilldown, setDrilldown] = useState<{ title: string; eyebrow: string; rows: WorkLogRow[] } | null>(null);

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p !== 'custom') {
      const w = presetWindow(p);
      setFrom(w.from);
      setTo(w.to);
    }
  };

  const buildQs = useCallback((extra?: Record<string, string>) => {
    const params = new URLSearchParams({ from, to });
    if (billableOnly) params.set('billableOnly', 'true');
    if (filterUserId) params.set('userId', filterUserId);
    if (filterCustomerId) params.set('customerId', filterCustomerId);
    if (extra) for (const [k, v] of Object.entries(extra)) params.set(k, v);
    return params.toString();
  }, [from, to, billableOnly, filterUserId, filterCustomerId]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = buildQs();
      if (mode === 'staff') {
        const r = await api<{ summary: ReportSummary; rows: StaffRow[] }>(`/reports/staff?${qs}`);
        setStaffRows(r.rows || []);
        setSummary(r.summary);
      } else {
        const r = await api<{ summary: ReportSummary; rows: ClientRow[] }>(`/reports/client?${qs}`);
        setClientRows(r.rows || []);
        setSummary(r.summary);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [mode, buildQs]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  useEffect(() => {
    api<{ id: string; name: string }[]>('/users').then(setUsers).catch(() => setUsers([]));
    api<{ id: string; name: string }[]>('/customers').then(setCustomers).catch(() => setCustomers([]));
  }, []);

  const openDrilldown = async (mode: ReportMode, id: string, label: string) => {
    try {
      const qs = buildQs(mode === 'staff' ? { userId: id } : { customerId: id });
      const r = await api<{ summary: ReportSummary; rows: WorkLogRow[] }>(`/reports/work-logs?${qs}`);
      setDrilldown({
        title: label,
        eyebrow: `${mode === 'staff' ? 'Staff' : 'Client'} • ${fmtDate(from)} → ${fmtDate(to)}`,
        rows: r.rows || [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load work logs');
    }
  };

  const exportCsv = () => {
    if (mode === 'staff') {
      downloadCsv(
        `staff-report_${from}_${to}.csv`,
        ['Staff', 'Email', 'Total Hours', 'Billable Hours', 'Non-Billable Hours', 'Entries', 'Tasks', 'Clients', 'Estimated Value (₹)'],
        staffRows.map((r) => [
          r.userName, r.userEmail, fmtHrs(r.totalMinutes), fmtHrs(r.billableMinutes), fmtHrs(r.nonBillableMinutes),
          r.totalEntries, r.distinctTasks, r.distinctClients, (r.estimatedValuePaise / 100).toFixed(2),
        ]),
      );
    } else {
      downloadCsv(
        `client-report_${from}_${to}.csv`,
        ['Client', 'Total Hours', 'Billable Hours', 'Non-Billable Hours', 'Entries', 'Tasks', 'Staff', 'Estimated Value (₹)'],
        clientRows.map((r) => [
          r.customerName, fmtHrs(r.totalMinutes), fmtHrs(r.billableMinutes), fmtHrs(r.nonBillableMinutes),
          r.totalEntries, r.distinctTasks, r.distinctStaff, (r.estimatedValuePaise / 100).toFixed(2),
        ]),
      );
    }
  };

  const exportDrilldownCsv = () => {
    if (!drilldown) return;
    downloadCsv(
      `worklogs_${drilldown.title.replace(/\s+/g, '-')}_${from}_${to}.csv`,
      ['Date', 'Staff', 'Client', 'Task', 'Service', 'Hours', 'Billable', 'Notes'],
      drilldown.rows.map((r) => [
        fmtDateTime(r.startedAt), r.userName, r.customerName || '-', r.taskTitle, r.serviceName || '-',
        fmtHrs(r.durationMinutes), r.isBillable ? 'Yes' : 'No', r.notes || '',
      ]),
    );
  };

  const PRESET_TABS: { key: Preset; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'lastmonth', label: 'Last Month' },
    { key: 'custom', label: 'Custom' },
  ];

  const billablePct = useMemo(() => {
    if (!summary || summary.totalMinutes === 0) return 0;
    return Math.round((summary.billableMinutes / summary.totalMinutes) * 100);
  }, [summary]);

  return (
    <section className="space-y-4 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Reports</h2>
          <p className="text-xs text-muted-foreground">Track work logs by staff and client across any period.</p>
        </div>
        <button onClick={exportCsv} className="secondary-button text-xs" disabled={loading || (mode === 'staff' ? staffRows.length === 0 : clientRows.length === 0)}>
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {/* Mode + Preset Controls */}
      <div className="panel space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div role="tablist" aria-label="Report type" className="inline-flex rounded-lg border border-border bg-panel p-0.5">
            <button
              role="tab"
              aria-selected={mode === 'staff'}
              onClick={() => setMode('staff')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${mode === 'staff' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent'}`}
            >
              <Users className="h-3.5 w-3.5" /> Staff Report
            </button>
            <button
              role="tab"
              aria-selected={mode === 'client'}
              onClick={() => setMode('client')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${mode === 'client' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent'}`}
            >
              <Briefcase className="h-3.5 w-3.5" /> Client Report
            </button>
          </div>
          <div role="tablist" aria-label="Period" className="inline-flex flex-wrap rounded-lg border border-border bg-panel p-0.5">
            {PRESET_TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={preset === t.key}
                onClick={() => applyPreset(t.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${preset === t.key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="field-label">From</label>
            <input type="date" className="input-field" value={from} onChange={(e) => { setFrom(e.target.value); setPreset('custom'); }} />
          </div>
          <div>
            <label className="field-label">To</label>
            <input type="date" className="input-field" value={to} onChange={(e) => { setTo(e.target.value); setPreset('custom'); }} />
          </div>
          {mode === 'staff' && (
            <div>
              <label className="field-label">Specific Staff</label>
              <select className="input-field" value={filterUserId} onChange={(e) => setFilterUserId(e.target.value)}>
                <option value="">All Staff</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          )}
          {mode === 'client' && (
            <div>
              <label className="field-label">Specific Client</label>
              <select className="input-field" value={filterCustomerId} onChange={(e) => setFilterCustomerId(e.target.value)}>
                <option value="">All Clients</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex items-end">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
              <input
                type="checkbox"
                checked={billableOnly}
                onChange={(e) => setBillableOnly(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-current"
              />
              Billable only
            </label>
          </div>
          <div className="flex items-end">
            <button onClick={loadReport} className="primary-button text-xs w-full" disabled={loading}>
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard
            icon={<Clock className="h-4 w-4" />}
            label="Total Hours"
            value={fmtHrs(summary.totalMinutes)}
            sub={`${summary.totalEntries} entries`}
            tone="primary"
          />
          <SummaryCard
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Billable Hours"
            value={fmtHrs(summary.billableMinutes)}
            sub={`${billablePct}% of total`}
            tone="success"
          />
          <SummaryCard
            icon={<Wallet className="h-4 w-4" />}
            label="Estimated Value"
            value={fmtPaise(summary.estimatedValuePaise)}
            sub={summary.estimatedValuePaise === 0 ? 'No hourly rate set' : 'Billable × rate'}
            tone="amber"
          />
          <SummaryCard
            icon={mode === 'staff' ? <Users className="h-4 w-4" /> : <Briefcase className="h-4 w-4" />}
            label={mode === 'staff' ? 'Active Staff' : 'Active Clients'}
            value={String(mode === 'staff' ? staffRows.length : clientRows.length)}
            sub={`${summary.distinctTasks} tasks`}
            tone="indigo"
          />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Data Table */}
      <div className="panel overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">
            {mode === 'staff' ? 'Staff Productivity' : 'Client Engagement'}
            <span className="ml-2 text-xs font-normal text-muted-foreground">{fmtDate(from)} → {fmtDate(to)}</span>
          </h3>
        </div>
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : mode === 'staff' ? (
          staffRows.length === 0 ? (
            <EmptyState mode="staff" />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-background text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold">Staff</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Total Hrs</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Billable</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Non-Billable</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Tasks</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Clients</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Value</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {staffRows.map((r) => {
                  const billPct = r.totalMinutes ? Math.round((r.billableMinutes / r.totalMinutes) * 100) : 0;
                  return (
                    <tr key={r.userId} className="hover:bg-accent/30">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-foreground">{r.userName}</div>
                        <div className="text-[11px] text-muted-foreground">{r.userEmail}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">{fmtHrs(r.totalMinutes)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="font-mono tabular-nums text-foreground">{fmtHrs(r.billableMinutes)}</div>
                        <div className="text-[10px] text-muted-foreground">{billPct}%</div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-muted-foreground">{fmtHrs(r.nonBillableMinutes)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{r.distinctTasks}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{r.distinctClients}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-foreground">{fmtPaise(r.estimatedValuePaise)}</td>
                      <td className="px-2 py-2.5 text-right">
                        <button onClick={() => openDrilldown('staff', r.userId, r.userName)} className="text-[11px] font-medium text-primary hover:underline">View Logs</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        ) : (
          clientRows.length === 0 ? (
            <EmptyState mode="client" />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-background text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold">Client</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Total Hrs</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Billable</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Non-Billable</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Tasks</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Staff</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Value</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {clientRows.map((r) => {
                  const billPct = r.totalMinutes ? Math.round((r.billableMinutes / r.totalMinutes) * 100) : 0;
                  return (
                    <tr key={r.customerId || 'unknown'} className="hover:bg-accent/30">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-foreground">{r.customerName}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">{fmtHrs(r.totalMinutes)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="font-mono tabular-nums text-foreground">{fmtHrs(r.billableMinutes)}</div>
                        <div className="text-[10px] text-muted-foreground">{billPct}%</div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-muted-foreground">{fmtHrs(r.nonBillableMinutes)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{r.distinctTasks}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{r.distinctStaff}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-foreground">{fmtPaise(r.estimatedValuePaise)}</td>
                      <td className="px-2 py-2.5 text-right">
                        <button onClick={() => openDrilldown('client', r.customerId, r.customerName)} className="text-[11px] font-medium text-primary hover:underline">View Logs</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        )}
      </div>

      {/* Drilldown Modal */}
      {drilldown && (
        <div className="modal-overlay" onClick={() => setDrilldown(null)} role="dialog" aria-modal="true" aria-labelledby="drill-title">
          <div className="modal-card modal-xl" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="min-w-0">
                <span className="modal-eyebrow">{drilldown.eyebrow}</span>
                <h3 id="drill-title" className="modal-title truncate">{drilldown.title}</h3>
                <p className="modal-subtitle">{drilldown.rows.length} work log entries · {fmtHrs(drilldown.rows.reduce((s, r) => s + r.durationMinutes, 0))} hrs</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={exportDrilldownCsv} className="secondary-button text-xs" disabled={drilldown.rows.length === 0}>
                  <FileSpreadsheet className="h-3.5 w-3.5" /> CSV
                </button>
                <button className="modal-close" onClick={() => setDrilldown(null)} aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="modal-body is-flush">
              {drilldown.rows.length === 0 ? (
                <div className="p-12 text-center text-sm text-muted-foreground">No work logs in this period.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-semibold">Date</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Staff</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Client</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Task</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Service</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Hrs</th>
                      <th className="px-4 py-2.5 text-center font-semibold">Billable</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {drilldown.rows.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-2 text-[12px] text-muted-foreground tabular-nums">{fmtDateTime(r.startedAt)}</td>
                        <td className="px-4 py-2 text-[12px] font-medium text-foreground">{r.userName}</td>
                        <td className="px-4 py-2 text-[12px]">{r.customerName || '-'}</td>
                        <td className="px-4 py-2 text-[12px]">{r.taskTitle}</td>
                        <td className="px-4 py-2 text-[12px] text-muted-foreground">{r.serviceName || '-'}</td>
                        <td className="px-4 py-2 text-right text-[12px] font-mono tabular-nums">{fmtHrs(r.durationMinutes)}</td>
                        <td className="px-4 py-2 text-center">
                          {r.isBillable ? (
                            <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-300">Yes</span>
                          ) : (
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-400">No</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-[11.5px] text-muted-foreground max-w-[240px] truncate" title={r.notes || ''}>{r.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function SummaryCard({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub: string; tone: 'primary' | 'success' | 'amber' | 'indigo' }) {
  const toneClasses: Record<typeof tone, string> = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  };
  return (
    <div className="metric flex items-center gap-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneClasses[tone]}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-lg font-bold text-foreground tabular-nums">{value}</p>
        <p className="text-[10.5px] text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

function EmptyState({ mode }: { mode: ReportMode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-12 text-center">
      <Calendar className="h-8 w-8 text-muted-foreground/50" />
      <p className="text-sm font-medium text-foreground">No work logs in this period</p>
      <p className="max-w-xs text-xs text-muted-foreground">
        {mode === 'staff' ? 'No staff logged time on tasks in the selected window.' : 'No clients had time logged in the selected window.'} Try widening the date range or removing filters.
      </p>
    </div>
  );
}
