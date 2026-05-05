import { useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface LineItem {
  id: string;
  description: string;
  quantity: string;
  rate: string;
  amount: string;
  hsnSac?: string | null;
}

interface Invoice {
  id: string;
  customerId: string;
  invoiceNo: string;
  issueDate: string;
  dueDate: string;
  subtotal: string;
  cgst: string;
  sgst: string;
  igst: string;
  total: string;
  status: string;
  notes?: string | null;
  terms?: string | null;
  lineItems?: LineItem[];
}

interface FirmSettings {
  name: string;
  gstin?: string | null;
  pan?: string | null;
  address?: string | null;
  logoUrl?: string | null;
}

function formatPaise(paise: string | number) {
  return `₹${(Number(paise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function formatPaiseNum(paise: string | number): string {
  return (Number(paise) / 100).toFixed(2);
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  partially_paid: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
};

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

async function generateInvoicePdf(invoice: Invoice, customerName: string, firm: FirmSettings | null) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // Header with logo
  if (firm?.logoUrl) {
    const logoData = await loadImageAsBase64(firm.logoUrl);
    if (logoData) {
      try {
        doc.addImage(logoData, 'PNG', 14, y, 30, 30);
      } catch {
        // logo failed to load, skip
      }
    }
  }

  // Company info
  const infoX = firm?.logoUrl ? 50 : 14;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(firm?.name || 'TBM Practice OS', infoX, y + 8);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  if (firm?.address) {
    const addressLines = doc.splitTextToSize(firm.address, 80);
    doc.text(addressLines, infoX, y + 14);
    y += addressLines.length * 3;
  }
  if (firm?.gstin) doc.text(`GSTIN: ${firm.gstin}`, infoX, y + 17);
  if (firm?.pan) doc.text(`PAN: ${firm.pan}`, infoX, y + 21);

  // Invoice title - right side
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(44, 62, 80);
  doc.text('INVOICE', pageWidth - 14, 23, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`Invoice No: ${invoice.invoiceNo}`, pageWidth - 14, 30, { align: 'right' });
  doc.text(`Date: ${new Date(invoice.issueDate).toLocaleDateString('en-IN')}`, pageWidth - 14, 35, { align: 'right' });
  doc.text(`Due: ${new Date(invoice.dueDate).toLocaleDateString('en-IN')}`, pageWidth - 14, 40, { align: 'right' });

  const statusText = invoice.status.replace(/_/g, ' ').toUpperCase();
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  if (invoice.status === 'paid') doc.setTextColor(34, 139, 34);
  else if (invoice.status === 'overdue') doc.setTextColor(220, 20, 60);
  else doc.setTextColor(100);
  doc.text(statusText, pageWidth - 14, 46, { align: 'right' });

  // Divider
  y = 55;
  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  doc.line(14, y, pageWidth - 14, y);

  // Bill To
  y += 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100);
  doc.text('BILL TO', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40);
  doc.setFontSize(10);
  doc.text(customerName, 14, y + 6);

  // Line items table
  y += 16;
  const tableData = (invoice.lineItems || []).map((li, i) => [
    String(i + 1),
    li.description,
    li.hsnSac || '-',
    li.quantity,
    formatPaiseNum(li.rate),
    formatPaiseNum(li.amount),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Description', 'HSN/SAC', 'Qty', 'Rate (₹)', 'Amount (₹)']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [44, 62, 80],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 28, halign: 'right' },
      5: { cellWidth: 30, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 10;

  // Totals
  const totalsX = pageWidth - 80;
  const valX = pageWidth - 14;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80);

  doc.text('Subtotal:', totalsX, y);
  doc.text(formatPaiseNum(invoice.subtotal), valX, y, { align: 'right' });

  if (Number(invoice.cgst) > 0) {
    y += 6;
    doc.text('CGST (9%):', totalsX, y);
    doc.text(formatPaiseNum(invoice.cgst), valX, y, { align: 'right' });
  }
  if (Number(invoice.sgst) > 0) {
    y += 6;
    doc.text('SGST (9%):', totalsX, y);
    doc.text(formatPaiseNum(invoice.sgst), valX, y, { align: 'right' });
  }
  if (Number(invoice.igst) > 0) {
    y += 6;
    doc.text('IGST (18%):', totalsX, y);
    doc.text(formatPaiseNum(invoice.igst), valX, y, { align: 'right' });
  }

  // Total line
  y += 3;
  doc.setDrawColor(44, 62, 80);
  doc.setLineWidth(0.5);
  doc.line(totalsX, y, valX, y);
  y += 7;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(44, 62, 80);
  doc.text('Total:', totalsX, y);
  doc.text(`₹ ${formatPaiseNum(invoice.total)}`, valX, y, { align: 'right' });

  // Notes and Terms
  y += 15;
  if (invoice.notes) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100);
    doc.text('Notes:', 14, y);
    doc.setFont('helvetica', 'normal');
    const noteLines = doc.splitTextToSize(invoice.notes, pageWidth - 28);
    doc.text(noteLines, 14, y + 5);
    y += 5 + noteLines.length * 4;
  }
  if (invoice.terms) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100);
    doc.text('Terms & Conditions:', 14, y);
    doc.setFont('helvetica', 'normal');
    const termLines = doc.splitTextToSize(invoice.terms, pageWidth - 28);
    doc.text(termLines, 14, y + 5);
  }

  // Footer
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text('Generated by TBM Practice OS', pageWidth / 2, pageH - 10, { align: 'center' });

  doc.save(`Invoice-${invoice.invoiceNo.replace(/\//g, '-')}.pdf`);
}

export default function BillingPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('invoice.create');
  const canPay = hasPermission('payment.create');

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [firm, setFirm] = useState<FirmSettings | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [payForm, setPayForm] = useState({ amount: '', mode: 'upi', referenceNo: '' });
  const [form, setForm] = useState({
    customerId: '', issueDate: '', dueDate: '', notes: '', terms: '',
    lineItems: [{ description: '', quantity: '1', rate: '', amount: '' }],
  });
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = () => api<Invoice[]>('/invoices').then(setInvoices).catch(() => {});

  useEffect(() => {
    load();
    api<{ id: string; name: string }[]>('/customers').then(setCustomers).catch(() => {});
    api<FirmSettings>('/settings').then(setFirm).catch(() => {});
  }, []);

  const addLine = () => setForm({ ...form, lineItems: [...form.lineItems, { description: '', quantity: '1', rate: '', amount: '' }] });

  const removeLine = (index: number) => {
    if (form.lineItems.length <= 1) return;
    setForm({ ...form, lineItems: form.lineItems.filter((_, i) => i !== index) });
  };

  const updateLine = (index: number, field: string, value: string) => {
    const items = [...form.lineItems];
    (items[index] as Record<string, string>)[field] = value;
    if (field === 'rate' || field === 'quantity') {
      items[index].amount = String(Number(items[index].quantity || 0) * Number(items[index].rate || 0));
    }
    setForm({ ...form, lineItems: items });
  };

  const subtotal = form.lineItems.reduce((s, li) => s + Number(li.amount || 0), 0);
  const cgst = Math.round(subtotal * 0.09);
  const sgst = Math.round(subtotal * 0.09);
  const total = subtotal + cgst + sgst;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api('/invoices', {
        method: 'POST',
        body: JSON.stringify({
          customerId: form.customerId,
          issueDate: new Date(form.issueDate).toISOString(),
          dueDate: new Date(form.dueDate).toISOString(),
          notes: form.notes || undefined,
          terms: form.terms || undefined,
          lineItems: form.lineItems.map((li) => ({
            description: li.description,
            quantity: li.quantity,
            rate: li.rate,
            amount: li.amount,
          })),
        }),
      });
      setShowForm(false);
      setForm({ customerId: '', issueDate: '', dueDate: '', notes: '', terms: '', lineItems: [{ description: '', quantity: '1', rate: '', amount: '' }] });
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handlePay = async () => {
    if (!payingId) return;
    try {
      await api(`/invoices/${payingId}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: payForm.amount,
          mode: payForm.mode,
          referenceNo: payForm.referenceNo || undefined,
          paidOn: new Date().toISOString(),
        }),
      });
      setPayingId(null);
      setPayForm({ amount: '', mode: 'upi', referenceNo: '' });
      load();
    } catch {}
  };

  const handleDownloadPdf = async (invoiceId: string) => {
    setDownloading(invoiceId);
    try {
      const inv = await api<Invoice>(`/invoices/${invoiceId}`);
      const customerName = customerMap[inv.customerId] || 'Customer';
      await generateInvoicePdf(inv, customerName, firm);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to generate PDF');
    } finally {
      setDownloading(null);
    }
  };

  const handlePreview = async (invoiceId: string) => {
    try {
      const inv = await api<Invoice>(`/invoices/${invoiceId}`);
      setViewingInvoice(inv);
    } catch {}
  };

  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c.name]));

  return (
    <section className="space-y-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Invoices</h2>
        {canCreate && (
          <button className="primary-button" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'Create Invoice'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="panel space-y-4">
          <div className="panel-title">New Invoice</div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Customer *</label>
              <select className="input-field" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required>
                <option value="">Select...</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Issue Date *</label>
              <input type="date" className="input-field" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} required />
            </div>
            <div>
              <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Due Date *</label>
              <input type="date" className="input-field" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required />
            </div>
          </div>

          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Line Items</div>
          {form.lineItems.map((li, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-5 items-end">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-muted-foreground">Description</label>
                <input className="input-field" placeholder="Service description" value={li.description} onChange={(e) => updateLine(i, 'description', e.target.value)} required />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Qty</label>
                <input className="input-field" type="number" min="1" value={li.quantity} onChange={(e) => updateLine(i, 'quantity', e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Rate (paise)</label>
                <input className="input-field" type="number" placeholder="e.g. 500000" value={li.rate} onChange={(e) => updateLine(i, 'rate', e.target.value)} required />
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">Amount</label>
                  <input className="input-field bg-accent/50" value={li.amount ? formatPaise(li.amount) : ''} readOnly />
                </div>
                {form.lineItems.length > 1 && (
                  <button type="button" className="mb-[2px] rounded p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => removeLine(i)}>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            </div>
          ))}
          <button type="button" className="text-xs text-primary hover:underline" onClick={addLine}>+ Add line item</button>

          {/* Totals preview */}
          {subtotal > 0 && (
            <div className="rounded-md bg-accent/30 p-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatPaise(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">CGST (9%)</span><span>{formatPaise(cgst)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">SGST (9%)</span><span>{formatPaise(sgst)}</span></div>
              <div className="mt-1 flex justify-between border-t border-border pt-1 font-semibold"><span>Total</span><span>{formatPaise(total)}</span></div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Notes</label>
              <textarea className="input-field" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
            </div>
            <div>
              <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Terms & Conditions</label>
              <textarea className="input-field" rows={2} value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} placeholder="Payment terms" />
            </div>
          </div>

          <button type="submit" className="primary-button">Create Invoice</button>
        </form>
      )}

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2">Invoice #</th>
              <th>Customer</th>
              <th>Issue Date</th>
              <th>Due Date</th>
              <th>Total</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-accent/30">
                <td className="py-3 font-mono text-xs font-medium">{inv.invoiceNo}</td>
                <td>{customerMap[inv.customerId] || '-'}</td>
                <td className="text-xs">{new Date(inv.issueDate).toLocaleDateString('en-IN')}</td>
                <td className="text-xs">{new Date(inv.dueDate).toLocaleDateString('en-IN')}</td>
                <td className="font-medium">{formatPaise(inv.total)}</td>
                <td>
                  <span className={`rounded px-2 py-1 text-xs font-medium ${STATUS_COLORS[inv.status] || 'bg-accent'}`}>
                    {inv.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <button
                      className="text-xs text-primary hover:underline"
                      onClick={() => handlePreview(inv.id)}
                    >
                      View
                    </button>
                    <button
                      className="text-xs text-primary hover:underline"
                      disabled={downloading === inv.id}
                      onClick={() => handleDownloadPdf(inv.id)}
                    >
                      {downloading === inv.id ? 'Generating...' : 'PDF'}
                    </button>
                    {canPay && inv.status !== 'paid' && inv.status !== 'cancelled' && (
                      <button className="text-xs text-primary hover:underline" onClick={() => { setPayingId(inv.id); setPayForm({ amount: inv.total, mode: 'upi', referenceNo: '' }); }}>
                        Pay
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No invoices found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Payment Modal */}
      {payingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPayingId(null)}>
          <div className="w-full max-w-md panel space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="panel-title">Record Payment</div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Amount (paise)</label>
                <input className="input-field" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
                <p className="mt-0.5 text-xs text-muted-foreground">{payForm.amount ? formatPaise(payForm.amount) : ''}</p>
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Mode</label>
                <select className="input-field" value={payForm.mode} onChange={(e) => setPayForm({ ...payForm, mode: e.target.value })}>
                  {['cash', 'upi', 'neft', 'cheque', 'other'].map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Reference No</label>
                <input className="input-field" value={payForm.referenceNo} onChange={(e) => setPayForm({ ...payForm, referenceNo: e.target.value })} placeholder="Transaction ID" />
              </div>
            </div>
            <div className="flex gap-2">
              <button className="primary-button" onClick={handlePay}>Submit Payment</button>
              <button className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent" onClick={() => setPayingId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Preview Modal */}
      {viewingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setViewingInvoice(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto panel" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">Invoice {viewingInvoice.invoiceNo}</h3>
                <span className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[viewingInvoice.status] || 'bg-accent'}`}>
                  {viewingInvoice.status.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="primary-button text-xs"
                  onClick={() => {
                    handleDownloadPdf(viewingInvoice.id);
                  }}
                >
                  Download PDF
                </button>
                <button onClick={() => setViewingInvoice(null)} className="rounded p-1 text-muted-foreground hover:bg-accent">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-[13px] font-medium text-muted-foreground">Customer</span>
                <p>{customerMap[viewingInvoice.customerId] || '-'}</p>
              </div>
              <div>
                <span className="text-[13px] font-medium text-muted-foreground">Issue Date</span>
                <p>{new Date(viewingInvoice.issueDate).toLocaleDateString('en-IN')}</p>
              </div>
              <div>
                <span className="text-[13px] font-medium text-muted-foreground">Due Date</span>
                <p>{new Date(viewingInvoice.dueDate).toLocaleDateString('en-IN')}</p>
              </div>
            </div>

            {/* Line items */}
            <table className="mb-4 w-full text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 text-left">#</th>
                  <th className="text-left">Description</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Rate</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(viewingInvoice.lineItems || []).map((li, i) => (
                  <tr key={li.id}>
                    <td className="py-2">{i + 1}</td>
                    <td>{li.description}</td>
                    <td className="text-right">{li.quantity}</td>
                    <td className="text-right">{formatPaise(li.rate)}</td>
                    <td className="text-right">{formatPaise(li.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="ml-auto w-64 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatPaise(viewingInvoice.subtotal)}</span></div>
              {Number(viewingInvoice.cgst) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">CGST (9%)</span><span>{formatPaise(viewingInvoice.cgst)}</span></div>}
              {Number(viewingInvoice.sgst) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">SGST (9%)</span><span>{formatPaise(viewingInvoice.sgst)}</span></div>}
              {Number(viewingInvoice.igst) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">IGST (18%)</span><span>{formatPaise(viewingInvoice.igst)}</span></div>}
              <div className="flex justify-between border-t border-border pt-1 font-semibold"><span>Total</span><span>{formatPaise(viewingInvoice.total)}</span></div>
            </div>

            {viewingInvoice.notes && (
              <div className="mt-4 text-sm">
                <span className="text-[13px] font-medium text-muted-foreground">Notes</span>
                <p className="mt-0.5 text-muted-foreground">{viewingInvoice.notes}</p>
              </div>
            )}
            {viewingInvoice.terms && (
              <div className="mt-2 text-sm">
                <span className="text-[13px] font-medium text-muted-foreground">Terms</span>
                <p className="mt-0.5 text-muted-foreground">{viewingInvoice.terms}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
