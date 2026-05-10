import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { INDIA_STATES, stateCodeFromGstin } from '../lib/billing-utils';

interface TaskStatusDef { id: string; code: string; label: string; color?: string | null; sortOrder: number; isInitial: boolean; isTerminal: boolean; isSystem: boolean; }
const STATUS_COLORS_OPTS = ['gray', 'blue', 'amber', 'orange', 'purple', 'green', 'red', 'teal', 'indigo'];
function chipClass(color?: string | null): string {
  const c = (color || 'gray').toLowerCase();
  return ({ gray:'bg-gray-100 text-gray-700', blue:'bg-blue-100 text-blue-700', amber:'bg-amber-100 text-amber-700', orange:'bg-orange-100 text-orange-700', purple:'bg-purple-100 text-purple-700', green:'bg-green-100 text-green-800', red:'bg-red-100 text-red-700', teal:'bg-teal-100 text-teal-700', indigo:'bg-indigo-100 text-indigo-700' } as Record<string,string>)[c] || 'bg-accent text-foreground';
}

interface FirmSettings {
  id: string;
  name: string;
  gstin?: string | null;
  pan?: string | null;
  address?: string | null;
  stateCode?: string | null;
  logoUrl?: string | null;
  signatureUrl?: string | null;
  signatoryName?: string | null;
  signatoryDesignation?: string | null;
  settingsJson?: Record<string, unknown> | null;
}

interface InvoiceNumberFormat {
  prefix?: string;
  suffix?: string;
  separator?: string;
  includeFy?: boolean;
  fyFormat?: 'short' | 'long';
  padding?: number;
  resetOnFy?: boolean;
  startFrom?: number;
  seriesCode?: string;
}

const DEFAULT_INV_FMT: Required<Pick<InvoiceNumberFormat, 'prefix' | 'suffix' | 'separator' | 'includeFy' | 'fyFormat' | 'padding' | 'resetOnFy' | 'startFrom' | 'seriesCode'>> = {
  prefix: '', suffix: '', separator: '/', includeFy: true, fyFormat: 'short', padding: 4, resetOnFy: true, startFrom: 1, seriesCode: 'INV',
};

function previewInvoiceNo(fmt: InvoiceNumberFormat, kind: 'INV' | 'PA' = 'INV'): string {
  const sep = fmt.separator ?? '/';
  const padding = fmt.padding ?? 4;
  const startFrom = fmt.startFrom ?? 1;
  const padded = String(startFrom).padStart(padding, '0');
  const parts: string[] = [];
  if (fmt.includeFy !== false) {
    const now = new Date();
    const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const endYear = startYear + 1;
    parts.push(fmt.fyFormat === 'long' ? `FY${startYear}-${endYear}` : `FY${String(startYear).slice(2)}-${String(endYear).slice(2)}`);
  }
  const code = kind === 'INV'
    ? (fmt.seriesCode !== undefined ? fmt.seriesCode : 'INV')
    : 'PA';
  if (code) parts.push(code);
  parts.push(padded);
  let no = parts.join(sep);
  if (fmt.prefix) no = `${fmt.prefix}${no}`;
  if (fmt.suffix) no = `${no}${fmt.suffix}`;
  return no;
}

