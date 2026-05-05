import { useEffect, useState } from 'react';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { api } from '../lib/api';

interface Enquiry {
  id: string;
  customerId: string;
  source: string;
  brief?: string;
  status: string;
  serviceId?: string;
  proposalAmount?: string;
  referralName?: string;
  referralContact?: string;
  referralDetails?: string;
  createdAt: string;
}

interface ServiceItem {
  id: string;
  name: string;
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

const CUSTOMER_TYPES = ['individual', 'company', 'llp', 'partnership', 'trust'];

export default function EnquiriesPage() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [servicesList, setServicesList] = useState<ServiceItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEnquiry, setEditingEnquiry] = useState<Enquiry | null>(null);
  const [form, setForm] = useState({
    customerId: '', source: 'call', brief: '', serviceId: '',
    referralName: '', referralContact: '', referralDetails: '',
  });
  const [error, setError] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Inline customer creation
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [newCustForm, setNewCustForm] = useState({ name: '', type: 'company', email: '', contactNo: '' });

  const load = () => api<Enquiry[]>('/enquiries').then(setEnquiries).catch(() => {});
  const loadCustomers = () => api<{ id: string; name: string }[]>('/customers').then(setCustomers).catch(() => {});

  useEffect(() => {
    load();
    loadCustomers();
    api<ServiceItem[]>('/services-catalog').then(setServicesList).catch(() => {});
  }, []);

  const resetForm = () => {
    setForm({ customerId: '', source: 'call', brief: '', serviceId: '', referralName: '', referralContact: '', referralDetails: '' });
    setShowForm(false);
    setEditingEnquiry(null);
    setCreatingCustomer(false);
    setNewCustForm({ name: '', type: 'company', email: '', contactNo: '' });
    setError('');
  };

  const handleCreateCustomerInline = async () => {
    setError('');
    try {
      const created = await api<{ id: string; name: string }>('/customers', {
        method: 'POST',
        body: JSON.stringify(newCustForm),
      });
      await loadCustomers();
      setForm({ ...form, customerId: created.id });
      setCreatingCustomer(false);
      setNewCustForm({ name: '', type: 'company', email: '', contactNo: '' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create customer');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const body: Record<string, unknown> = { customerId: form.customerId, source: form.source };
      if (form.brief) body.brief = form.brief;
      if (form.serviceId) body.serviceId = form.serviceId;
      if (form.source === 'referral') {
        if (form.referralName) body.referralName = form.referralName;
        if (form.referralContact) body.referralContact = form.referralContact;
        if (form.referralDetails) body.referralDetails = form.referralDetails;
      }
      await api('/enquiries', { method: 'POST', body: JSON.stringify(body) });
      resetForm();
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleEdit = (enq: Enquiry) => {
    setEditingEnquiry(enq);
    setForm({
      customerId: enq.customerId,
      source: enq.source,
      brief: enq.brief || '',
      serviceId: enq.serviceId || '',
      referralName: enq.referralName || '',
      referralContact: enq.referralContact || '',
      referralDetails: enq.referralDetails || '',
    });
    setShowForm(false);
    setError('');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEnquiry) return;
    setError('');
    try {
      const body: Record<string, unknown> = {
        customerId: form.customerId,
        source: form.source,
        brief: form.brief || undefined,
        serviceId: form.serviceId || undefined,
      };
      if (form.source === 'referral') {
        body.referralName = form.referralName || undefined;
        body.referralContact = form.referralContact || undefined;
        body.referralDetails = form.referralDetails || undefined;
      }
      await api(`/enquiries/${editingEnquiry.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      resetForm();
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

  const handleDelete = async (id: string) => {
    try {
      await api(`/enquiries/${id}`, { method: 'DELETE' });
      setDeleteConfirmId(null);
      load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Delete failed');
      setDeleteConfirmId(null);
    }
  };

  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c.name]));
  const serviceMap = Object.fromEntries(servicesList.map((s) => [s.id, s.name]));

  return (
    <section className="space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Enquiries</h2>
        <button className="primary-button text-sm" onClick={() => { if (editingEnquiry) { resetForm(); } else { setShowForm(!showForm); } }}>
          {showForm || editingEnquiry ? 'Cancel' : 'New Enquiry'}
        </button>
      </div>

      {(showForm || editingEnquiry) && (
        <form onSubmit={editingEnquiry ? handleUpdate : handleCreate} className="panel space-y-3">
          <div className="panel-title">{editingEnquiry ? 'Edit Enquiry' : 'New Enquiry'}</div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* Customer selection */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Customer</label>
              {!creatingCustomer ? (
                <div className="flex gap-1">
                  <select className="input-field flex-1" value={form.customerId} onChange={(e) => {
                    if (e.target.value === '__new__') {
                      setCreatingCustomer(true);
                    } else {
                      setForm({ ...form, customerId: e.target.value });
                    }
                  }} required>
                    <option value="">Select...</option>
                    <option value="__new__">+ Create New Customer</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              ) : (
                <div className="space-y-2 rounded border border-primary/30 bg-primary/5 p-2">
                  <div className="flex items-center gap-1 text-xs font-medium text-primary">
                    <Plus className="h-3 w-3" /> New Customer
                  </div>
                  <input className="input-field" placeholder="Name *" value={newCustForm.name} onChange={(e) => setNewCustForm({ ...newCustForm, name: e.target.value })} required />
                  <select className="input-field" value={newCustForm.type} onChange={(e) => setNewCustForm({ ...newCustForm, type: e.target.value })}>
                    {CUSTOMER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input className="input-field" placeholder="Email" type="email" value={newCustForm.email} onChange={(e) => setNewCustForm({ ...newCustForm, email: e.target.value })} />
                  <input className="input-field" placeholder="Contact No" value={newCustForm.contactNo} onChange={(e) => setNewCustForm({ ...newCustForm, contactNo: e.target.value })} />
                  <div className="flex gap-1">
                    <button type="button" className="primary-button text-xs" onClick={handleCreateCustomerInline}>Create</button>
                    <button type="button" className="rounded border border-border px-2 py-1 text-xs hover:bg-accent" onClick={() => setCreatingCustomer(false)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>

            {/* Source */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Source</label>
              <select className="input-field" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Service type */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Service Type</label>
              <select className="input-field" value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })}>
                <option value="">None</option>
                {servicesList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* Brief */}
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Brief</label>
              <input className="input-field" value={form.brief} onChange={(e) => setForm({ ...form, brief: e.target.value })} />
            </div>
          </div>

          {/* Referral fields */}
          {form.source === 'referral' && (
            <div className="rounded-md border border-amber-300/50 bg-amber-50/30 p-3 dark:border-amber-700/30 dark:bg-amber-900/10">
              <p className="mb-2 text-xs font-medium text-amber-700 dark:text-amber-300">Referral Details</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Referral Name</label>
                  <input className="input-field" value={form.referralName} onChange={(e) => setForm({ ...form, referralName: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Referral Contact</label>
                  <input className="input-field" value={form.referralContact} onChange={(e) => setForm({ ...form, referralContact: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Referral Details</label>
                  <input className="input-field" value={form.referralDetails} onChange={(e) => setForm({ ...form, referralDetails: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          <button type="submit" className="primary-button">{editingEnquiry ? 'Save Changes' : 'Create'}</button>
        </form>
      )}

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2">Customer</th>
              <th>Source</th>
              <th>Service</th>
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
                <td className="text-xs">{enq.serviceId ? (serviceMap[enq.serviceId] || '-') : '-'}</td>
                <td className="max-w-[200px] truncate">{enq.brief || '-'}</td>
                <td>
                  <span className={`rounded px-2 py-1 text-xs font-medium ${STATUS_COLORS[enq.status] || 'bg-accent'}`}>
                    {enq.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="text-xs">{new Date(enq.createdAt).toLocaleDateString('en-IN')}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <select className="input-field text-xs" value={enq.status} onChange={(e) => {
                      const newStatus = e.target.value;
                      if (newStatus === 'converted' && enq.status !== 'converted') {
                        if (confirm('Converting this enquiry will auto-create a task. Continue?')) {
                          updateStatus(enq.id, newStatus);
                        }
                      } else {
                        updateStatus(enq.id, newStatus);
                      }
                    }}>
                      {ENQ_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                    </select>
                    <button className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title="Edit" onClick={() => handleEdit(enq)}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    {deleteConfirmId === enq.id ? (
                      <div className="flex items-center gap-1">
                        <button className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700" onClick={() => handleDelete(enq.id)}>Yes</button>
                        <button className="rounded border border-border px-2 py-1 text-xs hover:bg-accent" onClick={() => setDeleteConfirmId(null)}>No</button>
                      </div>
                    ) : (
                      <button className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20" title="Delete" onClick={() => setDeleteConfirmId(enq.id)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {enquiries.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No enquiries found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
