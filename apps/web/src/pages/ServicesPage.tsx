import { useEffect, useState } from 'react';
import { ListChecks, Pencil, Plus, Trash2, X } from 'lucide-react';
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
  defaultHourlyRate?: string | null;
  recurrenceDefault: string;
  defaultAssigneeStrategy?: string;
}

interface SubtaskTemplate {
  id: string;
  serviceId: string;
  title: string;
  description?: string | null;
  sortOrder: number;
  estimatedHours?: string | null;
  priority: string;
}

const RECURRENCES = ['none', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'];
const GST_RATES = ['0', '5', '12', '18', '28'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

export default function ServicesPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('service.create');
  const [services, setServices] = useState<Service[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [form, setForm] = useState({ code: '', name: '', description: '', hsnSac: '', defaultGstRate: '18', defaultBillingAmount: '', defaultHourlyRate: '', recurrenceDefault: 'none' });
  const [error, setError] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Subtask templates manager
  const [templatesService, setTemplatesService] = useState<Service | null>(null);
  const [templates, setTemplates] = useState<SubtaskTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [tplDraft, setTplDraft] = useState({ title: '', description: '', estimatedHours: '', priority: 'medium' });
  const [editingTplId, setEditingTplId] = useState<string | null>(null);

  const load = () => api<Service[]>('/services-catalog').then(setServices).catch(() => {});
  useEffect(() => { load(); }, []);

  const loadTemplates = async (serviceId: string) => {
    setTemplatesLoading(true);
    try {
      const list = await api<SubtaskTemplate[]>(`/services-catalog/${serviceId}/subtask-templates`);
      setTemplates(list);
    } catch { setTemplates([]); }
    finally { setTemplatesLoading(false); }
  };

  const openTemplatesFor = async (s: Service) => {
    setTemplatesService(s);
    setTplDraft({ title: '', description: '', estimatedHours: '', priority: 'medium' });
    setEditingTplId(null);
    await loadTemplates(s.id);
  };

  const closeTemplates = () => {
    setTemplatesService(null);
    setTemplates([]);
    setEditingTplId(null);
  };

  const submitTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templatesService) return;
    try {
      if (editingTplId) {
        await api(`/services-catalog/${templatesService.id}/subtask-templates/${editingTplId}`, {
          method: 'PATCH',
          body: JSON.stringify(tplDraft),
        });
      } else {
        await api(`/services-catalog/${templatesService.id}/subtask-templates`, {
          method: 'POST',
          body: JSON.stringify(tplDraft),
        });
      }
      setTplDraft({ title: '', description: '', estimatedHours: '', priority: 'medium' });
      setEditingTplId(null);
      await loadTemplates(templatesService.id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed');
    }
  };

  const editTemplate = (t: SubtaskTemplate) => {
    setEditingTplId(t.id);
    setTplDraft({
      title: t.title,
      description: t.description || '',
      estimatedHours: t.estimatedHours || '',
      priority: t.priority,
    });
  };

  const deleteTemplate = async (id: string) => {
    if (!templatesService) return;
    if (!confirm('Delete this subtask template?')) return;
    try {
      await api(`/services-catalog/${templatesService.id}/subtask-templates/${id}`, { method: 'DELETE' });
      await loadTemplates(templatesService.id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const moveTemplate = async (idx: number, delta: number) => {
    if (!templatesService) return;
    const next = [...templates];
    const target = idx + delta;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setTemplates(next);
    try {
      await api(`/services-catalog/${templatesService.id}/subtask-templates-reorder`, {
        method: 'PATCH',
        body: JSON.stringify({ ids: next.map((t) => t.id) }),
      });
    } catch { /* keep optimistic order */ }
  };

  const resetForm = () => {
    setForm({ code: '', name: '', description: '', hsnSac: '', defaultGstRate: '18', defaultBillingAmount: '', defaultHourlyRate: '', recurrenceDefault: 'none' });
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
      defaultHourlyRate: s.defaultHourlyRate || '',
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
              <label className="field-label">Default Hourly Rate (₹/hr)</label>
              <input
                className="input-field"
                type="number"
                step="0.01"
                value={form.defaultHourlyRate ? (Number(form.defaultHourlyRate) / 100).toString() : ''}
                onChange={(e) => {
                  const rupees = Number(e.target.value || 0);
                  setForm({ ...form, defaultHourlyRate: rupees > 0 ? String(Math.round(rupees * 100)) : '' });
                }}
                placeholder="2000.00"
              />
              <p className="mt-0.5 text-[10.5px] text-muted-foreground">Used to compute revenue from time logs on this service.</p>
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
                    <button className="inline-flex items-center gap-1 rounded p-1 text-primary hover:bg-primary/10" title="Manage subtask templates" onClick={() => openTemplatesFor(s)}>
                      <ListChecks className="h-4 w-4" />
                    </button>
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

      {/* Subtask Templates Modal */}
      {templatesService && (
        <div className="modal-overlay" onClick={closeTemplates} role="dialog" aria-modal="true" aria-labelledby="tpl-title">
          <div className="modal-card modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="min-w-0">
                <span className="modal-eyebrow">Service • {templatesService.code}</span>
                <h3 id="tpl-title" className="modal-title truncate">Subtask Templates — {templatesService.name}</h3>
                <p className="modal-subtitle">{templates.length} template{templates.length === 1 ? '' : 's'}. Auto-created as subtasks when a task uses this service. Each can be edited or removed per task.</p>
              </div>
              <button className="modal-close" onClick={closeTemplates} aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="modal-body space-y-4">
              {/* Add / Edit form */}
              <form onSubmit={submitTemplate} className="rounded-lg border border-border bg-accent/20 p-3 space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{editingTplId ? 'Edit Template' : 'Add Template'}</div>
                <div className="grid gap-2 sm:grid-cols-12">
                  <div className="sm:col-span-5">
                    <input className="input-field" placeholder="Subtask title (e.g. Collect documents)" value={tplDraft.title} onChange={(e) => setTplDraft({ ...tplDraft, title: e.target.value })} required />
                  </div>
                  <div className="sm:col-span-3">
                    <input className="input-field" placeholder="Est. hours" type="number" step="0.25" value={tplDraft.estimatedHours} onChange={(e) => setTplDraft({ ...tplDraft, estimatedHours: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <select className="input-field" value={tplDraft.priority} onChange={(e) => setTplDraft({ ...tplDraft, priority: e.target.value })}>
                      {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2 flex gap-1">
                    <button type="submit" className="primary-button text-xs flex-1">{editingTplId ? 'Save' : <><Plus className="h-3.5 w-3.5" /> Add</>}</button>
                    {editingTplId && <button type="button" className="secondary-button text-xs" onClick={() => { setEditingTplId(null); setTplDraft({ title: '', description: '', estimatedHours: '', priority: 'medium' }); }}>Cancel</button>}
                  </div>
                  <div className="sm:col-span-12">
                    <textarea className="input-field" rows={2} placeholder="Description (optional)" value={tplDraft.description} onChange={(e) => setTplDraft({ ...tplDraft, description: e.target.value })} />
                  </div>
                </div>
              </form>

              {/* Templates list */}
              <div className="rounded-lg border border-border overflow-hidden">
                {templatesLoading ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
                ) : templates.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">No subtask templates yet. Add the steps you typically perform for this service above.</div>
                ) : (
                  <ul className="divide-y divide-border">
                    {templates.map((t, idx) => (
                      <li key={t.id} className="flex items-start gap-3 p-3 hover:bg-accent/30">
                        <div className="flex flex-col items-center pt-1">
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10.5px] font-bold text-primary">{idx + 1}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">{t.title}</span>
                            <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium uppercase">{t.priority}</span>
                            {t.estimatedHours && <span className="text-[11px] text-muted-foreground">{Number(t.estimatedHours).toFixed(2)} h</span>}
                          </div>
                          {t.description && <p className="mt-0.5 text-[11.5px] text-muted-foreground whitespace-pre-wrap">{t.description}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                          <button className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30" disabled={idx === 0} onClick={() => moveTemplate(idx, -1)} title="Move up">↑</button>
                          <button className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30" disabled={idx === templates.length - 1} onClick={() => moveTemplate(idx, 1)} title="Move down">↓</button>
                          <button className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title="Edit" onClick={() => editTemplate(t)}>
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20" title="Delete" onClick={() => deleteTemplate(t.id)}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="secondary-button" onClick={closeTemplates}>Close</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