export default function SettingsPage() {
  const [firm, setFirm] = useState<FirmSettings | null>(null);
  const [form, setForm] = useState({ name: '', gstin: '', pan: '', address: '', stateCode: '', logoUrl: '', signatureUrl: '', signatoryName: '', signatoryDesignation: '' });
  const [invFmt, setInvFmt] = useState<InvoiceNumberFormat>(DEFAULT_INV_FMT);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [logoPreview, setLogoPreview] = useState('');
  const [signaturePreview, setSignaturePreview] = useState('');
  const [statuses, setStatuses] = useState<TaskStatusDef[]>([]);
  const [newStatus, setNewStatus] = useState({ label: '', color: 'gray', isTerminal: false });
  const [editStatus, setEditStatus] = useState<TaskStatusDef | null>(null);
  const [statusEditForm, setStatusEditForm] = useState({ label: '', color: 'gray', isTerminal: false, isInitial: false });

  useEffect(() => {
    api<FirmSettings>('/settings')
      .then((f) => {
        setFirm(f);
        setForm({
          name: f.name || '',
          gstin: f.gstin || '',
          pan: f.pan || '',
          address: f.address || '',
          stateCode: f.stateCode || '',
          logoUrl: f.logoUrl || '',
          signatureUrl: f.signatureUrl || '',
          signatoryName: f.signatoryName || '',
          signatoryDesignation: f.signatoryDesignation || '',
        });
        const cfg = (f.settingsJson?.invoiceNumberFormat ?? {}) as InvoiceNumberFormat;
        setInvFmt({ ...DEFAULT_INV_FMT, ...cfg });
        if (f.logoUrl) setLogoPreview(f.logoUrl);
        if (f.signatureUrl) setSignaturePreview(f.signatureUrl);
      })
      .catch(() => {});
    api<TaskStatusDef[]>('/task-statuses').then(setStatuses).catch(() => {});
  }, []);

  const reloadStatuses = () => api<TaskStatusDef[]>('/task-statuses').then(setStatuses).catch(() => {});

  const addStatus = async () => {
    if (!newStatus.label.trim()) return;
    try {
      await api('/task-statuses', { method: 'POST', body: JSON.stringify({
        code: newStatus.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        label: newStatus.label.trim(),
        color: newStatus.color,
        isTerminal: newStatus.isTerminal,
      }) });
      setNewStatus({ label: '', color: 'gray', isTerminal: false });
      reloadStatuses();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed');
    }
  };

  const moveStatus = async (idx: number, delta: number) => {
    const next = [...statuses];
    const target = idx + delta;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setStatuses(next);
    try {
      await api('/task-statuses/reorder', { method: 'PATCH', body: JSON.stringify({ ids: next.map((s) => s.id) }) });
    } catch { /* keep optimistic */ }
  };

  const openEditStatus = (s: TaskStatusDef) => {
    setEditStatus(s);
    setStatusEditForm({ label: s.label, color: s.color || 'gray', isTerminal: s.isTerminal, isInitial: s.isInitial });
  };

  const saveEditStatus = async () => {
    if (!editStatus) return;
    try {
      await api(`/task-statuses/${editStatus.id}`, { method: 'PATCH', body: JSON.stringify(statusEditForm) });
      setEditStatus(null);
      reloadStatuses();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed');
    }
  };

  const deleteStatus = async (s: TaskStatusDef) => {
    if (s.isSystem) { alert('System statuses cannot be deleted'); return; }
    if (!confirm(`Delete status "${s.label}"? Tasks already using this code will keep the value but it will not appear in dropdowns.`)) return;
    try {
      await api(`/task-statuses/${s.id}`, { method: 'DELETE' });
      reloadStatuses();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const updated = await api<FirmSettings>('/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name,
          gstin: form.gstin || null,
          pan: form.pan || null,
          address: form.address || null,
          stateCode: form.stateCode || null,
          logoUrl: form.logoUrl || null,
          signatureUrl: form.signatureUrl || null,
          signatoryName: form.signatoryName || null,
          signatoryDesignation: form.signatoryDesignation || null,
          settingsJson: { invoiceNumberFormat: invFmt },
        }),
      });
      setFirm(updated);
      if (updated.logoUrl) setLogoPreview(updated.logoUrl);
      setSignaturePreview(updated.signatureUrl || '');
      setMsg('Settings saved successfully');
      setTimeout(() => setMsg(''), 3000);
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      setMsg('Logo must be under 500KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setLogoPreview(dataUrl);
      setForm({ ...form, logoUrl: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  const handleSignatureFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      setMsg('Signature must be under 500KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setSignaturePreview(dataUrl);
      setForm({ ...form, signatureUrl: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  if (!firm) return <div className="p-6 text-center text-muted-foreground">Loading settings...</div>;

  return (
    <section className="space-y-6 p-4 lg:p-6">
      <h2 className="text-lg font-semibold">Business Settings</h2>

      <form onSubmit={handleSave} className="max-w-2xl space-y-6">
        {msg && (
          <div className={`rounded-md p-3 text-sm ${msg.includes('success') ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
            {msg}
          </div>
        )}

        {/* Logo Section */}
        <div className="panel space-y-4">
          <div className="panel-title">Business Logo</div>
          <div className="flex items-start gap-6">
            <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-border bg-accent/30">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="h-full w-full object-contain p-1" />
              ) : (
                <span className="text-xs text-muted-foreground">No logo</span>
              )}
            </div>
            <div className="space-y-2">
              <label className="inline-block cursor-pointer rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent">
                Upload Logo
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
              </label>
              <p className="text-xs text-muted-foreground">PNG, JPG or SVG. Max 500KB. Used on invoices.</p>
              {form.logoUrl && (
                <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => { setForm({ ...form, logoUrl: '' }); setLogoPreview(''); }}>
                  Remove logo
                </button>
              )}
            </div>
          </div>
          {/* Or use URL */}
          <div>
            <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Or paste logo URL</label>
            <input
              className="input-field"
              placeholder="https://example.com/logo.png"
              value={form.logoUrl.startsWith('data:') ? '' : form.logoUrl}
              onChange={(e) => {
                setForm({ ...form, logoUrl: e.target.value });
                setLogoPreview(e.target.value);
              }}
            />
          </div>
        </div>

        {/* Signature Section */}
        <div className="panel space-y-4">
          <div className="panel-title">Authorized Signature</div>
          <div className="flex items-start gap-6">
            <div className="flex h-24 w-44 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-border bg-accent/30">
              {signaturePreview ? (
                <img src={signaturePreview} alt="Signature" className="h-full w-full object-contain p-1" />
              ) : (
                <span className="text-xs text-muted-foreground">No signature</span>
              )}
            </div>
            <div className="space-y-2">
              <label className="inline-block cursor-pointer rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent">
                Upload Signature
                <input type="file" accept="image/*" className="hidden" onChange={handleSignatureFile} />
              </label>
              <p className="text-xs text-muted-foreground">PNG with transparent background works best. Max 500KB. Auto-printed on invoices and payment advices.</p>
              {form.signatureUrl && (
                <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => { setForm({ ...form, signatureUrl: '' }); setSignaturePreview(''); }}>
                  Remove signature
                </button>
              )}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label">Signatory Name</label>
              <input className="input-field" value={form.signatoryName} onChange={(e) => setForm({ ...form, signatoryName: e.target.value })} placeholder="CA John Doe" />
            </div>
            <div>
              <label className="field-label">Designation</label>
              <input className="input-field" value={form.signatoryDesignation} onChange={(e) => setForm({ ...form, signatoryDesignation: e.target.value })} placeholder="Partner" />
            </div>
          </div>
          <div>
            <label className="field-label">Or paste signature URL</label>
            <input
              className="input-field"
              placeholder="https://example.com/sign.png"
              value={form.signatureUrl.startsWith('data:') ? '' : form.signatureUrl}
              onChange={(e) => {
                setForm({ ...form, signatureUrl: e.target.value });
                setSignaturePreview(e.target.value);
              }}
            />
          </div>
        </div>

        {/* Business Details */}
        <div className="panel space-y-4">
          <div className="panel-title">Business Details</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Business Name *</label>
              <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="mb-1 block text-[13px] font-medium text-muted-foreground">GSTIN</label>
              <input
                className="input-field"
                value={form.gstin}
                onChange={(e) => {
                  const v = e.target.value.toUpperCase();
                  const derived = stateCodeFromGstin(v);
                  setForm({ ...form, gstin: v, stateCode: derived || form.stateCode });
                }}
                maxLength={15}
                placeholder="32AAAAA0000A1Z5"
              />
              <p className="mt-0.5 text-[11px] text-muted-foreground">First 2 digits = state code; auto-fills State below.</p>
            </div>
            <div>
              <label className="mb-1 block text-[13px] font-medium text-muted-foreground">PAN</label>
              <input className="input-field" value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} maxLength={10} placeholder="AAAAA0000A" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Business State *</label>
              <select className="input-field" value={form.stateCode} onChange={(e) => setForm({ ...form, stateCode: e.target.value })} required>
                <option value="">Select operating state...</option>
                {INDIA_STATES.map((s) => <option key={s.code} value={s.code}>{s.code} — {s.name}</option>)}
              </select>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Used to determine intra-state (CGST+SGST) vs inter-state (IGST) GST split on invoices.</p>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Address</label>
              <textarea className="input-field" rows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Full business address for invoices" />
            </div>
          </div>
        </div>

        {/* Invoice Numbering */}
        <div className="panel space-y-4">
          <div className="panel-title">Invoice & Document Numbering</div>
          <p className="-mt-2 text-[12px] text-muted-foreground">Configure how invoice and payment-advice numbers are generated. Take effect for newly issued documents only.</p>

          {/* Live preview */}
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-accent/20 p-3">
              <p className="text-[10.5px] uppercase tracking-wide text-muted-foreground">Invoice preview</p>
              <p className="font-mono text-sm font-bold text-foreground">{previewInvoiceNo(invFmt, 'INV')}</p>
            </div>
            <div className="rounded-lg border border-border bg-accent/20 p-3">
              <p className="text-[10.5px] uppercase tracking-wide text-muted-foreground">Payment advice preview</p>
              <p className="font-mono text-sm font-bold text-foreground">{previewInvoiceNo(invFmt, 'PA')}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="field-label">Prefix</label>
              <input className="input-field" value={invFmt.prefix || ''} onChange={(e) => setInvFmt({ ...invFmt, prefix: e.target.value })} placeholder="(none) e.g. TBM-" />
            </div>
            <div>
              <label className="field-label">Suffix</label>
              <input className="input-field" value={invFmt.suffix || ''} onChange={(e) => setInvFmt({ ...invFmt, suffix: e.target.value })} placeholder="(none) e.g. /A" />
            </div>
            <div>
              <label className="field-label">Separator</label>
              <select className="input-field" value={invFmt.separator || '/'} onChange={(e) => setInvFmt({ ...invFmt, separator: e.target.value })}>
                <option value="/">/  (slash)</option>
                <option value="-">-  (dash)</option>
                <option value=".">.  (dot)</option>
                <option value="_">_  (underscore)</option>
              </select>
            </div>
            <div>
              <label className="field-label">Series Code (Invoice)</label>
              <input className="input-field" value={invFmt.seriesCode ?? 'INV'} onChange={(e) => setInvFmt({ ...invFmt, seriesCode: e.target.value })} placeholder="INV" />
              <p className="mt-0.5 text-[11px] text-muted-foreground">Leave blank to omit. Payment advices use 'PA'.</p>
            </div>
            <div>
              <label className="field-label">Padding (digits)</label>
              <select className="input-field" value={String(invFmt.padding ?? 4)} onChange={(e) => setInvFmt({ ...invFmt, padding: Number(e.target.value) })}>
                {[3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} (e.g. {String(1).padStart(n, '0')})</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Start From</label>
              <input className="input-field" type="number" min="1" value={invFmt.startFrom ?? 1} onChange={(e) => setInvFmt({ ...invFmt, startFrom: Number(e.target.value) || 1 })} />
            </div>
            <div>
              <label className="field-label">FY Format</label>
              <select className="input-field" value={invFmt.fyFormat ?? 'short'} onChange={(e) => setInvFmt({ ...invFmt, fyFormat: e.target.value as 'short' | 'long' })}>
                <option value="short">Short (FY26-27)</option>
                <option value="long">Long (FY2026-2027)</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
                <input type="checkbox" className="h-4 w-4" checked={invFmt.includeFy !== false} onChange={(e) => setInvFmt({ ...invFmt, includeFy: e.target.checked })} />
                Include Financial Year segment
              </label>
            </div>
            <div className="flex items-end">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
                <input type="checkbox" className="h-4 w-4" checked={invFmt.resetOnFy !== false} onChange={(e) => setInvFmt({ ...invFmt, resetOnFy: e.target.checked })} />
                Reset counter each Financial Year
              </label>
            </div>
          </div>
        </div>

        <button type="submit" disabled={saving} className="primary-button">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>

      {/* Task Statuses (separate, has own actions) */}
      <div className="max-w-2xl">
        <div className="panel space-y-4">
          <div>
            <div className="panel-title">Task Statuses (Kanban Columns)</div>
            <p className="-mt-2 text-[12px] text-muted-foreground">Customize columns shown on the Tasks Kanban board. Drag-drop tasks between columns updates status. Statuses marked <span className="font-semibold">terminal</span> trigger a time-log prompt when a task is moved into them.</p>
          </div>

          {/* Add */}
          <div className="rounded-lg border border-border bg-accent/20 p-3">
            <div className="grid gap-2 sm:grid-cols-12 items-end">
              <div className="sm:col-span-5">
                <label className="field-label">Status Label</label>
                <input className="input-field" value={newStatus.label} onChange={(e) => setNewStatus({ ...newStatus, label: e.target.value })} placeholder="e.g. Awaiting Client, Filed, Archived" />
              </div>
              <div className="sm:col-span-3">
                <label className="field-label">Color</label>
                <select className="input-field" value={newStatus.color} onChange={(e) => setNewStatus({ ...newStatus, color: e.target.value })}>
                  {STATUS_COLORS_OPTS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2 flex items-center gap-1">
                <label className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-medium">
                  <input type="checkbox" className="h-3.5 w-3.5" checked={newStatus.isTerminal} onChange={(e) => setNewStatus({ ...newStatus, isTerminal: e.target.checked })} />
                  Terminal
                </label>
              </div>
              <div className="sm:col-span-2">
                <button type="button" className="primary-button text-xs w-full" onClick={addStatus}>
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
            </div>
          </div>

          {/* List */}
          <div className="rounded-lg border border-border overflow-hidden">
            <ul className="divide-y divide-border">
              {statuses.map((s, idx) => (
                <li key={s.id} className="flex items-center gap-3 p-3 hover:bg-accent/30">
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10.5px] font-bold text-primary">{idx + 1}</span>
                  <span className={`rounded px-2 py-0.5 text-[11.5px] font-semibold capitalize ${chipClass(s.color)}`}>{s.label}</span>
                  <span className="font-mono text-[10.5px] text-muted-foreground">{s.code}</span>
                  {s.isTerminal && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase text-red-700 dark:bg-red-900/30 dark:text-red-300">terminal</span>}
                  {s.isInitial && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">initial</span>}
                  {s.isSystem && <span className="rounded bg-accent px-1.5 py-0.5 text-[9.5px] font-medium uppercase text-muted-foreground">system</span>}
                  <div className="ml-auto flex items-center gap-1">
                    <button className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30" disabled={idx === 0} onClick={() => moveStatus(idx, -1)} title="Move up">↑</button>
                    <button className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30" disabled={idx === statuses.length - 1} onClick={() => moveStatus(idx, 1)} title="Move down">↓</button>
                    <button className="rounded p-1 text-muted-foreground hover:bg-accent" onClick={() => openEditStatus(s)} title="Edit"><Pencil className="h-4 w-4" /></button>
                    {!s.isSystem && <button className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20" onClick={() => deleteStatus(s)} title="Delete"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                </li>
              ))}
              {statuses.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">Loading…</li>}
            </ul>
          </div>
        </div>
      </div>

      {/* Edit status modal */}
      {editStatus && (
        <div className="modal-overlay" onClick={() => setEditStatus(null)} role="dialog" aria-modal="true">
          <div className="modal-card modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="modal-eyebrow">Status</span>
                <h3 className="modal-title">Edit {editStatus.label}</h3>
                <p className="modal-subtitle">Code: <span className="font-mono">{editStatus.code}</span> (immutable)</p>
              </div>
              <button className="modal-close" onClick={() => setEditStatus(null)} aria-label="Close">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="modal-body space-y-3">
              <div>
                <label className="field-label">Label</label>
                <input className="input-field" value={statusEditForm.label} onChange={(e) => setStatusEditForm({ ...statusEditForm, label: e.target.value })} />
              </div>
              <div>
                <label className="field-label">Color</label>
                <select className="input-field" value={statusEditForm.color} onChange={(e) => setStatusEditForm({ ...statusEditForm, color: e.target.value })}>
                  {STATUS_COLORS_OPTS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4" checked={statusEditForm.isTerminal} onChange={(e) => setStatusEditForm({ ...statusEditForm, isTerminal: e.target.checked })} />
                  Terminal — moving here prompts time-log
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4" checked={statusEditForm.isInitial} onChange={(e) => setStatusEditForm({ ...statusEditForm, isInitial: e.target.checked })} />
                  Initial — default for new tasks
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="secondary-button" onClick={() => setEditStatus(null)}>Cancel</button>
              <button type="button" className="primary-button" onClick={saveEditStatus}>Save</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
