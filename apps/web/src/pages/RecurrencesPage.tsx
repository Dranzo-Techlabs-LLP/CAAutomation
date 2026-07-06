import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface Recurrence {
  id: string;
  name: string;
  customerId: string;
  serviceId: string;
  patternType: string;
  patternExpression: string;
  assignmentStrategy: string;
  isActive: boolean;
  nextRunAt?: string;
  lastRunAt?: string;
}

interface RunLog {
  id: string;
  runAt: string;
  dueDateGenerated?: string;
  status: string;
  skipReason?: string;
  errorMessage?: string;
}

interface StatutoryTemplate {
  code: string;
  name: string;
  serviceCode: string;
  patternType: string;
  patternExpression: string;
  generateLeadDays: number;
  description: string;
}

interface BulkResult {
  created: { id: string }[];
  skipped: { customerId: string; reason: string }[];
}

const PATTERN_TYPES = ['weekly', 'monthly', 'quarterly', 'yearly', 'custom_cron'];
const STRATEGIES = ['specific_user', 'team_round_robin', 'team_least_loaded', 'customer_owner', 'service_default', 'role_round_robin'];

export default function RecurrencesPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('recurrence.create');
  const canEdit = hasPermission('recurrence.edit');
  const canRun = hasPermission('recurrence.run');

  const [recurrences, setRecurrences] = useState<Recurrence[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [services, setServices] = useState<{ id: string; name: string; code: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedLog, setSelectedLog] = useState<{ id: string; logs: RunLog[] } | null>(null);
  const [form, setForm] = useState({
    name: '', customerId: '', serviceId: '', patternType: 'monthly', patternExpression: '0 0 20 * *',
    startDate: '', assignmentStrategy: 'team_least_loaded', generateLeadDays: 7,
  });
  const [error, setError] = useState('');

  // ── Bulk (multi-party) statutory setup ──
  const [templates, setTemplates] = useState<StatutoryTemplate[]>([]);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    templateCode: '', name: '', serviceId: '', patternType: 'monthly', dueDay: 11,
    startDate: '', assignmentStrategy: 'team_least_loaded', generateLeadDays: 5,
  });
  // customerId -> per-party due day (presence in the map = selected)
  const [selectedParties, setSelectedParties] = useState<Record<string, number>>({});
  const [partySearch, setPartySearch] = useState('');
  const [bulkError, setBulkError] = useState('');
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = () => api<Recurrence[]>('/recurrences').then(setRecurrences).catch(() => {});
  const deleteRecurrence = async (id: string, name: string) => {
    if (!window.confirm(`Delete recurrence "${name}"? Already-generated tasks are kept; no new ones will be created.`)) return;
    try { await api(`/recurrences/${id}`, { method: 'DELETE' }); load(); }
    catch (err) { alert(err instanceof Error ? err.message : 'Could not delete'); }
  };

  useEffect(() => {
    load();
    api<{ id: string; name: string }[]>('/customers').then(setCustomers).catch(() => {});
    api<{ id: string; name: string; code: string }[]>('/services-catalog').then(setServices).catch(() => {});
    api<StatutoryTemplate[]>('/recurrences/templates/statutory').then(setTemplates).catch(() => {});
  }, []);

  // Picking a statutory template (e.g. GSTR-1) prefills service, pattern, due day.
  const pickTemplate = (code: string) => {
    const t = templates.find((x) => x.code === code);
    if (!t) { setBulkForm((f) => ({ ...f, templateCode: '' })); return; }
    const m = /day=(\d{1,2})/.exec(t.patternExpression);
    // Firms name services descriptively (e.g. "GSTR-1 Filing") rather than by the
    // template's serviceCode ("GSTR1"), so match on a normalised code/name too.
    const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, '');
    const codeN = norm(t.serviceCode);
    const svc = services.find((s) => norm(s.code) === codeN)
      || services.find((s) => codeN.length >= 3 && norm(s.name).includes(codeN))
      || services.find((s) => codeN.length >= 3 && norm(s.code).includes(codeN));
    setBulkForm((f) => ({
      ...f,
      templateCode: code,
      name: t.name,
      patternType: t.patternType,
      dueDay: m ? Number(m[1]) : f.dueDay,
      generateLeadDays: t.generateLeadDays,
      serviceId: svc ? svc.id : f.serviceId,
    }));
  };

  const toggleParty = (id: string) => {
    setSelectedParties((prev) => {
      const next = { ...prev };
      if (id in next) delete next[id];
      else next[id] = bulkForm.dueDay;
      return next;
    });
  };
  const setPartyDueDay = (id: string, day: number) => setSelectedParties((prev) => ({ ...prev, [id]: day }));

  const handleBulkCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBulkError('');
    setBulkResult(null);
    const parties = Object.entries(selectedParties).map(([customerId, dueDay]) => ({ customerId, dueDay }));
    if (!bulkForm.serviceId) { setBulkError('Select a service (or pick a template).'); return; }
    if (!bulkForm.startDate) { setBulkError('Pick a start date.'); return; }
    if (parties.length === 0) { setBulkError('Select at least one party.'); return; }
    setBulkBusy(true);
    try {
      const res = await api<BulkResult>('/recurrences/bulk', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: bulkForm.serviceId,
          name: bulkForm.name || 'Recurring task',
          patternType: bulkForm.patternType,
          dueDay: bulkForm.dueDay,
          startDate: new Date(bulkForm.startDate).toISOString(),
          generateLeadDays: bulkForm.generateLeadDays,
          assignmentStrategy: bulkForm.assignmentStrategy,
          templateJson: { title: bulkForm.name || 'Recurring task', priority: 'medium' },
          parties,
        }),
      });
      setBulkResult(res);
      setSelectedParties({});
      load();
    } catch (err: unknown) {
      setBulkError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api('/recurrences', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          startDate: new Date(form.startDate).toISOString(),
          templateJson: { title: form.name, priority: 'medium' },
        }),
      });
      setShowForm(false);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      await api(`/recurrences/${id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !isActive }) });
      load();
    } catch {}
  };

  const runNow = async (id: string) => {
    try {
      await api(`/recurrences/${id}/run`, { method: 'POST' });
      load();
    } catch {}
  };

  const viewLog = async (id: string) => {
    try {
      const logs = await api<RunLog[]>(`/recurrences/${id}/log`);
      setSelectedLog({ id, logs });
    } catch {}
  };

  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c.name]));
  const serviceMap = Object.fromEntries(services.map((s) => [s.id, s.name]));
  const filteredCustomers = customers.filter((c) => c.name.toLowerCase().includes(partySearch.trim().toLowerCase()));
  const selectedCount = Object.keys(selectedParties).length;

  return (
    <section className="space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Recurrences</h2>
        {canCreate && (
          <div className="flex flex-wrap items-center gap-2">
            <button className="secondary-button text-sm" onClick={() => { setShowBulk((v) => !v); setShowForm(false); setBulkResult(null); setBulkError(''); }}>
              {showBulk ? 'Cancel' : 'Bulk Setup (Statutory)'}
            </button>
            <button className="primary-button" onClick={() => { setShowForm(!showForm); setShowBulk(false); }}>
              {showForm ? 'Cancel' : 'Create Recurrence'}
            </button>
          </div>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="panel space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
              <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Customer</label>
              <select className="input-field" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required>
                <option value="">Select...</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Service</label>
              <select className="input-field" value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })} required>
                <option value="">Select...</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Pattern Type</label>
              <select className="input-field" value={form.patternType} onChange={(e) => setForm({ ...form, patternType: e.target.value })}>
                {PATTERN_TYPES.map((p) => <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Cron Expression</label>
              <input className="input-field font-mono" value={form.patternExpression} onChange={(e) => setForm({ ...form, patternExpression: e.target.value })} required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Start Date</label>
              <input type="date" className="input-field" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Assignment Strategy</label>
              <select className="input-field" value={form.assignmentStrategy} onChange={(e) => setForm({ ...form, assignmentStrategy: e.target.value })}>
                {STRATEGIES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Lead Days</label>
              <input type="number" className="input-field" value={form.generateLeadDays} onChange={(e) => setForm({ ...form, generateLeadDays: Number(e.target.value) })} min={0} />
            </div>
          </div>
          <button type="submit" className="primary-button">Create</button>
        </form>
      )}

      {showBulk && (
        <form onSubmit={handleBulkCreate} className="panel space-y-4">
          <div className="flex items-center justify-between">
            <div className="panel-title mb-0">Bulk Setup — one recurring task across many parties</div>
          </div>
          <p className="text-xs text-muted-foreground">
            Pick a statutory task (e.g. GSTR-1), select the parties, set a due day per party, and create one recurring task for each — all at once.
          </p>
          {bulkError && <p className="text-sm text-red-600">{bulkError}</p>}
          {bulkResult && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
              Created <b>{bulkResult.created.length}</b> recurring task(s)
              {bulkResult.skipped.length > 0 && <> · <span className="text-amber-700 dark:text-amber-300">{bulkResult.skipped.length} skipped</span></>}.
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Statutory Template</label>
              <select className="input-field" value={bulkForm.templateCode} onChange={(e) => pickTemplate(e.target.value)}>
                <option value="">— Custom / none —</option>
                {templates.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
              <input className="input-field" value={bulkForm.name} onChange={(e) => setBulkForm({ ...bulkForm, name: e.target.value })} placeholder="e.g. GSTR-1 Monthly" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Service</label>
              <select className="input-field" value={bulkForm.serviceId} onChange={(e) => setBulkForm({ ...bulkForm, serviceId: e.target.value })} required>
                <option value="">Select...</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Pattern</label>
              <select className="input-field" value={bulkForm.patternType} onChange={(e) => setBulkForm({ ...bulkForm, patternType: e.target.value })}>
                {PATTERN_TYPES.map((p) => <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Default Due Day (of month)</label>
              <input type="number" min={1} max={31} className="input-field" value={bulkForm.dueDay} onChange={(e) => setBulkForm({ ...bulkForm, dueDay: Number(e.target.value) })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Start Date</label>
              <input type="date" className="input-field" value={bulkForm.startDate} onChange={(e) => setBulkForm({ ...bulkForm, startDate: e.target.value })} required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Assignment</label>
              <select className="input-field" value={bulkForm.assignmentStrategy} onChange={(e) => setBulkForm({ ...bulkForm, assignmentStrategy: e.target.value })}>
                {STRATEGIES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Generate Lead Days</label>
              <input type="number" min={0} className="input-field" value={bulkForm.generateLeadDays} onChange={(e) => setBulkForm({ ...bulkForm, generateLeadDays: Number(e.target.value) })} />
            </div>
          </div>

          {/* Party multi-select */}
          <div className="rounded-lg border border-border">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-2">
              <div className="flex items-center gap-2">
                <input
                  className="input-field h-8 py-1 text-sm"
                  placeholder="Search parties…"
                  value={partySearch}
                  onChange={(e) => setPartySearch(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">{selectedCount} selected</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => setSelectedParties((prev) => {
                    const next = { ...prev };
                    filteredCustomers.forEach((c) => { if (!(c.id in next)) next[c.id] = bulkForm.dueDay; });
                    return next;
                  })}
                >
                  Select all{partySearch ? ' (filtered)' : ''}
                </button>
                <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setSelectedParties({})}>Clear</button>
              </div>
            </div>
            <div className="max-h-64 space-y-0.5 overflow-y-auto p-2">
              {filteredCustomers.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">No parties</p>}
              {filteredCustomers.map((c) => {
                const selected = c.id in selectedParties;
                return (
                  <div key={c.id} className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 ${selected ? 'bg-accent/50' : ''}`}>
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
                      <input type="checkbox" checked={selected} onChange={() => toggleParty(c.id)} className="h-4 w-4 shrink-0" />
                      <span className="truncate">{c.name}</span>
                    </label>
                    {selected && (
                      <label className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                        Due day
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={selectedParties[c.id]}
                          onChange={(e) => setPartyDueDay(c.id, Number(e.target.value))}
                          className="input-field h-7 w-16 py-0 text-sm"
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <button type="submit" className="primary-button" disabled={bulkBusy}>
            {bulkBusy ? 'Creating…' : `Create for ${selectedCount || 0} part${selectedCount === 1 ? 'y' : 'ies'}`}
          </button>
        </form>
      )}

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2">Name</th>
              <th>Customer</th>
              <th>Service</th>
              <th>Pattern</th>
              <th>Next Run</th>
              <th>Strategy</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {recurrences.map((r) => (
              <tr key={r.id}>
                <td className="py-3 font-medium">{r.name}</td>
                <td>{customerMap[r.customerId] || '-'}</td>
                <td>{serviceMap[r.serviceId] || '-'}</td>
                <td className="font-mono text-xs">{r.patternExpression}</td>
                <td className="text-xs">{r.nextRunAt ? new Date(r.nextRunAt).toLocaleDateString('en-IN') : '-'}</td>
                <td className="text-xs">{r.assignmentStrategy.replace(/_/g, ' ')}</td>
                <td>
                  <span className={`rounded px-2 py-1 text-xs font-medium ${r.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                    {r.isActive ? 'Active' : 'Paused'}
                  </span>
                </td>
                <td className="space-x-1">
                  {canEdit && (
                    <button className="text-xs text-primary hover:underline" onClick={() => toggleActive(r.id, r.isActive)}>
                      {r.isActive ? 'Pause' : 'Resume'}
                    </button>
                  )}
                  {canRun && (
                    <button className="text-xs text-primary hover:underline" onClick={() => runNow(r.id)}>Run</button>
                  )}
                  <button className="text-xs text-primary hover:underline" onClick={() => viewLog(r.id)}>Log</button>
                  {canEdit && (
                    <button className="text-xs text-red-600 hover:underline" onClick={() => deleteRecurrence(r.id, r.name)}>Delete</button>
                  )}
                </td>
              </tr>
            ))}
            {recurrences.length === 0 && (
              <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">No recurrences found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedLog && (
        <div className="panel">
          <div className="mb-3 flex items-center justify-between">
            <div className="panel-title">Run Log</div>
            <button className="text-xs text-primary hover:underline" onClick={() => setSelectedLog(null)}>Close</button>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2">Run At</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {selectedLog.logs.map((log) => (
                <tr key={log.id}>
                  <td className="py-2 text-xs">{new Date(log.runAt).toLocaleString('en-IN')}</td>
                  <td className="text-xs">{log.dueDateGenerated ? new Date(log.dueDateGenerated).toLocaleDateString('en-IN') : '-'}</td>
                  <td>
                    <span className={`rounded px-2 py-1 text-xs ${log.status === 'success' ? 'bg-green-100 text-green-800' : log.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="text-xs">{log.skipReason || log.errorMessage || '-'}</td>
                </tr>
              ))}
              {selectedLog.logs.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No logs yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
