import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface Service {
  id: string;
  code: string;
  name: string;
  defaultBillingAmount?: string;
  recurrenceDefault: string;
  defaultAssigneeStrategy?: string;
}

export default function ServicesPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('service.create');
  const [services, setServices] = useState<Service[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', defaultBillingAmount: '', recurrenceDefault: 'none' });
  const [error, setError] = useState('');

  const load = () => api<Service[]>('/services-catalog').then(setServices).catch(() => {});
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api('/services-catalog', { method: 'POST', body: JSON.stringify(form) });
      setShowForm(false);
      setForm({ code: '', name: '', defaultBillingAmount: '', recurrenceDefault: 'none' });
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  return (
    <section className="space-y-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Services Catalog</h2>
        {canCreate && (
          <button className="primary-button" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'Add Service'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="panel space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Code</label>
              <input className="input-field" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
              <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Default Billing (paise)</label>
              <input className="input-field" value={form.defaultBillingAmount} onChange={(e) => setForm({ ...form, defaultBillingAmount: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Recurrence</label>
              <select className="input-field" value={form.recurrenceDefault} onChange={(e) => setForm({ ...form, recurrenceDefault: e.target.value })}>
                {['none', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" className="primary-button">Create</button>
        </form>
      )}

      <div className="panel overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2">Code</th>
              <th>Name</th>
              <th>Recurrence</th>
              <th>Default Billing</th>
              <th>Strategy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {services.map((s) => (
              <tr key={s.id}>
                <td className="py-3 font-mono text-xs font-medium">{s.code}</td>
                <td>{s.name}</td>
                <td className="text-xs">{s.recurrenceDefault}</td>
                <td className="text-xs">{s.defaultBillingAmount ? `₹${(Number(s.defaultBillingAmount) / 100).toLocaleString('en-IN')}` : '-'}</td>
                <td className="text-xs">{s.defaultAssigneeStrategy?.replace(/_/g, ' ') || '-'}</td>
              </tr>
            ))}
            {services.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No services found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
