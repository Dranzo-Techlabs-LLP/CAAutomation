import { useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import { ArrowDownToLine, ArrowUpFromLine, Plus, X } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { TDS_SECTIONS, rupeesToWordsIN } from '../lib/billing-utils';

type AdviceType = 'received' | 'made';

interface PaymentAdvice {
  id: string;
  adviceNo: string;
  adviceDate: string;
  type: AdviceType;
  customerId?: string | null;
  partyName?: string | null;
  partyGstin?: string | null;
  partyPan?: string | null;
  partyAddress?: string | null;
  invoiceId?: string | null;
  grossAmount: string;
  tdsAmount: string;
  tdsSection?: string | null;
  tdsRate: string;
  otherDeductions: string;
  netAmount: string;
  mode: string;
  referenceNo?: string | null;
  bankName?: string | null;
  transactionDate?: string | null;
  narration?: string | null;
  status: string;
}

interface InvoiceLite {
  id: string;
  invoiceNo: string;
  customerId: string;
  total: string;
  status: string;
}

interface FirmSettings {
  name: string;
  gstin?: string | null;
  pan?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  signatureUrl?: string | null;
  signatoryName?: string | null;
  signatoryDesignation?: string | null;
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    if (url.startsWith('data:')) return url;
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  issued: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const TYPE_COLORS: Record<AdviceType, string> = {
  received: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  made: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
};

const fmtPaise = (p: string | number) => `₹${(Number(p) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

async function generateAdvicePdf(advice: PaymentAdvice, firm: FirmSettings | null, invoiceNo?: string) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 18;

  // Firm header
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(firm?.name || 'TBM Practice OS', 14, y);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(110);
  if (firm?.address) {
    const lines = doc.splitTextToSize(firm.address, 90);
    doc.text(lines, 14, y + 5);
    y += lines.length * 3;
  }
  if (firm?.gstin) doc.text(`GSTIN: ${firm.gstin}`, 14, y + 8);
  if (firm?.pan) doc.text(`PAN: ${firm.pan}`, 14, y + 12);

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(44, 62, 80);
  doc.text('PAYMENT ADVICE', pageWidth - 14, 22, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(110);
  doc.text(`Advice No: ${advice.adviceNo}`, pageWidth - 14, 28, { align: 'right' });
  doc.text(`Date: ${fmtDate(advice.adviceDate)}`, pageWidth - 14, 33, { align: 'right' });
  doc.text(`Type: ${advice.type === 'received' ? 'Payment Received' : 'Payment Made'}`, pageWidth - 14, 38, { align: 'right' });

  y = 55;
  // Party
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(110);
  doc.text(advice.type === 'received' ? 'PAYMENT RECEIVED FROM' : 'PAYMENT MADE TO', 14, y);
  y += 5;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(33);
  doc.text(advice.partyName || '-', 14, y);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80);
  if (advice.partyAddress) {
    y += 5;
    const lines = doc.splitTextToSize(advice.partyAddress, 100);
    doc.text(lines, 14, y);
    y += lines.length * 3.5;
  }
  if (advice.partyGstin) { y += 4; doc.text(`GSTIN: ${advice.partyGstin}`, 14, y); }
  if (advice.partyPan) { y += 4; doc.text(`PAN: ${advice.partyPan}`, 14, y); }

  y += 12;
  // Payment details box
  doc.setDrawColor(220);
  doc.setLineWidth(0.3);
  doc.rect(14, y, pageWidth - 28, 50);
  let by = y + 6;
  const labelX = 18;
  const valX = 90;
  const labelX2 = 110;
  const valX2 = pageWidth - 18;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(110);
  doc.text('Mode', labelX, by); doc.text('Reference No', labelX2, by);
  doc.setFont('helvetica', 'normal'); doc.setTextColor(33);
  doc.text(advice.mode.toUpperCase(), valX, by, { align: 'right' });
  doc.text(advice.referenceNo || '-', valX2, by, { align: 'right' });
  by += 8;
  doc.setFont('helvetica', 'bold'); doc.setTextColor(110);
  doc.text('Bank', labelX, by); doc.text('Transaction Date', labelX2, by);
  doc.setFont('helvetica', 'normal'); doc.setTextColor(33);
  doc.text(advice.bankName || '-', valX, by, { align: 'right' });
  doc.text(fmtDate(advice.transactionDate), valX2, by, { align: 'right' });
  if (invoiceNo) {
    by += 8;
    doc.setFont('helvetica', 'bold'); doc.setTextColor(110);
    doc.text('Linked Invoice', labelX, by);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(33);
    doc.text(invoiceNo, valX, by, { align: 'right' });
  }
  if (advice.tdsSection) {
    by += 8;
    doc.setFont('helvetica', 'bold'); doc.setTextColor(110);
    doc.text('TDS Section', labelX, by); doc.text('TDS Rate', labelX2, by);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(33);
    doc.text(advice.tdsSection, valX, by, { align: 'right' });
    doc.text(`${advice.tdsRate}%`, valX2, by, { align: 'right' });
  }

  y += 60;
  // Amounts box
  const fmt = (p: string) => (Number(p) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold'); doc.setTextColor(80);
  doc.text('Gross Amount', pageWidth - 60, y); doc.setFont('helvetica', 'normal'); doc.text(`₹ ${fmt(advice.grossAmount)}`, pageWidth - 18, y, { align: 'right' });
  if (Number(advice.tdsAmount) > 0) {
    y += 6;
    doc.setFont('helvetica', 'bold'); doc.text(`(−) TDS${advice.tdsSection ? ` u/s ${advice.tdsSection}` : ''}`, pageWidth - 60, y);
    doc.setFont('helvetica', 'normal'); doc.text(`${fmt(advice.tdsAmount)}`, pageWidth - 18, y, { align: 'right' });
  }
  if (Number(advice.otherDeductions) > 0) {
    y += 6;
    doc.setFont('helvetica', 'bold'); doc.text('(−) Other Deductions', pageWidth - 60, y);
    doc.setFont('helvetica', 'normal'); doc.text(`${fmt(advice.otherDeductions)}`, pageWidth - 18, y, { align: 'right' });
  }
  y += 4;
  doc.setDrawColor(44, 62, 80); doc.setLineWidth(0.5);
  doc.line(pageWidth - 65, y, pageWidth - 18, y);
  y += 6;
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(44, 62, 80);
  doc.text('Net Amount', pageWidth - 60, y);
  doc.text(`₹ ${fmt(advice.netAmount)}`, pageWidth - 18, y, { align: 'right' });

  y += 8;
  doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(110);
  const wordsLines = doc.splitTextToSize(rupeesToWordsIN(Number(advice.netAmount) / 100), pageWidth - 28);
  doc.text(wordsLines, 14, y);
  y += wordsLines.length * 3.5;

  if (advice.narration) {
    y += 8;
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(110);
    doc.text('Narration:', 14, y);
    y += 4;
    doc.setFont('helvetica', 'normal'); doc.setTextColor(33);
    const narrLines = doc.splitTextToSize(advice.narration, pageWidth - 28);
    doc.text(narrLines, 14, y);
  }

  // Authorized signature (right side, above footer)
  const pageH = doc.internal.pageSize.getHeight();
  const sigBlockBottom = pageH - 30;
  const sigRightX = pageWidth - 14;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80);
  doc.text(`For ${firm?.name || 'TBM Practice OS'}`, sigRightX, sigBlockBottom - 30, { align: 'right' });
  if (firm?.signatureUrl) {
    const sigData = await loadImageAsBase64(firm.signatureUrl);
    if (sigData) {
      try {
        const sigW = 45;
        const sigH = 18;
        doc.addImage(sigData, 'PNG', sigRightX - sigW, sigBlockBottom - 26, sigW, sigH);
      } catch { /* skip */ }
    }
  }
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60);
  doc.setFontSize(8);
  if (firm?.signatoryName) doc.text(firm.signatoryName, sigRightX, sigBlockBottom - 4, { align: 'right' });
  if (firm?.signatoryDesignation) doc.text(firm.signatoryDesignation, sigRightX, sigBlockBottom, { align: 'right' });
  doc.setDrawColor(180);
  doc.setLineWidth(0.3);
  doc.line(sigRightX - 60, sigBlockBottom - 7, sigRightX, sigBlockBottom - 7);
  doc.setFontSize(7);
  doc.setTextColor(110);
  doc.text('Authorized Signatory', sigRightX, sigBlockBottom + 4, { align: 'right' });

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text(`Generated by ${firm?.name || 'TBM Practice OS'}`, pageWidth / 2, pageH - 10, { align: 'center' });

  doc.save(`PaymentAdvice-${advice.adviceNo.replace(/\//g, '-')}.pdf`);
}

export default function PaymentAdvicesPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('payment.create');

  const [tab, setTab] = useState<'all' | AdviceType>('all');
  const [advices, setAdvices] = useState<PaymentAdvice[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string; gstin?: string | null; pan?: string | null; address?: string | null }[]>([]);
  const [invoices, setInvoices] = useState<InvoiceLite[]>([]);
  const [firm, setFirm] = useState<FirmSettings | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [viewing, setViewing] = useState<PaymentAdvice | null>(null);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    type: 'received' as AdviceType,
    adviceDate: new Date().toISOString().slice(0, 10),
    customerId: '',
    invoiceId: '',
    partyName: '', partyGstin: '', partyPan: '', partyAddress: '',
    grossAmount: '',
    tdsRate: '',
    tdsSection: '',
    tdsAmount: '',
    otherDeductions: '0',
    mode: 'neft',
    referenceNo: '', bankName: '', transactionDate: new Date().toISOString().slice(0, 10),
    narration: '',
  });

  const load = () => api<PaymentAdvice[]>(tab === 'all' ? '/payment-advices' : `/payment-advices?type=${tab}`).then(setAdvices).catch(() => {});

  useEffect(() => { load(); }, [tab]);
  useEffect(() => {
    api<typeof customers>('/customers').then(setCustomers).catch(() => {});
    api<InvoiceLite[]>('/invoices').then(setInvoices).catch(() => {});
    api<FirmSettings>('/settings').then(setFirm).catch(() => {});
  }, []);

  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c]));
  const invoiceMap = Object.fromEntries(invoices.map((i) => [i.id, i]));

  const grossNum = Number(form.grossAmount || 0);
  const tdsRateNum = Number(form.tdsRate || 0);
  const computedTds = form.tdsAmount !== '' ? Number(form.tdsAmount) : (tdsRateNum > 0 ? Math.round((grossNum * tdsRateNum) / 100) : 0);
  const otherNum = Number(form.otherDeductions || 0);
  const netNum = grossNum - computedTds - otherNum;

  const onCustomerChange = (id: string) => {
    const c = customerMap[id];
    setForm({
      ...form,
      customerId: id,
      partyName: c?.name || '',
      partyGstin: c?.gstin || '',
      partyPan: c?.pan || '',
      partyAddress: c?.address || '',
    });
  };

  const onInvoiceChange = (id: string) => {
    const inv = invoiceMap[id];
    if (inv) {
      const c = customerMap[inv.customerId];
      setForm({
        ...form,
        invoiceId: id,
        customerId: inv.customerId,
        grossAmount: inv.total,
        partyName: c?.name || '',
        partyGstin: c?.gstin || '',
        partyPan: c?.pan || '',
        partyAddress: c?.address || '',
      });
    } else {
      setForm({ ...form, invoiceId: id });
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api('/payment-advices', {
        method: 'POST',
        body: JSON.stringify({
          adviceDate: new Date(form.adviceDate).toISOString(),
          type: form.type,
          customerId: form.type === 'received' && form.customerId ? form.customerId : undefined,
          invoiceId: form.invoiceId || undefined,
          partyName: form.partyName || undefined,
          partyGstin: form.partyGstin || undefined,
          partyPan: form.partyPan || undefined,
          partyAddress: form.partyAddress || undefined,
          grossAmount: form.grossAmount,
          tdsAmount: String(computedTds),
          tdsSection: form.tdsSection || undefined,
          tdsRate: form.tdsRate || undefined,
          otherDeductions: form.otherDeductions || '0',
          mode: form.mode,
          referenceNo: form.referenceNo || undefined,
          bankName: form.bankName || undefined,
          transactionDate: form.transactionDate ? new Date(form.transactionDate).toISOString() : undefined,
          narration: form.narration || undefined,
        }),
      });
      setShowForm(false);
      setForm({
        type: 'received', adviceDate: new Date().toISOString().slice(0, 10),
        customerId: '', invoiceId: '',
        partyName: '', partyGstin: '', partyPan: '', partyAddress: '',
        grossAmount: '', tdsRate: '', tdsSection: '', tdsAmount: '', otherDeductions: '0',
        mode: 'neft', referenceNo: '', bankName: '', transactionDate: new Date().toISOString().slice(0, 10), narration: '',
      });
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  // Filter invoices by selected customer for the dropdown
  const customerInvoices = form.customerId ? invoices.filter((i) => i.customerId === form.customerId) : invoices;

  return (
    <section className="space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Payment Advices</h2>
          <p className="text-xs text-muted-foreground">Issue payment advice to confirm money received from clients or paid to vendors.</p>
        </div>
        {canCreate && (
          <button className="primary-button" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4" /> {showForm ? 'Cancel' : 'New Advice'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="inline-flex rounded-lg border border-border bg-panel p-0.5">
        {([
          { key: 'all', label: 'All' },
          { key: 'received', label: 'Received', icon: <ArrowDownToLine className="h-3.5 w-3.5" /> },
          { key: 'made', label: 'Made', icon: <ArrowUpFromLine className="h-3.5 w-3.5" /> },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${tab === t.key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent'}`}
          >
            {'icon' in t && t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={submit} className="panel space-y-4">
          <div className="panel-title">New Payment Advice</div>
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">{error}</div>}

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="field-label">Type *</label>
              <select className="input-field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as AdviceType, customerId: '', invoiceId: '' })}>
                <option value="received">Received (from client)</option>
                <option value="made">Made (to vendor)</option>
              </select>
            </div>
            <div>
              <label className="field-label">Advice Date *</label>
              <input type="date" className="input-field" value={form.adviceDate} onChange={(e) => setForm({ ...form, adviceDate: e.target.value })} required />
            </div>
            <div>
              <label className="field-label">Mode *</label>
              <select className="input-field" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                {['neft', 'rtgs', 'upi', 'cheque', 'cash', 'other'].map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
              </select>
            </div>
          </div>

          {/* Party */}
          <div className="rounded-lg border border-border bg-accent/20 p-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Party Details</div>
            {form.type === 'received' ? (
              <div className="grid gap-3 sm:grid-cols-2 mb-3">
                <div>
                  <label className="field-label">Client *</label>
                  <select className="input-field" value={form.customerId} onChange={(e) => onCustomerChange(e.target.value)} required>
                    <option value="">Select customer...</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Against Invoice (optional)</label>
                  <select className="input-field" value={form.invoiceId} onChange={(e) => onInvoiceChange(e.target.value)}>
                    <option value="">Standalone advice</option>
                    {customerInvoices.map((i) => <option key={i.id} value={i.id}>{i.invoiceNo} — {fmtPaise(i.total)} ({i.status})</option>)}
                  </select>
                </div>
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="field-label">{form.type === 'received' ? 'Client Name' : 'Vendor Name *'}</label>
                <input className="input-field" value={form.partyName} onChange={(e) => setForm({ ...form, partyName: e.target.value })} required={form.type === 'made'} />
              </div>
              <div>
                <label className="field-label">GSTIN</label>
                <input className="input-field" value={form.partyGstin} onChange={(e) => setForm({ ...form, partyGstin: e.target.value })} placeholder="22AAAAA0000A1Z5" />
              </div>
              <div>
                <label className="field-label">PAN</label>
                <input className="input-field" value={form.partyPan} onChange={(e) => setForm({ ...form, partyPan: e.target.value })} placeholder="AAAAA0000A" />
              </div>
              <div>
                <label className="field-label">Address</label>
                <input className="input-field" value={form.partyAddress} onChange={(e) => setForm({ ...form, partyAddress: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Amount + TDS */}
          <div className="rounded-lg border border-border bg-accent/20 p-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Amount & Deductions</div>
            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <label className="field-label">Gross Amount (paise) *</label>
                <input className="input-field" type="number" value={form.grossAmount} onChange={(e) => setForm({ ...form, grossAmount: e.target.value })} required placeholder="e.g. 540000" />
                {grossNum > 0 && <p className="mt-0.5 text-[11px] text-muted-foreground">{fmtPaise(grossNum)}</p>}
              </div>
              <div>
                <label className="field-label">TDS Section</label>
                <select className="input-field" value={form.tdsSection} onChange={(e) => setForm({ ...form, tdsSection: e.target.value })}>
                  <option value="">None</option>
                  {TDS_SECTIONS.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">TDS Rate %</label>
                <input className="input-field" type="number" step="0.01" value={form.tdsRate} onChange={(e) => setForm({ ...form, tdsRate: e.target.value, tdsAmount: '' })} placeholder="e.g. 10" />
              </div>
              <div>
                <label className="field-label">TDS Amount (paise)</label>
                <input className="input-field" type="number" value={form.tdsAmount} onChange={(e) => setForm({ ...form, tdsAmount: e.target.value })} placeholder={String(computedTds)} />
                {computedTds > 0 && <p className="mt-0.5 text-[11px] text-muted-foreground">{fmtPaise(computedTds)}</p>}
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="field-label">Other Deductions (paise)</label>
                <input className="input-field" type="number" value={form.otherDeductions} onChange={(e) => setForm({ ...form, otherDeductions: e.target.value })} />
              </div>
              <div className="flex items-end">
                <div className="w-full rounded-md border border-border bg-card p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Net Amount</p>
                  <p className="text-lg font-bold tabular-nums text-foreground">{fmtPaise(netNum)}</p>
                  {netNum > 0 && <p className="mt-0.5 text-[10.5px] italic text-muted-foreground">{rupeesToWordsIN(netNum / 100)}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Bank & ref */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="field-label">Reference No (UTR / Cheque)</label>
              <input className="input-field" value={form.referenceNo} onChange={(e) => setForm({ ...form, referenceNo: e.target.value })} placeholder="UTR1234..." />
            </div>
            <div>
              <label className="field-label">Bank Name</label>
              <input className="input-field" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Transaction Date</label>
              <input type="date" className="input-field" value={form.transactionDate} onChange={(e) => setForm({ ...form, transactionDate: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="field-label">Narration</label>
            <textarea className="input-field" rows={2} value={form.narration} onChange={(e) => setForm({ ...form, narration: e.target.value })} placeholder="Payment received against invoice..." />
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" className="primary-button">Issue Advice</button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="panel overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-background text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold">Advice #</th>
              <th className="px-4 py-2.5 text-left font-semibold">Date</th>
              <th className="px-4 py-2.5 text-left font-semibold">Type</th>
              <th className="px-4 py-2.5 text-left font-semibold">Party</th>
              <th className="px-4 py-2.5 text-right font-semibold">Gross</th>
              <th className="px-4 py-2.5 text-right font-semibold">TDS</th>
              <th className="px-4 py-2.5 text-right font-semibold">Net</th>
              <th className="px-4 py-2.5 text-left font-semibold">Mode / Ref</th>
              <th className="px-4 py-2.5 text-left font-semibold">Status</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {advices.map((a) => (
              <tr key={a.id} className="hover:bg-accent/30">
                <td className="px-4 py-2.5 font-mono text-[12px] font-semibold">{a.adviceNo}</td>
                <td className="px-4 py-2.5 text-[12px]">{fmtDate(a.adviceDate)}</td>
                <td className="px-4 py-2.5"><span className={`rounded px-2 py-0.5 text-[10.5px] font-semibold ${TYPE_COLORS[a.type]}`}>{a.type === 'received' ? 'Received' : 'Made'}</span></td>
                <td className="px-4 py-2.5">
                  <div className="text-[12px] font-medium text-foreground">{a.partyName || '-'}</div>
                  {a.partyGstin && <div className="text-[10.5px] text-muted-foreground">{a.partyGstin}</div>}
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">{fmtPaise(a.grossAmount)}</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-amber-700 dark:text-amber-400">{Number(a.tdsAmount) > 0 ? fmtPaise(a.tdsAmount) : '-'}</td>
                <td className="px-4 py-2.5 text-right font-mono font-bold tabular-nums">{fmtPaise(a.netAmount)}</td>
                <td className="px-4 py-2.5">
                  <div className="text-[12px] uppercase">{a.mode}</div>
                  {a.referenceNo && <div className="text-[10.5px] text-muted-foreground">{a.referenceNo}</div>}
                </td>
                <td className="px-4 py-2.5"><span className={`rounded px-2 py-0.5 text-[10.5px] font-semibold capitalize ${STATUS_COLORS[a.status] || 'bg-accent'}`}>{a.status}</span></td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center gap-2">
                    <button className="text-[11px] font-medium text-primary hover:underline" onClick={() => setViewing(a)}>View</button>
                    <button className="text-[11px] font-medium text-primary hover:underline" onClick={() => generateAdvicePdf(a, firm, a.invoiceId ? invoiceMap[a.invoiceId]?.invoiceNo : undefined)}>PDF</button>
                  </div>
                </td>
              </tr>
            ))}
            {advices.length === 0 && (
              <tr><td colSpan={10} className="py-12 text-center text-sm text-muted-foreground">No payment advices yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* View modal */}
      {viewing && (
        <div className="modal-overlay" onClick={() => setViewing(null)} role="dialog" aria-modal="true" aria-labelledby="adv-title">
          <div className="modal-card modal-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="min-w-0">
                <span className="modal-eyebrow">Payment Advice • {fmtDate(viewing.adviceDate)}</span>
                <h3 id="adv-title" className="modal-title">{viewing.adviceNo}</h3>
                <p className="modal-subtitle">{viewing.type === 'received' ? 'Received from' : 'Paid to'} {viewing.partyName}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => generateAdvicePdf(viewing, firm, viewing.invoiceId ? invoiceMap[viewing.invoiceId]?.invoiceNo : undefined)} className="secondary-button text-xs">PDF</button>
                <button className="modal-close" onClick={() => setViewing(null)} aria-label="Close"><X className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="modal-body space-y-3">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Mode</dt><dd className="mt-0.5 font-semibold uppercase">{viewing.mode}</dd></div>
                <div><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Reference No</dt><dd className="mt-0.5 font-semibold">{viewing.referenceNo || '-'}</dd></div>
                <div><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Bank</dt><dd className="mt-0.5 font-semibold">{viewing.bankName || '-'}</dd></div>
                <div><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Transaction Date</dt><dd className="mt-0.5 font-semibold">{fmtDate(viewing.transactionDate)}</dd></div>
                {viewing.partyGstin && <div><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Party GSTIN</dt><dd className="mt-0.5 font-mono text-[12px] font-semibold">{viewing.partyGstin}</dd></div>}
                {viewing.tdsSection && <div><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">TDS Section</dt><dd className="mt-0.5 font-semibold">{viewing.tdsSection} ({viewing.tdsRate}%)</dd></div>}
              </dl>
              <div className="rounded-lg border border-border bg-accent/20 p-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Gross Amount</span><span className="font-mono tabular-nums">{fmtPaise(viewing.grossAmount)}</span></div>
                {Number(viewing.tdsAmount) > 0 && <div className="flex justify-between text-amber-700 dark:text-amber-400"><span>(−) TDS{viewing.tdsSection ? ` u/s ${viewing.tdsSection}` : ''}</span><span className="font-mono tabular-nums">−{fmtPaise(viewing.tdsAmount)}</span></div>}
                {Number(viewing.otherDeductions) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">(−) Other Deductions</span><span className="font-mono tabular-nums">−{fmtPaise(viewing.otherDeductions)}</span></div>}
                <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-bold"><span>Net Amount</span><span className="font-mono tabular-nums">{fmtPaise(viewing.netAmount)}</span></div>
                <p className="mt-1 text-[11px] italic text-muted-foreground">{rupeesToWordsIN(Number(viewing.netAmount) / 100)}</p>
              </div>
              {viewing.narration && (
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Narration</p>
                  <p className="mt-0.5 text-sm">{viewing.narration}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
