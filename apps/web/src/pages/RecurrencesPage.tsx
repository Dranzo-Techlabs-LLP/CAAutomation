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
  }, []);

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

  return (
    <section className="space-y-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recurrences</h2>
        {canCreate && (
          <button className="primary-button" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'Create Recurrence'}
          </button>
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
