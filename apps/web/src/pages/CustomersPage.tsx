import { useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { api } from '../lib/api';

interface Customer {
  id: string;
  name: string;
  type: string;
  email?: string;
  contactNo?: string;
  gstin?: string;
  pan?: string;
  status: string;
  enquirySource: string;
  address?: string;
}

const TYPES = ['individual', 'company', 'llp', 'partnership', 'trust'];
const SOURCES = ['call', 'whatsapp', 'walkin', 'email', 'referral'];

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: '', type: 'company', contactNo: '', email: '', gstin: '', pan: '', address: '', enquirySource: 'call', briefText: '' });
  const [error, setError] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const load = () => api<Customer[]>('/customers').then(setCustomers).catch(() => {});
  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm({ name: '', type: 'company', contactNo: '', email: '', gstin: '', pan: '', address: '', enquirySource: 'call', briefText: '' });
    setShowForm(false);
    setEditingCustomer(null);
    setError('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api('/customers', { method: 'POST', body: JSON.stringify(form) });
      resetForm();
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleEdit = (c: Customer) => {
    setEditingCustomer(c);
    setForm({
      name: c.name,
      type: c.type,
      contactNo: c.contactNo || '',
      email: c.email || '',
      gstin: c.gstin || '',
      pan: c.pan || '',
      address: c.address || '',
      enquirySource: c.enquirySource || 'call',
      briefText: '',
    });
    setShowForm(false);
    setError('');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    setError('');
    try {
      const body: Record<string, string> = {};
      if (form.name !== editingCustomer.name) body.name = form.name;
      if (form.type !== editingCustomer.type) body.type = form.type;
      if (form.email !== (editingCustomer.email || '')) body.email = form.email;
      if (form.contactNo !== (editingCustomer.contactNo || '')) body.contactNo = form.contactNo;
      if (form.gstin !== (editingCustomer.gstin || '')) body.gstin = form.gstin;
      if (form.pan !== (editingCustomer.pan || '')) body.pan = form.pan;
      if (form.address !== (editingCustomer.address || '')) body.address = form.address;
      if (form.enquirySource !== (editingCustomer.enquirySource || '')) body.enquirySource = form.enquirySource;
      await api(`/customers/${editingCustomer.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      resetForm();
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api(`/customers/${id}`, { method: 'DELETE' });
      setDeleteConfirmId(null);
      load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Delete failed');
      setDeleteConfirmId(null);
    }
  };

  return (
    <section className="space-y-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Customers</h2>
        <button className="primary-button" onClick={() => { if (editingCustomer) { resetForm(); } else { setShowForm(!showForm); setEditingCustomer(null); } }}>
          {showForm || editingCustomer ? 'Cancel' : 'Add Customer'}
        </button>
      </div>

      {(showForm || editingCustomer) && (
        <form onSubmit={editingCustomer ? handleUpdate : handleCreate} className="panel space-y-3">
          <div className="panel-title">{editingCustomer ? 'Edit Customer' : 'New Customer'}</div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
            <SelectField label="Type" value={form.type} options={TYPES} onChange={(v) => setForm({ ...form, type: v })} />
            <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
            <Field label="Contact No" value={form.contactNo} onChange={(v) => setForm({ ...form, contactNo: v })} />
            <Field label="GSTIN" value={form.gstin} onChange={(v) => setForm({ ...form, gstin: v })} />
            <Field label="PAN" value={form.pan} onChange={(v) => setForm({ ...form, pan: v })} />
            <SelectField label="Source" value={form.enquirySource} options={SOURCES} onChange={(v) => setForm({ ...form, enquirySource: v })} />
            <Field label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
            {!editingCustomer && <Field label="Brief" value={form.briefText} onChange={(v) => setForm({ ...form, briefText: v })} />}
          </div>
          <button type="submit" className="primary-button">{editingCustomer ? 'Save Changes' : 'Create'}</button>
        </form>
      )}

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2">Name</th>
              <th>Type</th>
              <th>Email</th>
              <th>Contact</th>
              <th>GSTIN</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {customers.map((c) => (
              <tr key={c.id}>
                <td className="py-3 font-medium">{c.name}</td>
                <td>{c.type}</td>
                <td>{c.email || '-'}</td>
                <td>{c.contactNo || '-'}</td>
                <td className="font-mono text-xs">{c.gstin || '-'}</td>
                <td><StatusBadge value={c.status} /></td>
                <td>
                  <div className="flex items-center gap-2">
                    <button className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title="Edit" onClick={() => handleEdit(c)}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    {deleteConfirmId === c.id ? (
                      <div className="flex items-center gap-1">
                        <button className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700" onClick={() => handleDelete(c.id)}>Confirm</button>
                        <button className="rounded border border-border px-2 py-1 text-xs hover:bg-accent" onClick={() => setDeleteConfirmId(null)}>No</button>
                      </div>
                    ) : (
                      <button className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20" title="Delete" onClick={() => setDeleteConfirmId(c.id)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No customers found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Overlay */}
    </section>
  );
}

function Field({ label, value, onChange, type = 'text', required = false }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="input-field" required={required} />
    </div>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input-field">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    inactive: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    churned: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    enquiry: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    prospect: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    onboarded: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  };
  return <span className={`rounded px-2 py-1 text-xs font-medium ${colors[value] || 'bg-accent'}`}>{value}</span>;
}
