import { useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { api } from '../lib/api';

interface Customer {
  id: string;
  name: string;
  type: string;
  email?: string | null;
  contactNo?: string | null;
  gstin?: string | null;
  pan?: string | null;
  address?: string | null;
  status: string;
  enquirySource: string;
  briefText?: string | null;
  ownerUserId?: string | null;
  defaultTeamId?: string | null;
}

interface UserMini { id: string; name: string }
interface TeamMini { id: string; name: string }

const TYPES = ['individual', 'company', 'llp', 'partnership', 'trust'];
const SOURCES = ['call', 'whatsapp', 'walkin', 'email', 'referral'];
const STATUSES = ['enquiry', 'prospect', 'onboarded', 'active', 'inactive', 'churned'];

type FormState = {
  name: string;
  type: string;
  contactNo: string;
  email: string;
  gstin: string;
  pan: string;
  address: string;
  enquirySource: string;
  status: string;
  briefText: string;
  ownerUserId: string;
  defaultTeamId: string;
};

const emptyForm: FormState = {
  name: '', type: 'company', contactNo: '', email: '', gstin: '', pan: '', address: '',
  enquirySource: 'call', status: 'enquiry', briefText: '', ownerUserId: '', defaultTeamId: '',
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<UserMini[]>([]);
  const [teams, setTeams] = useState<TeamMini[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const load = () => api<Customer[]>('/customers').then(setCustomers).catch(() => {});
  useEffect(() => {
    load();
    api<UserMini[]>('/users').then(setUsers).catch(() => {});
    api<TeamMini[]>('/teams').then(setTeams).catch(() => {});
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setShowForm(false);
    setEditingCustomer(null);
    setError('');
  };

  const buildPayload = (): Record<string, unknown> => {
    // Send only fields the user can edit. Empty string maps to undefined / null
    // so optional columns can be cleared without tripping validators.
    const clean = (v: string) => (v.trim() === '' ? null : v);
    return {
      name: form.name,
      type: form.type,
      email: clean(form.email),
      contactNo: clean(form.contactNo),
      gstin: clean(form.gstin),
      pan: clean(form.pan),
      address: clean(form.address),
      enquirySource: form.enquirySource,
      status: form.status,
      briefText: clean(form.briefText),
      ownerUserId: clean(form.ownerUserId) ?? undefined,
      defaultTeamId: clean(form.defaultTeamId) ?? undefined,
    };
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const payload = buildPayload();
      // strip nulls on create — backend create DTO requires enquirySource non-empty
      Object.keys(payload).forEach((k) => {
        if (payload[k] === null) delete payload[k];
      });
      await api('/customers', { method: 'POST', body: JSON.stringify(payload) });
      resetForm();
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create customer');
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
      status: c.status || 'enquiry',
      briefText: c.briefText || '',
      ownerUserId: c.ownerUserId || '',
      defaultTeamId: c.defaultTeamId || '',
    });
    setShowForm(false);
    setError('');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    setError('');
    try {
      await api(`/customers/${editingCustomer.id}`, {
        method: 'PATCH',
        body: JSON.stringify(buildPayload()),
      });
      resetForm();
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update customer');
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Customers</h2>
        <button
          className="primary-button text-sm"
          onClick={() => {
            if (editingCustomer) {
              resetForm();
            } else {
              setShowForm(!showForm);
              setEditingCustomer(null);
            }
          }}
        >
          {showForm || editingCustomer ? 'Cancel' : 'Add Customer'}
        </button>
      </div>

      {(showForm || editingCustomer) && (
        <form onSubmit={editingCustomer ? handleUpdate : handleCreate} className="panel space-y-3">
          <div className="panel-title">{editingCustomer ? 'Edit Customer' : 'New Customer'}</div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
            <SelectField label="Type" value={form.type} options={TYPES} onChange={(v) => setForm({ ...form, type: v })} />
            <SelectField label="Status" value={form.status} options={STATUSES} onChange={(v) => setForm({ ...form, status: v })} />

            <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
            <Field label="Contact No" value={form.contactNo} onChange={(v) => setForm({ ...form, contactNo: v })} />
            <SelectField label="Enquiry Source" value={form.enquirySource} options={SOURCES} onChange={(v) => setForm({ ...form, enquirySource: v })} />

            <Field label="GSTIN" value={form.gstin} onChange={(v) => setForm({ ...form, gstin: v })} />
            <Field label="PAN" value={form.pan} onChange={(v) => setForm({ ...form, pan: v })} />
            <Field label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />

            <div className="sm:col-span-2 lg:col-span-3">
              <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Brief / Notes</label>
              <textarea
                className="input-field"
                rows={2}
                value={form.briefText}
                onChange={(e) => setForm({ ...form, briefText: e.target.value })}
                placeholder="Short note about this customer or initial requirement"
              />
            </div>

            <SelectField
              label="Owner User"
              value={form.ownerUserId}
              options={['', ...users.map((u) => u.id)]}
              labelFor={(v) => (v ? users.find((u) => u.id === v)?.name || v : 'Unassigned')}
              onChange={(v) => setForm({ ...form, ownerUserId: v })}
            />
            <SelectField
              label="Default Team"
              value={form.defaultTeamId}
              options={['', ...teams.map((t) => t.id)]}
              labelFor={(v) => (v ? teams.find((t) => t.id === v)?.name || v : 'None')}
              onChange={(v) => setForm({ ...form, defaultTeamId: v })}
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="primary-button">
              {editingCustomer ? 'Save Changes' : 'Create'}
            </button>
            <button type="button" className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent" onClick={resetForm}>
              Cancel
            </button>
          </div>
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
                    <button
                      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      title="Edit"
                      onClick={() => handleEdit(c)}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {deleteConfirmId === c.id ? (
                      <div className="flex items-center gap-1">
                        <button className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700" onClick={() => handleDelete(c.id)}>Confirm</button>
                        <button className="rounded border border-border px-2 py-1 text-xs hover:bg-accent" onClick={() => setDeleteConfirmId(null)}>No</button>
                      </div>
                    ) : (
                      <button
                        className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                        title="Delete"
                        onClick={() => setDeleteConfirmId(c.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted-foreground">
                  No customers found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Field({
  label, value, onChange, type = 'text', required = false,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="mb-1 block text-[13px] font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field"
        required={required}
      />
    </div>
  );
}

function SelectField({
  label, value, options, onChange, labelFor,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  labelFor?: (v: string) => string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[13px] font-medium text-muted-foreground">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input-field">
        {options.map((o) => (
          <option key={o || '__empty'} value={o}>
            {labelFor ? labelFor(o) : o}
          </option>
        ))}
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
