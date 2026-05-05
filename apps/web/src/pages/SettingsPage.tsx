import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface FirmSettings {
  id: string;
  name: string;
  gstin?: string | null;
  pan?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  settingsJson?: Record<string, unknown> | null;
}

export default function SettingsPage() {
  const [firm, setFirm] = useState<FirmSettings | null>(null);
  const [form, setForm] = useState({ name: '', gstin: '', pan: '', address: '', logoUrl: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [logoPreview, setLogoPreview] = useState('');

  useEffect(() => {
    api<FirmSettings>('/settings')
      .then((f) => {
        setFirm(f);
        setForm({
          name: f.name || '',
          gstin: f.gstin || '',
          pan: f.pan || '',
          address: f.address || '',
          logoUrl: f.logoUrl || '',
        });
        if (f.logoUrl) setLogoPreview(f.logoUrl);
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
          logoUrl: form.logoUrl || null,
        }),
      });
      setFirm(updated);
      if (updated.logoUrl) setLogoPreview(updated.logoUrl);
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
              <input className="input-field" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} maxLength={15} placeholder="22AAAAA0000A1Z5" />
            </div>
            <div>
              <label className="mb-1 block text-[13px] font-medium text-muted-foreground">PAN</label>
              <input className="input-field" value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} maxLength={10} placeholder="AAAAA0000A" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Address</label>
              <textarea className="input-field" rows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Full business address for invoices" />
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
