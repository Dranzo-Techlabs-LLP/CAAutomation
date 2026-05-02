import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: string;
  status: string;
  customerId: string;
  assignedToUserId?: string;
  dueDate?: string;
  generatedBy: string;
  billingAmount?: string;
}

const STATUSES = ['unassigned', 'assigned', 'in_progress', 'on_hold', 'review', 'completed', 'cancelled'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const STATUS_COLORS: Record<string, string> = {
  unassigned: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  assigned: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  on_hold: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  review: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  cancellation_requested: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-gray-500',
  medium: 'text-blue-600',
  high: 'text-orange-600',
  urgent: 'text-red-600 font-bold',
};

export default function TasksPage() {
  const { hasPermission, user } = useAuth();
  const canCreate = hasPermission('task.create');
  const canEdit = hasPermission('task.edit');
  const canViewAll = hasPermission('task.view');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [services, setServices] = useState<{ id: string; name: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState({ title: '', customerId: '', serviceId: '', priority: 'medium', description: '', assignedToUserId: '', dueDate: '' });
  const [error, setError] = useState('');

  const load = () => {
    const endpoint = canViewAll ? '/tasks?limit=200' : '/tasks/my?limit=200';
    api<{ data: Task[] }>(endpoint).then((r) => setTasks(r.data || [])).catch(() => {});
  };

  useEffect(() => {
    load();
    api<{ id: string; name: string }[]>('/customers').then(setCustomers).catch(() => {});
    api<{ id: string; name: string }[]>('/users').then(setUsers).catch(() => setUsers([]));
    api<{ id: string; name: string }[]>('/services-catalog').then(setServices).catch(() => {});
  }, [canViewAll]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const body: Record<string, unknown> = { title: form.title, customerId: form.customerId, priority: form.priority };
      if (form.serviceId) body.serviceId = form.serviceId;
      if (form.description) body.description = form.description;
      if (form.assignedToUserId) body.assignedToUserId = form.assignedToUserId;
      if (form.dueDate) body.dueDate = new Date(form.dueDate).toISOString();
      await api('/tasks', { method: 'POST', body: JSON.stringify(body) });
      setShowForm(false);
      setForm({ title: '', customerId: '', serviceId: '', priority: 'medium', description: '', assignedToUserId: '', dueDate: '' });
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const updateStatus = async (taskId: string, status: string) => {
    try {
      await api(`/tasks/${taskId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      load();
    } catch {}
  };

  const filtered = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter);
  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c.name]));
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

  return (
    <section className="space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Tasks</h2>
        <div className="flex gap-2">
          <select className="input-field text-xs" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All ({tasks.length})</option>
            {STATUSES.map((s) => {
              const count = tasks.filter((t) => t.status === s).length;
              return <option key={s} value={s}>{s.replace(/_/g, ' ')} ({count})</option>;
            })}
          </select>
          {canCreate && (
            <button className="primary-button" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Cancel' : 'New Task'}
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="panel space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Title</label>
              <input className="input-field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Customer</label>
              <select className="input-field" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required>
                <option value="">Select...</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Service</label>
              <select className="input-field" value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })}>
                <option value="">None</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Priority</label>
              <select className="input-field" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Assign to</label>
              <select className="input-field" value={form.assignedToUserId} onChange={(e) => setForm({ ...form, assignedToUserId: e.target.value })}>
                <option value="">Unassigned</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Due Date</label>
              <input type="date" className="input-field" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Description</label>
            <textarea className="input-field" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <button type="submit" className="primary-button">Create Task</button>
        </form>
      )}

      <div className="space-y-2">
        {filtered.map((task) => (
          <div key={task.id} className="panel flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold uppercase ${PRIORITY_COLORS[task.priority] || ''}`}>{task.priority}</span>
                <h3 className="truncate text-sm font-medium">{task.title}</h3>
              </div>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>{customerMap[task.customerId] || 'Unknown'}</span>
                {task.assignedToUserId && <span>Assigned: {userMap[task.assignedToUserId] || 'Unknown'}</span>}
                {task.dueDate && <span>Due: {new Date(task.dueDate).toLocaleDateString('en-IN')}</span>}
                {task.generatedBy !== 'manual' && <span className="rounded bg-accent px-1">{task.generatedBy}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded px-2 py-1 text-xs font-medium ${STATUS_COLORS[task.status] || 'bg-accent'}`}>
                {task.status.replace(/_/g, ' ')}
              </span>
              {canEdit && (
                <select
                  className="input-field text-xs"
                  value={task.status}
                  onChange={(e) => updateStatus(task.id, e.target.value)}
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="panel py-8 text-center text-muted-foreground">No tasks found</div>
        )}
      </div>
    </section>
  );
}
