import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Enquiry {
  id: string;
  customerId: string;
  source: string;
  brief?: string;
  status: string;
  proposalAmount?: string;
  createdAt: string;
}

const SOURCES = ['call', 'whatsapp', 'walkin', 'email', 'referral'];
const ENQ_STATUSES = ['open', 'proposal_sent', 'converted', 'lost', 'on_hold'];

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  proposal_sent: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  converted: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  lost: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  on_hold: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

export default function EnquiriesPage() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ customerId: '', source: 'call', brief: '' });
  const [error, setError] = useState('');

  const load = () => api<Enquiry[]>('/enquiries').then(setEnquiries).catch(() => {});

  useEffect(() => {
    load();
    api<{ id: string; name: string }[]>('/customers').then(setCustomers).catch(() => {});
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api('/enquiries', { method: 'POST', body: JSON.stringify(form) });
      setShowForm(false);
      setForm({ customerId: '', source: 'call', brief: '' });
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api(`/enquiries/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      load();
    } catch {}
  };

  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c.name]));

  return (
    <section className="space-y-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Enquiries</h2>
        <button className="primary-button" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'New Enquiry'}
        </button>
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
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Source</label>
              <select className="input-field" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Brief</label>
              <input className="input-field" value={form.brief} onChange={(e) => setForm({ ...form, brief: e.target.value })} />
            </div>
          </div>
          <button type="submit" className="primary-button">Create</button>
        </form>
      )}

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2">Customer</th>
              <th>Source</th>
              <th>Brief</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {enquiries.map((enq) => (
              <tr key={enq.id}>
                <td className="py-3 font-medium">{customerMap[enq.customerId] || 'Unknown'}</td>
                <td>{enq.source}</td>
                <td className="max-w-[200px] truncate">{enq.brief || '-'}</td>
                <td>
                  <span className={`rounded px-2 py-1 text-xs font-medium ${STATUS_COLORS[enq.status] || 'bg-accent'}`}>
                    {enq.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="text-xs">{new Date(enq.createdAt).toLocaleDateString('en-IN')}</td>
                <td>
                  <select className="input-field text-xs" value={enq.status} onChange={(e) => updateStatus(enq.id, e.target.value)}>
                    {ENQ_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {enquiries.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No enquiries found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
