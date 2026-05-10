import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { INDIA_STATES, stateCodeFromGstin } from '../lib/billing-utils';

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
  }, []);

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
    </section>
  );
}
