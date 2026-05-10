import { useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface Service {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  hsnSac?: string | null;
  defaultGstRate?: string | null;
  defaultBillingAmount?: string;
  recurrenceDefault: string;
  defaultAssigneeStrategy?: string;
}

const RECURRENCES = ['none', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'];
const GST_RATES = ['0', '5', '12', '18', '28'];

export default function ServicesPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('service.create');
  const [services, setServices] = useState<Service[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [form, setForm] = useState({ code: '', name: '', description: '', hsnSac: '', defaultGstRate: '18', defaultBillingAmount: '', recurrenceDefault: 'none' });
  const [error, setError] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const load = () => api<Service[]>('/services-catalog').then(setServices).catch(() => {});
  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm({ code: '', name: '', description: '', hsnSac: '', defaultGstRate: '18', defaultBillingAmount: '', recurrenceDefault: 'none' });
    setShowForm(false);
    setEditingService(null);
    setError('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api('/services-catalog', { method: 'POST', body: JSON.stringify(form) });
      resetForm();
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleEdit = (s: Service) => {
    setEditingService(s);
    setForm({
      code: s.code,
      name: s.name,
      description: s.description || '',
      hsnSac: s.hsnSac || '',
      defaultGstRate: s.defaultGstRate || '18',
      defaultBillingAmount: s.defaultBillingAmount || '',
      recurrenceDefault: s.recurrenceDefault,
    });
    setShowForm(false);
    setError('');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;
    setError('');
    try {
      await api(`/services-catalog/${editingService.id}`, { method: 'PATCH', body: JSON.stringify(form) });
      resetForm();
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api(`/services-catalog/${id}`, { method: 'DELETE' });
      setDeleteConfirmId(null);
      load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Delete failed');
      setDeleteConfirmId(null);
    }
  };

  return (
    <section className="space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Services Catalog</h2>
        {canCreate && (
          <button className="primary-button text-sm" onClick={() => { if (editingService) { resetForm(); } else { setShowForm(!showForm); } }}>
            {showForm || editingService ? 'Cancel' : 'Add Service'}
          </button>
        )}
      </div>

      {(showForm || editingService) && (
        <form onSubmit={editingService ? handleUpdate : handleCreate} className="panel space-y-4">
          <div className="panel-title">{editingService ? 'Edit Service' : 'New Service'}</div>
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">{error}</div>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="field-label">Code *</label>
              <input className="input-field" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required placeholder="GST-RET" />
            </div>
            <div>
              <label className="field-label">Name *</label>
              <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="GST Returns Filing" />
            </div>
            <div>
              <label className="field-label">HSN / SAC</label>
              <input className="input-field" value={form.hsnSac} onChange={(e) => setForm({ ...form, hsnSac: e.target.value })} placeholder="998231" maxLength={20} />
              <p className="mt-0.5 text-[10.5px] text-muted-foreground">SAC for services / HSN for goods. Auto-fills on invoice.</p>
            </div>
            <div>
              <label className="field-label">Default GST %</label>
              <select className="input-field" value={form.defaultGstRate} onChange={(e) => setForm({ ...form, defaultGstRate: e.target.value })}>
                {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Default Billing (₹)</label>
              <input
                className="input-field"
                type="number"
                step="0.01"
                value={form.defaultBillingAmount ? (Number(form.defaultBillingAmount) / 100).toString() : ''}
                onChange={(e) => {
                  const rupees = Number(e.target.value || 0);
                  setForm({ ...form, defaultBillingAmount: String(Math.round(rupees * 100)) });
                }}
                placeholder="5000.00"
              />
              {form.defaultBillingAmount && Number(form.defaultBillingAmount) > 0 && <p className="mt-0.5 text-[10.5px] text-muted-foreground">Stored as {form.defaultBillingAmount} paise</p>}
            </div>
            <div>
              <label className="field-label">Recurrence</label>
              <select className="input-field" value={form.recurrenceDefault} onChange={(e) => setForm({ ...form, recurrenceDefault: e.target.value })}>
                {RECURRENCES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <label className="field-label">Description</label>
              <textarea className="input-field" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Monthly GSTR-1 / GSTR-3B preparation and filing for the period" />
              <p className="mt-0.5 text-[10.5px] text-muted-foreground">Used as default invoice line description; can be edited per invoice.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <button type="button" className="secondary-button" onClick={resetForm}>Cancel</button>
            <button type="submit" className="primary-button">{editingService ? 'Save Changes' : 'Create Service'}</button>
          </div>
        </form>
      )}

      <div className="panel overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2">Code</th>
              <th>Name</th>
              <th>HSN/SAC</th>
              <th>GST %</th>
              <th>Recurrence</th>
              <th>Default Billing</th>
              <th>Strategy</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {services.map((s) => (
              <tr key={s.id}>
                <td className="py-3 font-mono text-xs font-medium">{s.code}</td>
                <td>
                  <div className="text-sm font-medium">{s.name}</div>
                  {s.description && <div className="truncate text-[11px] text-muted-foreground max-w-[280px]" title={s.description}>{s.description}</div>}
                </td>
                <td className="font-mono text-xs">{s.hsnSac || '-'}</td>
                <td className="text-xs">{s.defaultGstRate ? `${s.defaultGstRate}%` : '-'}</td>
                <td className="text-xs">{s.recurrenceDefault}</td>
                <td className="text-xs">{s.defaultBillingAmount ? `₹${(Number(s.defaultBillingAmount) / 100).toLocaleString('en-IN')}` : '-'}</td>
                <td className="text-xs">{s.defaultAssigneeStrategy?.replace(/_/g, ' ') || '-'}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <button className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title="Edit" onClick={() => handleEdit(s)}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    {deleteConfirmId === s.id ? (
                      <div className="flex items-center gap-1">
                        <button className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700" onClick={() => handleDelete(s.id)}>Yes</button>
                        <button className="rounded border border-border px-2 py-1 text-xs hover:bg-accent" onClick={() => setDeleteConfirmId(null)}>No</button>
                      </div>
                    ) : (
                      <button className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20" title="Delete" onClick={() => setDeleteConfirmId(s.id)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {services.length === 0 && (
              <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">No services found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
