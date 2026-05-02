import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface Invoice {
  id: string;
  customerId: string;
  invoiceNo: string;
  issueDate: string;
  dueDate: string;
  subtotal: string;
  total: string;
  status: string;
  lineItems?: { id: string; description: string; quantity: string; rate: string; amount: string }[];
}

function formatPaise(paise: string | number) {
  return `₹${(Number(paise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  partially_paid: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
};

export default function BillingPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('invoice.create');
  const canPay = hasPermission('payment.create');

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payForm, setPayForm] = useState({ amount: '', mode: 'upi', referenceNo: '' });
  const [form, setForm] = useState({
    customerId: '', issueDate: '', dueDate: '', notes: '',
    lineItems: [{ description: '', quantity: '1', rate: '', amount: '' }],
  });
  const [error, setError] = useState('');

  const load = () => api<Invoice[]>('/invoices').then(setInvoices).catch(() => {});

  useEffect(() => {
    load();
    api<{ id: string; name: string }[]>('/customers').then(setCustomers).catch(() => {});
  }, []);

  const addLine = () => setForm({ ...form, lineItems: [...form.lineItems, { description: '', quantity: '1', rate: '', amount: '' }] });

  const updateLine = (index: number, field: string, value: string) => {
    const items = [...form.lineItems];
    (items[index] as Record<string, string>)[field] = value;
    if (field === 'rate' || field === 'quantity') {
      items[index].amount = String(Number(items[index].quantity || 0) * Number(items[index].rate || 0));
    }
    setForm({ ...form, lineItems: items });
  };

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
          notes: form.notes,
          lineItems: form.lineItems.map((li) => ({
            description: li.description,
            quantity: li.quantity,
            rate: li.rate,
            amount: li.amount,
          })),
        }),
      });
      setShowForm(false);
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
          referenceNo: payForm.referenceNo,
          paidOn: new Date().toISOString(),
        }),
      });
      setPayingId(null);
      setPayForm({ amount: '', mode: 'upi', referenceNo: '' });
      load();
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
        <form onSubmit={handleCreate} className="panel space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Customer</label>
              <select className="input-field" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required>
                <option value="">Select...</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Issue Date</label>
              <input type="date" className="input-field" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Due Date</label>
              <input type="date" className="input-field" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required />
            </div>
          </div>
          <div className="text-xs font-medium text-muted-foreground">Line Items</div>
          {form.lineItems.map((li, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-4">
              <input className="input-field" placeholder="Description" value={li.description} onChange={(e) => updateLine(i, 'description', e.target.value)} required />
              <input className="input-field" placeholder="Qty" type="number" value={li.quantity} onChange={(e) => updateLine(i, 'quantity', e.target.value)} />
              <input className="input-field" placeholder="Rate (paise)" type="number" value={li.rate} onChange={(e) => updateLine(i, 'rate', e.target.value)} required />
              <input className="input-field" placeholder="Amount" value={li.amount} readOnly />
            </div>
          ))}
          <button type="button" className="text-xs text-primary hover:underline" onClick={addLine}>+ Add line item</button>
          <div>
            <button type="submit" className="primary-button">Create Invoice</button>
          </div>
        </form>
      )}

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[700px] text-left text-sm">
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
              <tr key={inv.id}>
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
                  {canPay && inv.status !== 'paid' && inv.status !== 'cancelled' && (
                    <button className="text-xs text-primary hover:underline" onClick={() => { setPayingId(inv.id); setPayForm({ amount: inv.total, mode: 'upi', referenceNo: '' }); }}>
                      Record Payment
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No invoices found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {payingId && (
        <div className="panel space-y-3">
          <div className="panel-title">Record Payment</div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Amount (paise)</label>
              <input className="input-field" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Mode</label>
              <select className="input-field" value={payForm.mode} onChange={(e) => setPayForm({ ...payForm, mode: e.target.value })}>
                {['cash', 'upi', 'neft', 'cheque', 'other'].map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Reference No</label>
              <input className="input-field" value={payForm.referenceNo} onChange={(e) => setPayForm({ ...payForm, referenceNo: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2">
            <button className="primary-button" onClick={handlePay}>Submit</button>
            <button className="icon-button px-3" onClick={() => setPayingId(null)}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}
