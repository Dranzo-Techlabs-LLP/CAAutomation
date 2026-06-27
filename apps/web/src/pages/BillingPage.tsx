import { useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { GST_RATES, INDIA_STATES, STATE_NAME, TDS_SECTIONS, rupeesToWordsIN, stateCodeFromGstin } from '../lib/billing-utils';

interface LineItem {
  id: string;
  description: string;
  quantity: string;
  rate: string;
  amount: string;
  hsnSac?: string | null;
  gstRate?: string;
  cgstAmount?: string;
  sgstAmount?: string;
  igstAmount?: string;
  cessAmount?: string;
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
  cess?: string;
  tdsPaise?: string;
  tdsSection?: string | null;
  tdsRate?: string;
  roundOff?: string;
  total: string;
  status: string;
  notes?: string | null;
  terms?: string | null;
  followUpDate?: string | null;
  followUpNote?: string | null;
  lineItems?: LineItem[];
  gstTreatment?: string;
  placeOfSupply?: string | null;
  reverseCharge?: boolean;
  customerGstinSnapshot?: string | null;
  customerStateCode?: string | null;
  customerNameSnapshot?: string | null;
  customerAddressSnapshot?: string | null;
  amountInWords?: string | null;
  irn?: string | null;
}

interface FirmSettings {
  name: string;
  gstin?: string | null;
  pan?: string | null;
  address?: string | null;
  stateCode?: string | null;
  logoUrl?: string | null;
  signatureUrl?: string | null;
  signatoryName?: string | null;
  signatoryDesignation?: string | null;
}

interface ServiceOption {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  hsnSac?: string | null;
  defaultBillingAmount?: string | null;
  defaultGstRate?: string | null;
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
  doc.text(invoice.customerNameSnapshot || customerName, 14, y + 6);
  doc.setFontSize(8);
  doc.setTextColor(90);
  let billY = y + 11;
  if (invoice.customerAddressSnapshot) {
    const lines = doc.splitTextToSize(invoice.customerAddressSnapshot, 90);
    doc.text(lines, 14, billY);
    billY += lines.length * 3.5;
  }
  if (invoice.customerGstinSnapshot) doc.text(`GSTIN: ${invoice.customerGstinSnapshot}`, 14, billY + 3);

  // Line items table (with per-line GST split)
  y = Math.max(y + 16, billY + 8);
  const isIgst = Number(invoice.igst) > 0;
  const tableData = (invoice.lineItems || []).map((li, i) => {
    const cgst = Number(li.cgstAmount || 0);
    const sgst = Number(li.sgstAmount || 0);
    const igst = Number(li.igstAmount || 0);
    return [
      String(i + 1),
      li.description,
      li.hsnSac || '-',
      li.quantity,
      formatPaiseNum(li.rate),
      formatPaiseNum(li.amount),
      `${li.gstRate || '0'}%`,
      isIgst ? formatPaiseNum(igst) : `${formatPaiseNum(cgst)} / ${formatPaiseNum(sgst)}`,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['#', 'Description', 'HSN/SAC', 'Qty', 'Rate (₹)', 'Taxable (₹)', 'GST', isIgst ? 'IGST (₹)' : 'CGST / SGST (₹)']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [44, 62, 80],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 12, halign: 'center' },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 24, halign: 'right' },
      6: { cellWidth: 12, halign: 'center' },
      7: { cellWidth: 32, halign: 'right' },
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
    doc.text('SGST:', totalsX, y);
    doc.text(formatPaiseNum(invoice.sgst), valX, y, { align: 'right' });
  }
  if (Number(invoice.igst) > 0) {
    y += 6;
    doc.text('IGST:', totalsX, y);
    doc.text(formatPaiseNum(invoice.igst), valX, y, { align: 'right' });
  }
  if (Number(invoice.cess || 0) > 0) {
    y += 6;
    doc.text('Cess:', totalsX, y);
    doc.text(formatPaiseNum(invoice.cess || '0'), valX, y, { align: 'right' });
  }
  if (Number(invoice.tdsPaise || 0) > 0) {
    y += 6;
    doc.setTextColor(180, 90, 0);
    doc.text(`(−) TDS${invoice.tdsSection ? ` u/s ${invoice.tdsSection}` : ''}:`, totalsX, y);
    doc.text(`-${formatPaiseNum(invoice.tdsPaise || '0')}`, valX, y, { align: 'right' });
    doc.setTextColor(80);
  }
  if (Number(invoice.roundOff || 0) !== 0) {
    y += 6;
    doc.text('Round Off:', totalsX, y);
    doc.text(formatPaiseNum(invoice.roundOff || '0'), valX, y, { align: 'right' });
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
  doc.text(Number(invoice.tdsPaise || 0) > 0 ? 'Net Receivable:' : 'Total:', totalsX, y);
  doc.text(`₹ ${formatPaiseNum(invoice.total)}`, valX, y, { align: 'right' });

  // Amount in words
  if (invoice.amountInWords) {
    y += 8;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100);
    const wordLines = doc.splitTextToSize(`Amount in words: ${invoice.amountInWords}`, pageWidth - 28);
    doc.text(wordLines, 14, y);
    y += wordLines.length * 3.5;
  }
  if (invoice.reverseCharge) {
    y += 4;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 90, 0);
    doc.text('Tax payable under Reverse Charge: YES', 14, y);
    doc.setTextColor(100);
  }
  if (invoice.placeOfSupply) {
    y += 4;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`Place of Supply: ${invoice.placeOfSupply}`, 14, y);
  }
  if (invoice.irn) {
    y += 4;
    doc.text(`IRN: ${invoice.irn}`, 14, y);
  }

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

  // Authorized Signature block (right side, above footer)
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
        // Place signature box: 50mm wide, 18mm tall, right-aligned
        const sigW = 45;
        const sigH = 18;
        doc.addImage(sigData, 'PNG', sigRightX - sigW, sigBlockBottom - 26, sigW, sigH);
      } catch {
        // image failed, skip
      }
    }
  }
  // Signatory name + designation
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60);
  doc.setFontSize(8);
  if (firm?.signatoryName) doc.text(firm.signatoryName, sigRightX, sigBlockBottom - 4, { align: 'right' });
  if (firm?.signatoryDesignation) doc.text(firm.signatoryDesignation, sigRightX, sigBlockBottom, { align: 'right' });
  // Underline above "Authorized Signatory"
  doc.setDrawColor(180);
  doc.setLineWidth(0.3);
  doc.line(sigRightX - 60, sigBlockBottom - 7, sigRightX, sigBlockBottom - 7);
  doc.setFontSize(7);
  doc.setTextColor(110);
  doc.text('Authorized Signatory', sigRightX, sigBlockBottom + 4, { align: 'right' });

  // Footer
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
  const [customers, setCustomers] = useState<{ id: string; name: string; gstin?: string | null; address?: string | null; pan?: string | null }[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [firm, setFirm] = useState<FirmSettings | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [payForm, setPayForm] = useState({ amount: '', mode: 'upi', referenceNo: '' });
  const [form, setForm] = useState({
    customerId: '', issueDate: '', dueDate: '', notes: '', terms: '',
    gstTreatment: 'regular', placeOfSupply: '', reverseCharge: false,
    tdsRate: '', tdsSection: '',
    lineItems: [{ serviceId: '', description: '', quantity: '1', rate: '', amount: '', hsnSac: '', gstRate: '18' }],
  });
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);

  // ── Billing pipeline tabs ──
  type Tab = 'pending' | 'invoiced' | 'payment';
  const [tab, setTab] = useState<Tab>('pending');
  type PendingTask = { taskId: string; title: string; customerId: string; customerName: string; serviceId: string | null; serviceName: string | null; completedAt: string | null; estimatedHours: string | null; suggestedAmountPaise: string | null };
  type DueInvoice = Invoice & { paidPaise: number; balancePaise: number; customerName: string };
  const [pending, setPending] = useState<PendingTask[]>([]);
  const [due, setDue] = useState<DueInvoice[]>([]);
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [followUp, setFollowUp] = useState<DueInvoice | null>(null);
  const [followForm, setFollowForm] = useState({ date: '', note: '', assignToUserId: '' });
  const [nonBillable, setNonBillable] = useState<PendingTask[]>([]);
  const [pendingView, setPendingView] = useState<'billable' | 'non_billable'>('billable');
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [editForm, setEditForm] = useState({ issueDate: '', dueDate: '', notes: '', terms: '' });

  const load = () => api<Invoice[]>('/invoices').then(setInvoices).catch(() => {});
  const loadPending = () => api<PendingTask[]>('/invoices-pending').then(setPending).catch(() => setPending([]));
  const loadNonBillable = () => api<PendingTask[]>('/invoices-pending?view=non_billable').then(setNonBillable).catch(() => setNonBillable([]));
  const loadDue = () => api<DueInvoice[]>('/payment-pending').then(setDue).catch(() => setDue([]));

  useEffect(() => {
    load(); loadPending(); loadNonBillable(); loadDue();
    api<{ id: string; name: string; gstin?: string | null; address?: string | null; pan?: string | null }[]>('/customers').then(setCustomers).catch(() => {});
    api<ServiceOption[]>('/services-catalog').then(setServices).catch(() => {});
    api<FirmSettings>('/settings').then(setFirm).catch(() => {});
    api<{ id: string; name: string }[]>('/users/lookup').then(setStaff).catch(() => setStaff([]));
  }, []);

  // Prefill the create-invoice form from a completed-but-unbilled task.
  const createFromPending = (p: PendingTask) => {
    const rate = p.suggestedAmountPaise || '';
    setForm({
      customerId: p.customerId,
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
      notes: '', terms: '', gstTreatment: 'regular', placeOfSupply: '', reverseCharge: false,
      tdsRate: '', tdsSection: '',
      lineItems: [{
        serviceId: p.serviceId || '', description: p.title,
        quantity: '1', rate, amount: rate, hsnSac: '', gstRate: '18',
      }],
    });
    setShowForm(true);
    setTab('invoiced');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // "No invoice needed" — e.g. monthly TDS payment task where only the
  // quarterly return filing is billed. Marks the task non-billable and
  // removes it from the pending list.
  const dismissPending = async (p: PendingTask) => {
    if (!window.confirm(`Mark "${p.title}" as not requiring an invoice? It will move to the Non-billable list.`)) return;
    try {
      await api(`/invoices-pending/${p.taskId}/dismiss`, { method: 'PATCH' });
      setPending((prev) => prev.filter((x) => x.taskId !== p.taskId));
      setNonBillable((prev) => [p, ...prev]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not dismiss');
    }
  };

  // Undo — move a non-billable task back into Invoice Pending
  const restorePending = async (p: PendingTask) => {
    try {
      await api(`/invoices-pending/${p.taskId}/restore`, { method: 'PATCH' });
      setNonBillable((prev) => prev.filter((x) => x.taskId !== p.taskId));
      setPending((prev) => [p, ...prev]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not restore');
    }
  };

  const submitFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUp) return;
    try {
      await api(`/invoices/${followUp.id}/follow-up`, {
        method: 'PATCH',
        body: JSON.stringify({
          date: followForm.date,
          note: followForm.note || undefined,
          assignToUserId: followForm.assignToUserId || undefined,
        }),
      });
      setFollowUp(null);
      setFollowForm({ date: '', note: '', assignToUserId: '' });
      loadDue();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to set follow-up');
    }
  };

  const addLine = () => setForm({ ...form, lineItems: [...form.lineItems, { serviceId: '', description: '', quantity: '1', rate: '', amount: '', hsnSac: '', gstRate: '18' }] });

  const removeLine = (index: number) => {
    if (form.lineItems.length <= 1) return;
    setForm({ ...form, lineItems: form.lineItems.filter((_, i) => i !== index) });
  };

  // `rate` and `amount` in form state are PAISE (matches API).
  // The rate INPUT shows rupees; we convert on the boundary.
  const updateLine = (index: number, field: string, value: string) => {
    const items = [...form.lineItems];
    if (field === 'rateRupees') {
      // Convert rupees input → paise for storage
      const rupees = Number(value || 0);
      const paise = Math.round(rupees * 100);
      items[index].rate = String(paise);
      items[index].amount = String(Number(items[index].quantity || 0) * paise);
    } else {
      (items[index] as Record<string, string>)[field] = value;
      if (field === 'quantity') {
        items[index].amount = String(Number(items[index].quantity || 0) * Number(items[index].rate || 0));
      }
    }
    setForm({ ...form, lineItems: items });
  };

  const onServiceSelect = (index: number, serviceId: string) => {
    const items = [...form.lineItems];
    const svc = services.find((s) => s.id === serviceId);
    items[index].serviceId = serviceId;
    if (svc) {
      // Auto-fill but allow override
      items[index].description = svc.description?.trim() || svc.name;
      items[index].hsnSac = svc.hsnSac || items[index].hsnSac || '';
      if (svc.defaultBillingAmount) {
        items[index].rate = svc.defaultBillingAmount;
        items[index].amount = String(Number(items[index].quantity || 1) * Number(svc.defaultBillingAmount));
      }
      if (svc.defaultGstRate) items[index].gstRate = String(parseInt(svc.defaultGstRate, 10));
    }
    setForm({ ...form, lineItems: items });
  };

  // Live GST computation matching backend logic
  const selectedCustomer = customers.find((c) => c.id === form.customerId) as { id: string; name: string; gstin?: string | null; address?: string | null } | undefined;
  const supplierState = stateCodeFromGstin(firm?.gstin) || firm?.stateCode || null;
  const customerState = stateCodeFromGstin(selectedCustomer?.gstin);
  const placeOfSupply = form.placeOfSupply || customerState || supplierState || '';
  const treatment = form.gstTreatment;
  const forceIgst = treatment === 'export' || treatment === 'export_with_payment' || treatment === 'sez' || (placeOfSupply !== '' && supplierState !== null && placeOfSupply !== supplierState);
  const isIntra = !forceIgst && supplierState && placeOfSupply && supplierState === placeOfSupply;

  const subtotal = form.lineItems.reduce((s, li) => s + Number(li.amount || 0), 0);
  let cgstSum = 0, sgstSum = 0, igstSum = 0;
  form.lineItems.forEach((li) => {
    const amt = Number(li.amount || 0);
    const rate = treatment === 'composition' || treatment === 'export' ? 0 : Number(li.gstRate || 0);
    if (rate <= 0) return;
    const tax = Math.round((amt * rate) / 100);
    if (isIntra) {
      const half = Math.round(tax / 2);
      cgstSum += half;
      sgstSum += tax - half;
    } else {
      igstSum += tax;
    }
  });
  const tdsRateNum = Number(form.tdsRate || 0);
  const tdsAmount = tdsRateNum > 0 ? Math.round((subtotal * tdsRateNum) / 100) : 0;
  const beforeRound = subtotal + cgstSum + sgstSum + igstSum - tdsAmount;
  const totalRounded = Math.round(beforeRound / 100) * 100;
  const roundOffPaise = totalRounded - beforeRound;
  const total = totalRounded;

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
          gstTreatment: form.gstTreatment,
          placeOfSupply: form.placeOfSupply || undefined,
          reverseCharge: form.reverseCharge,
          tdsRate: form.tdsRate || undefined,
          tdsSection: form.tdsSection || undefined,
          notes: form.notes || undefined,
          terms: form.terms || undefined,
          lineItems: form.lineItems.map((li) => ({
            serviceId: (li as { serviceId?: string }).serviceId || undefined,
            description: li.description,
            quantity: li.quantity,
            rate: li.rate,
            amount: li.amount,
            hsnSac: li.hsnSac || undefined,
            gstRate: li.gstRate || '18',
          })),
        }),
      });
      setShowForm(false);
      setForm({ customerId: '', issueDate: '', dueDate: '', notes: '', terms: '', gstTreatment: 'regular', placeOfSupply: '', reverseCharge: false, tdsRate: '', tdsSection: '', lineItems: [{ serviceId: '', description: '', quantity: '1', rate: '', amount: '', hsnSac: '', gstRate: '18' }] });
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

  // Issue a draft (draft → sent) so it enters the payment pipeline.
  const sendInvoice = async (inv: Invoice) => {
    try { await api(`/invoices/${inv.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'sent' }) }); load(); loadDue(); }
    catch (err) { alert(err instanceof Error ? err.message : 'Could not send'); }
  };
  const cancelInvoice = async (inv: Invoice) => {
    if (!window.confirm(`Cancel invoice ${inv.invoiceNo}?`)) return;
    try { await api(`/invoices/${inv.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) }); load(); loadDue(); }
    catch (err) { alert(err instanceof Error ? err.message : 'Could not cancel'); }
  };
  const deleteInvoice = async (inv: Invoice) => {
    if (!window.confirm(`Delete invoice ${inv.invoiceNo}? This cannot be undone.`)) return;
    try { await api(`/invoices/${inv.id}`, { method: 'DELETE' }); load(); loadDue(); }
    catch (err) { alert(err instanceof Error ? err.message : 'Could not delete'); }
  };
  const submitEditInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editInvoice) return;
    try {
      await api(`/invoices/${editInvoice.id}`, { method: 'PATCH', body: JSON.stringify(editForm) });
      setEditInvoice(null); load();
    } catch (err) { alert(err instanceof Error ? err.message : 'Could not save'); }
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

      {/* Pipeline tabs */}
      <div className="flex gap-1 border-b border-border">
        {([
          ['pending', `Invoice Pending${pending.length ? ` (${pending.length})` : ''}`],
          ['invoiced', 'Invoiced'],
          ['payment', `Payment Pending${due.length ? ` (${due.length})` : ''}`],
        ] as [Tab, string][]).map(([k, lbl]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${tab === k ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {lbl}
          </button>
        ))}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="panel space-y-5">
          <div className="panel-title">New Invoice</div>
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">{error}</div>}

          {/* Bill-to */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="field-label">Customer *</label>
              <select className="input-field" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required>
                <option value="">Select...</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {selectedCustomer && (
                <div className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                  {selectedCustomer.gstin && <div>GSTIN: <span className="font-medium text-foreground">{selectedCustomer.gstin}</span> {customerState && `(${STATE_NAME[customerState] || customerState})`}</div>}
                  {selectedCustomer.address && <div className="truncate">{selectedCustomer.address}</div>}
                </div>
              )}
            </div>
            <div>
              <label className="field-label">Issue Date *</label>
              <input type="date" className="input-field" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} required />
            </div>
            <div>
              <label className="field-label">Due Date *</label>
              <input type="date" className="input-field" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required />
            </div>
          </div>

          {/* GST settings */}
          <div className="rounded-lg border border-border bg-accent/20 p-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">GST Settings</div>
            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <label className="field-label">GST Treatment</label>
                <select className="input-field" value={form.gstTreatment} onChange={(e) => setForm({ ...form, gstTreatment: e.target.value })}>
                  <option value="regular">Regular (taxable)</option>
                  <option value="composition">Composition (no GST charged)</option>
                  <option value="unregistered">Unregistered customer</option>
                  <option value="sez">SEZ supply</option>
                  <option value="export">Export (without payment of tax / LUT)</option>
                  <option value="export_with_payment">Export (with payment of IGST)</option>
                </select>
              </div>
              <div>
                <label className="field-label">Place of Supply</label>
                <select className="input-field" value={form.placeOfSupply} onChange={(e) => setForm({ ...form, placeOfSupply: e.target.value })}>
                  <option value="">{customerState ? `Auto: ${STATE_NAME[customerState] || customerState}` : 'Select...'}</option>
                  {INDIA_STATES.map((s) => <option key={s.code} value={s.code}>{s.code} — {s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Tax Type (auto)</label>
                <div className="input-field flex items-center bg-background text-sm">
                  {!supplierState ? <span className="text-amber-700 dark:text-amber-400">Set firm state in Settings →</span> : placeOfSupply === '' ? '—' : isIntra ? 'CGST + SGST (intra-state)' : 'IGST (inter-state)'}
                </div>
                {supplierState && (
                  <p className="mt-0.5 text-[10.5px] text-muted-foreground">Supplier: {STATE_NAME[supplierState] || supplierState} ({supplierState})</p>
                )}
              </div>
              <div className="flex items-end">
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium">
                  <input type="checkbox" className="h-4 w-4" checked={form.reverseCharge} onChange={(e) => setForm({ ...form, reverseCharge: e.target.checked })} />
                  Reverse charge applicable
                </label>
              </div>
            </div>
            {!supplierState && (
              <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">⚠ Firm state not set. Go to Settings → Business Details → Business State to enable correct CGST/SGST vs IGST split.</p>
            )}
          </div>

          {/* Line items */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Line Items</div>
              <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={addLine}>+ Add line item</button>
            </div>
            <div className="space-y-2">
              {form.lineItems.map((li, i) => {
                const lineTax = (() => {
                  const amt = Number(li.amount || 0);
                  const rate = treatment === 'composition' || treatment === 'export' ? 0 : Number(li.gstRate || 0);
                  return Math.round((amt * rate) / 100);
                })();
                return (
                  <div key={i} className="rounded-lg border border-border bg-panel p-3">
                    <div className="grid gap-2 sm:grid-cols-12 items-end">
                      <div className="sm:col-span-3">
                        <label className="field-label">Service</label>
                        <select className="input-field" value={(li as { serviceId?: string }).serviceId || ''} onChange={(e) => onServiceSelect(i, e.target.value)}>
                          <option value="">— Custom (no service) —</option>
                          {services.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                        </select>
                      </div>
                      <div className="sm:col-span-4">
                        <label className="field-label">Description *</label>
                        <input className="input-field" placeholder="Auto-filled from service; editable" value={li.description} onChange={(e) => updateLine(i, 'description', e.target.value)} required />
                      </div>
                      <div className="sm:col-span-1">
                        <label className="field-label">HSN/SAC</label>
                        <input className="input-field" placeholder="998231" value={li.hsnSac || ''} onChange={(e) => updateLine(i, 'hsnSac', e.target.value)} />
                      </div>
                      <div className="sm:col-span-1">
                        <label className="field-label">Qty</label>
                        <input className="input-field" type="number" min="0" step="0.01" value={li.quantity} onChange={(e) => updateLine(i, 'quantity', e.target.value)} />
                      </div>
                      <div className="sm:col-span-1">
                        <label className="field-label">Rate (₹)</label>
                        <input
                          className="input-field"
                          type="number"
                          step="0.01"
                          placeholder="5000.00"
                          value={li.rate ? (Number(li.rate) / 100).toString() : ''}
                          onChange={(e) => updateLine(i, 'rateRupees', e.target.value)}
                          required
                        />
                      </div>
                      <div className="sm:col-span-1">
                        <label className="field-label">GST %</label>
                        <select className="input-field" value={li.gstRate} onChange={(e) => updateLine(i, 'gstRate', e.target.value)} disabled={treatment === 'composition' || treatment === 'export'}>
                          {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                        </select>
                      </div>
                      <div className="sm:col-span-1 flex items-end gap-1">
                        <div className="flex-1">
                          <label className="field-label">Amount</label>
                          <input className="input-field bg-accent/30" value={li.amount ? formatPaise(li.amount) : ''} readOnly />
                        </div>
                        {form.lineItems.length > 1 && (
                          <button type="button" className="mb-[2px] rounded p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => removeLine(i)} aria-label="Remove line">
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                          </button>
                        )}
                      </div>
                    </div>
                    {Number(li.amount) > 0 && lineTax > 0 && (
                      <div className="mt-1.5 text-[10.5px] text-muted-foreground">Tax on this line: <span className="font-semibold text-foreground">{formatPaise(lineTax)}</span></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* TDS */}
          <div className="rounded-lg border border-border bg-accent/20 p-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">TDS (Customer-deducted)</div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="field-label">Section</label>
                <select className="input-field" value={form.tdsSection} onChange={(e) => setForm({ ...form, tdsSection: e.target.value })}>
                  <option value="">None</option>
                  {TDS_SECTIONS.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Rate %</label>
                <input className="input-field" type="number" step="0.01" placeholder="e.g. 10" value={form.tdsRate} onChange={(e) => setForm({ ...form, tdsRate: e.target.value })} />
              </div>
              <div>
                <label className="field-label">TDS Amount (auto)</label>
                <div className="input-field flex items-center bg-background text-sm">{tdsAmount > 0 ? formatPaise(tdsAmount) : '—'}</div>
              </div>
            </div>
          </div>

          {/* Totals preview */}
          {subtotal > 0 && (
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal (taxable value)</span><span className="font-mono tabular-nums">{formatPaise(subtotal)}</span></div>
                {cgstSum > 0 && <div className="flex justify-between"><span className="text-muted-foreground">CGST</span><span className="font-mono tabular-nums">{formatPaise(cgstSum)}</span></div>}
                {sgstSum > 0 && <div className="flex justify-between"><span className="text-muted-foreground">SGST</span><span className="font-mono tabular-nums">{formatPaise(sgstSum)}</span></div>}
                {igstSum > 0 && <div className="flex justify-between"><span className="text-muted-foreground">IGST</span><span className="font-mono tabular-nums">{formatPaise(igstSum)}</span></div>}
                {tdsAmount > 0 && <div className="flex justify-between text-amber-700 dark:text-amber-400"><span>(−) TDS {form.tdsSection ? `u/s ${form.tdsSection}` : ''} @ {form.tdsRate}%</span><span className="font-mono tabular-nums">−{formatPaise(tdsAmount)}</span></div>}
                {roundOffPaise !== 0 && <div className="flex justify-between text-muted-foreground"><span>Round Off</span><span className="font-mono tabular-nums">{roundOffPaise > 0 ? '+' : ''}{formatPaise(roundOffPaise)}</span></div>}
                <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-bold text-foreground"><span>Net Receivable</span><span className="font-mono tabular-nums">{formatPaise(total)}</span></div>
                <p className="mt-1 text-[11px] italic text-muted-foreground">{rupeesToWordsIN(total / 100)}</p>
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label">Notes</label>
              <textarea className="input-field" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes (e.g. service period, PO ref)" />
            </div>
            <div>
              <label className="field-label">Terms & Conditions</label>
              <textarea className="input-field" rows={2} value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} placeholder="Payment terms (e.g. Net 30, late fee)" />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" className="primary-button">Create Invoice</button>
          </div>
        </form>
      )}

      {/* STAGE 1 — Invoice Pending (completed, not yet invoiced) */}
      {tab === 'pending' && (
        <div className="panel overflow-x-auto">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              {pendingView === 'billable'
                ? 'Work completed and awaiting invoice — generated automatically from completed billable tasks.'
                : 'Completed work marked as not requiring an invoice (e.g. monthly TDS payment runs). Restore anytime.'}
            </div>
            <div className="flex rounded-md border border-border text-xs font-medium">
              <button
                className={`px-2.5 py-1 rounded-l-md ${pendingView === 'billable' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-accent'}`}
                onClick={() => setPendingView('billable')}
              >
                Billable{pending.length ? ` (${pending.length})` : ''}
              </button>
              <button
                className={`px-2.5 py-1 rounded-r-md ${pendingView === 'non_billable' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-accent'}`}
                onClick={() => setPendingView('non_billable')}
              >
                Non-billable{nonBillable.length ? ` (${nonBillable.length})` : ''}
              </button>
            </div>
          </div>
          {pendingView === 'non_billable' ? (
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr><th className="py-2">Task</th><th>Customer</th><th>Service</th><th>Completed</th><th>Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {nonBillable.map((p) => (
                <tr key={p.taskId} className="hover:bg-accent/30">
                  <td className="py-3 font-medium">{p.title}</td>
                  <td>{p.customerName}</td>
                  <td className="text-xs">{p.serviceName || '-'}</td>
                  <td className="text-xs">{p.completedAt ? new Date(p.completedAt).toLocaleDateString('en-IN') : '-'}</td>
                  <td>
                    {canCreate && (
                      <button className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent" onClick={() => restorePending(p)}>
                        Mark Billable
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {nonBillable.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No non-billable completed work.</td></tr>
              )}
            </tbody>
          </table>
          ) : (
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr><th className="py-2">Task</th><th>Customer</th><th>Service</th><th>Completed</th><th>Suggested</th><th>Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pending.map((p) => (
                <tr key={p.taskId} className="hover:bg-accent/30">
                  <td className="py-3 font-medium">{p.title}</td>
                  <td>{p.customerName}</td>
                  <td className="text-xs">{p.serviceName || '-'}</td>
                  <td className="text-xs">{p.completedAt ? new Date(p.completedAt).toLocaleDateString('en-IN') : '-'}</td>
                  <td className="font-mono text-xs tabular-nums">{p.suggestedAmountPaise ? formatPaise(p.suggestedAmountPaise) : '—'}</td>
                  <td>
                    {canCreate && (
                      <div className="flex items-center gap-1.5">
                        <button className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-white hover:bg-primary/90" onClick={() => createFromPending(p)}>
                          Create Invoice
                        </button>
                        <button
                          className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent"
                          title="This work does not need an invoice — remove it from the pending list"
                          onClick={() => dismissPending(p)}
                        >
                          No Invoice
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {pending.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Nothing pending — every completed task is invoiced 🎉</td></tr>
              )}
            </tbody>
          </table>
          )}
        </div>
      )}

      {/* STAGE 2 — Invoiced */}
      {tab === 'invoiced' && (
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
                    {canCreate && inv.status === 'draft' && (
                      <>
                        <button className="text-xs font-medium text-emerald-600 hover:underline" onClick={() => sendInvoice(inv)}>Send</button>
                        <button className="text-xs text-muted-foreground hover:underline" onClick={() => { setEditInvoice(inv); setEditForm({ issueDate: inv.issueDate.slice(0, 10), dueDate: inv.dueDate.slice(0, 10), notes: (inv as { notes?: string }).notes || '', terms: (inv as { terms?: string }).terms || '' }); }}>Edit</button>
                      </>
                    )}
                    {canCreate && inv.status !== 'paid' && inv.status !== 'cancelled' && (
                      <button className="text-xs text-muted-foreground hover:underline" onClick={() => cancelInvoice(inv)}>Cancel</button>
                    )}
                    {canCreate && (inv.status === 'draft' || inv.status === 'cancelled') && (
                      <button className="text-xs text-red-600 hover:underline" onClick={() => deleteInvoice(inv)}>Delete</button>
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
      )}

      {/* STAGE 3 — Payment Pending (outstanding) */}
      {tab === 'payment' && (
        <div className="panel overflow-x-auto">
          <div className="mb-2 text-xs text-muted-foreground">Invoiced but not fully paid. Record payments, or set a call-back follow-up that lands in the accountant's task view.</div>
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr><th className="py-2">Invoice #</th><th>Customer</th><th>Due</th><th>Total</th><th>Paid</th><th>Balance</th><th>Follow-up</th><th>Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {due.map((inv) => {
                const overdue = new Date(inv.dueDate) < new Date();
                return (
                  <tr key={inv.id} className="hover:bg-accent/30">
                    <td className="py-3 font-mono text-xs font-medium">{inv.invoiceNo}</td>
                    <td>{inv.customerName}</td>
                    <td className={`text-xs ${overdue ? 'font-semibold text-red-600' : ''}`}>{new Date(inv.dueDate).toLocaleDateString('en-IN')}</td>
                    <td className="font-mono text-xs tabular-nums">{formatPaise(inv.total)}</td>
                    <td className="font-mono text-xs tabular-nums text-green-700 dark:text-green-400">{formatPaise(inv.paidPaise)}</td>
                    <td className="font-mono text-xs font-semibold tabular-nums">{formatPaise(inv.balancePaise)}</td>
                    <td className="text-xs">
                      {inv.followUpDate
                        ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">{new Date(inv.followUpDate).toLocaleDateString('en-IN')}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {canPay && (
                          <button className="text-xs text-primary hover:underline" onClick={() => { setPayingId(inv.id); setPayForm({ amount: String(inv.balancePaise), mode: 'upi', referenceNo: '' }); }}>
                            Record Payment
                          </button>
                        )}
                        {canPay && (
                          <button className="text-xs text-amber-700 hover:underline dark:text-amber-400" onClick={() => { setFollowUp(inv); setFollowForm({ date: inv.followUpDate || new Date(Date.now()+864e5).toISOString().slice(0,10), note: inv.followUpNote || '', assignToUserId: '' }); }}>
                            {inv.followUpDate ? 'Reschedule' : 'Set Follow-up'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {due.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">No outstanding payments 🎉</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Payment Modal */}
      {payingId && (
        <div className="modal-overlay" onClick={() => setPayingId(null)} role="dialog" aria-modal="true" aria-labelledby="pay-modal-title">
          <div className="modal-card modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="modal-eyebrow">Billing</span>
                <h3 id="pay-modal-title" className="modal-title">Record Payment</h3>
                <p className="modal-subtitle">Add a payment against this invoice.</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setPayingId(null)} aria-label="Close">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="modal-body space-y-3">
              <div>
                <label className="field-label">Amount (paise)</label>
                <input className="input-field" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
                <p className="mt-1 text-xs text-muted-foreground">{payForm.amount ? formatPaise(payForm.amount) : ''}</p>
              </div>
              <div>
                <label className="field-label">Mode</label>
                <select className="input-field" value={payForm.mode} onChange={(e) => setPayForm({ ...payForm, mode: e.target.value })}>
                  {['cash', 'upi', 'neft', 'cheque', 'other'].map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Reference No</label>
                <input className="input-field" value={payForm.referenceNo} onChange={(e) => setPayForm({ ...payForm, referenceNo: e.target.value })} placeholder="Transaction ID" />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="secondary-button" onClick={() => setPayingId(null)}>Cancel</button>
              <button type="button" className="primary-button" onClick={handlePay}>Submit Payment</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Draft Invoice Modal */}
      {editInvoice && (
        <div className="modal-overlay" onClick={() => setEditInvoice(null)} role="dialog" aria-modal="true">
          <div className="modal-card modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="modal-eyebrow">Draft invoice</span>
                <h3 className="modal-title">Edit {editInvoice.invoiceNo}</h3>
                <p className="modal-subtitle">Dates, notes & terms. Amounts are locked — cancel & re-issue to change line items.</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setEditInvoice(null)} aria-label="Close">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={submitEditInvoice} className="modal-body space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="field-label">Issue Date</label><input type="date" className="input-field" value={editForm.issueDate} onChange={(e) => setEditForm({ ...editForm, issueDate: e.target.value })} /></div>
                <div><label className="field-label">Due Date</label><input type="date" className="input-field" value={editForm.dueDate} onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })} /></div>
              </div>
              <div><label className="field-label">Notes</label><textarea className="input-field" rows={2} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} /></div>
              <div><label className="field-label">Terms</label><textarea className="input-field" rows={2} value={editForm.terms} onChange={(e) => setEditForm({ ...editForm, terms: e.target.value })} /></div>
              <div className="flex justify-end gap-2">
                <button type="button" className="secondary-button" onClick={() => setEditInvoice(null)}>Cancel</button>
                <button type="submit" className="primary-button">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Follow-up Modal */}
      {followUp && (
        <div className="modal-overlay" onClick={() => setFollowUp(null)} role="dialog" aria-modal="true">
          <div className="modal-card modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="modal-eyebrow">Collections</span>
                <h3 className="modal-title">Payment follow-up</h3>
                <p className="modal-subtitle truncate">{followUp.customerName} · {followUp.invoiceNo} · balance {formatPaise(followUp.balancePaise)}</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setFollowUp(null)} aria-label="Close">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={submitFollowUp} className="modal-body space-y-3">
              <div>
                <label className="field-label">Call back on *</label>
                <input type="date" className="input-field" value={followForm.date} onChange={(e) => setFollowForm({ ...followForm, date: e.target.value })} required />
              </div>
              <div>
                <label className="field-label">Assign to</label>
                <select className="input-field" value={followForm.assignToUserId} onChange={(e) => setFollowForm({ ...followForm, assignToUserId: e.target.value })}>
                  <option value="">Me (current accountant)</option>
                  {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Note</label>
                <textarea className="input-field" rows={2} value={followForm.note} onChange={(e) => setFollowForm({ ...followForm, note: e.target.value })} placeholder="e.g. Client asked to call after the 15th" />
              </div>
              <p className="text-[11px] text-muted-foreground">A “Call client — payment follow-up” task will appear in the assignee’s Task view on this date.</p>
              <div className="flex justify-end gap-2">
                <button type="button" className="secondary-button" onClick={() => setFollowUp(null)}>Cancel</button>
                <button type="submit" className="primary-button">Save Follow-up</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Preview Modal */}
      {viewingInvoice && (
        <div className="modal-overlay" onClick={() => setViewingInvoice(null)} role="dialog" aria-modal="true" aria-labelledby="invoice-modal-title">
          <div className="modal-card modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="min-w-0">
                <span className="modal-eyebrow">Invoice</span>
                <h3 id="invoice-modal-title" className="modal-title">{viewingInvoice.invoiceNo}</h3>
                <span className={`mt-1 inline-block rounded px-2 py-0.5 text-[11px] font-semibold capitalize ${STATUS_COLORS[viewingInvoice.status] || 'bg-accent text-foreground'}`}>
                  {viewingInvoice.status.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="primary-button text-xs"
                  onClick={() => { handleDownloadPdf(viewingInvoice.id); }}
                >
                  Download PDF
                </button>
                <button type="button" onClick={() => setViewingInvoice(null)} className="modal-close" aria-label="Close">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="modal-body">
              <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Customer</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-foreground">{customerMap[viewingInvoice.customerId] || '-'}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Issue Date</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-foreground">{new Date(viewingInvoice.issueDate).toLocaleDateString('en-IN')}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Due Date</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-foreground">{new Date(viewingInvoice.dueDate).toLocaleDateString('en-IN')}</dd>
                </div>
              </dl>

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
                      <td className="text-right font-semibold">{formatPaise(li.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="ml-auto w-64 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-medium text-foreground">{formatPaise(viewingInvoice.subtotal)}</span></div>
                {Number(viewingInvoice.cgst) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">CGST (9%)</span><span className="font-medium text-foreground">{formatPaise(viewingInvoice.cgst)}</span></div>}
                {Number(viewingInvoice.sgst) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">SGST (9%)</span><span className="font-medium text-foreground">{formatPaise(viewingInvoice.sgst)}</span></div>}
                {Number(viewingInvoice.igst) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">IGST (18%)</span><span className="font-medium text-foreground">{formatPaise(viewingInvoice.igst)}</span></div>}
                <div className="flex justify-between border-t border-border pt-1.5 text-base font-bold text-foreground"><span>Total</span><span>{formatPaise(viewingInvoice.total)}</span></div>
              </div>

              {viewingInvoice.notes && (
                <div className="mt-4 text-sm">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Notes</span>
                  <p className="mt-0.5 text-foreground">{viewingInvoice.notes}</p>
                </div>
              )}
              {viewingInvoice.terms && (
                <div className="mt-3 text-sm">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Terms</span>
                  <p className="mt-0.5 text-foreground">{viewingInvoice.terms}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
