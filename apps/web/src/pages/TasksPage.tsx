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
  assignedTeamId?: string;
  dueDate?: string;
  generatedBy: string;
  resolution?: string;
  createdAt?: string;
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
};

const STATUS_HEADER_COLORS: Record<string, string> = {
  unassigned: 'border-gray-300 dark:border-gray-600',
  assigned: 'border-blue-400 dark:border-blue-500',
  in_progress: 'border-amber-400 dark:border-amber-500',
  on_hold: 'border-orange-400 dark:border-orange-500',
  review: 'border-purple-400 dark:border-purple-500',
  completed: 'border-green-500 dark:border-green-400',
  cancelled: 'border-red-400 dark:border-red-500',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-gray-500',
  medium: 'text-blue-600',
  high: 'text-orange-600',
  urgent: 'text-red-600 font-bold',
};

const PRIORITY_DOT: Record<string, string> = {
  low: 'bg-gray-400',
  medium: 'bg-blue-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500',
};

type ViewMode = 'list' | 'kanban';

export default function TasksPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('task.create');
  const canEdit = hasPermission('task.edit');
  const canViewAll = hasPermission('task.view');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [services, setServices] = useState<{ id: string; name: string }[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [form, setForm] = useState({
    title: '', customerId: '', serviceId: '', priority: 'medium',
    description: '', assignedToUserId: '', assignedTeamId: '', dueDate: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    const base = canViewAll ? '/tasks' : '/tasks/my';
    // Paginate through all tasks (API max 100 per page)
    const all: Task[] = [];
    let cursor: string | undefined;
    const fetchPage = async (): Promise<void> => {
      const url = cursor ? `${base}?limit=100&cursor=${cursor}` : `${base}?limit=100`;
      const r = await api<{ data: Task[]; nextCursor?: string }>(url);
      all.push(...(r.data || []));
      if (r.nextCursor) {
        cursor = r.nextCursor;
        return fetchPage();
      }
    };
    fetchPage()
      .then(() => setTasks(all))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api<{ id: string; name: string }[]>('/customers').then(setCustomers).catch(() => {});
    api<{ id: string; name: string }[]>('/users').then(setUsers).catch(() => setUsers([]));
    api<{ id: string; name: string }[]>('/services-catalog').then(setServices).catch(() => {});
    api<{ id: string; name: string }[]>('/teams').then(setTeams).catch(() => setTeams([]));
  }, [canViewAll]);

  const resetForm = () => {
    setForm({ title: '', customerId: '', serviceId: '', priority: 'medium', description: '', assignedToUserId: '', assignedTeamId: '', dueDate: '' });
    setEditingTask(null);
    setShowForm(false);
    setError('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const body: Record<string, unknown> = { title: form.title, customerId: form.customerId, priority: form.priority };
      if (form.serviceId) body.serviceId = form.serviceId;
      if (form.description) body.description = form.description;
      if (form.assignedToUserId) body.assignedToUserId = form.assignedToUserId;
      if (form.assignedTeamId) body.assignedTeamId = form.assignedTeamId;
      if (form.dueDate) body.dueDate = new Date(form.dueDate).toISOString();
      await api('/tasks', { method: 'POST', body: JSON.stringify(body) });
      resetForm();
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    }
  };

  const updateStatus = async (taskId: string, status: string) => {
    try {
      await api(`/tasks/${taskId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c.name]));
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));
  const filtered = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter);

  return (
    <section className="space-y-4 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Tasks</h2>
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-muted-foreground">{tasks.length}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-md border border-border">
            <button
              className={`px-3 py-1.5 text-xs ${viewMode === 'kanban' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'} rounded-l-md`}
              onClick={() => setViewMode('kanban')}
            >
              Board
            </button>
            <button
              className={`px-3 py-1.5 text-xs ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'} rounded-r-md`}
              onClick={() => setViewMode('list')}
            >
              List
            </button>
          </div>
          {viewMode === 'list' && (
            <select className="input-field text-xs" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All ({tasks.length})</option>
              {STATUSES.map((s) => {
                const count = tasks.filter((t) => t.status === s).length;
                return <option key={s} value={s}>{s.replace(/_/g, ' ')} ({count})</option>;
              })}
            </select>
          )}
          {canCreate && (
            <button className="primary-button" onClick={() => { showForm ? resetForm() : setShowForm(true); }}>
              {showForm ? 'Cancel' : '+ New Task'}
            </button>
          )}
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="panel space-y-3">
          <div className="panel-title">Create New Task</div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Title *</label>
              <input className="input-field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="Task title" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Customer *</label>
              <select className="input-field" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required>
                <option value="">Select customer...</option>
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
                {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Assign to User</label>
              <select className="input-field" value={form.assignedToUserId} onChange={(e) => setForm({ ...form, assignedToUserId: e.target.value })}>
                <option value="">Unassigned</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Assign to Team</label>
              <select className="input-field" value={form.assignedTeamId} onChange={(e) => setForm({ ...form, assignedTeamId: e.target.value })}>
                <option value="">None</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Due Date</label>
              <input type="date" className="input-field" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Description</label>
            <textarea className="input-field" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description..." />
          </div>
          <button type="submit" className="primary-button">Create Task</button>
        </form>
      )}

      {/* Loading */}
      {loading && <div className="py-8 text-center text-muted-foreground">Loading tasks...</div>}

      {/* Kanban Board */}
      {!loading && viewMode === 'kanban' && (
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '60vh' }}>
          {STATUSES.map((status) => {
            const columnTasks = tasks.filter((t) => t.status === status);
            return (
              <div key={status} className="flex w-72 min-w-[18rem] flex-shrink-0 flex-col rounded-lg bg-accent/30 dark:bg-accent/10">
                {/* Column Header */}
                <div className={`flex items-center justify-between border-b-2 ${STATUS_HEADER_COLORS[status] || 'border-gray-300'} px-3 py-2.5`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide">{status.replace(/_/g, ' ')}</span>
                  </div>
                  <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {columnTasks.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex-1 space-y-2 overflow-y-auto p-2" style={{ maxHeight: 'calc(60vh - 48px)' }}>
                  {columnTasks.map((task) => (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      customerMap={customerMap}
                      userMap={userMap}
                      canEdit={canEdit}
                      onStatusChange={updateStatus}
                      onViewDetails={setEditingTask}
                    />
                  ))}
                  {columnTasks.length === 0 && (
                    <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                      No tasks
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {!loading && viewMode === 'list' && (
        <div className="space-y-2">
          {filtered.map((task) => (
            <div
              key={task.id}
              className="panel flex cursor-pointer flex-col gap-2 transition-colors hover:bg-accent/50 sm:flex-row sm:items-center sm:justify-between"
              onClick={() => setEditingTask(task)}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${PRIORITY_DOT[task.priority] || 'bg-gray-400'}`} />
                  <span className={`text-xs font-semibold uppercase ${PRIORITY_COLORS[task.priority] || ''}`}>{task.priority}</span>
                  <h3 className="truncate text-sm font-medium">{task.title}</h3>
                </div>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>{customerMap[task.customerId] || 'Unknown'}</span>
                  {task.assignedToUserId && <span>Assigned: {userMap[task.assignedToUserId] || 'Unknown'}</span>}
                  {task.dueDate && (
                    <span className={new Date(task.dueDate) < new Date() && task.status !== 'completed' ? 'text-red-600 font-medium' : ''}>
                      Due: {new Date(task.dueDate).toLocaleDateString('en-IN')}
                    </span>
                  )}
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
                    onClick={(e) => e.stopPropagation()}
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
      )}

      {/* Task Detail Modal */}
      {editingTask && (
        <TaskDetailModal
          task={editingTask}
          customerMap={customerMap}
          userMap={userMap}
          canEdit={canEdit}
          statuses={STATUSES}
          onStatusChange={(status) => { updateStatus(editingTask.id, status); setEditingTask(null); }}
          onClose={() => setEditingTask(null)}
        />
      )}
    </section>
  );
}

function KanbanCard({
  task, customerMap, userMap, canEdit, onStatusChange, onViewDetails,
}: {
  task: Task;
  customerMap: Record<string, string>;
  userMap: Record<string, string>;
  canEdit: boolean;
  onStatusChange: (id: string, status: string) => void;
  onViewDetails: (t: Task) => void;
}) {
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';

  return (
    <div
      className="cursor-pointer rounded-md border border-border bg-background p-3 shadow-sm transition-all hover:shadow-md"
      onClick={() => onViewDetails(task)}
    >
      <div className="mb-2 flex items-start justify-between gap-1">
        <h4 className="text-sm font-medium leading-tight">{task.title}</h4>
        <span className={`mt-0.5 inline-block h-2 w-2 flex-shrink-0 rounded-full ${PRIORITY_DOT[task.priority] || 'bg-gray-400'}`}
          title={task.priority} />
      </div>

      <div className="space-y-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground/70">Customer:</span>
          <span className="truncate">{customerMap[task.customerId] || 'Unknown'}</span>
        </div>

        {task.assignedToUserId && (
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground/70">Assignee:</span>
            <span className="truncate font-medium text-foreground">{userMap[task.assignedToUserId] || 'Unknown'}</span>
          </div>
        )}

        {task.dueDate && (
          <div className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
            <span className={isOverdue ? '' : 'text-muted-foreground/70'}>Due:</span>
            <span>{new Date(task.dueDate).toLocaleDateString('en-IN')}</span>
            {isOverdue && <span className="ml-1 text-[10px]">OVERDUE</span>}
          </div>
        )}

        {task.resolution && (
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground/70">Resolution:</span>
            <span className="truncate">{task.resolution}</span>
          </div>
        )}
      </div>

      {canEdit && (
        <div className="mt-2 border-t border-border pt-2">
          <select
            className="input-field w-full text-xs"
            value={task.status}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => { e.stopPropagation(); onStatusChange(task.id, e.target.value); }}
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

function TaskDetailModal({
  task, customerMap, userMap, canEdit, statuses, onStatusChange, onClose,
}: {
  task: Task;
  customerMap: Record<string, string>;
  userMap: Record<string, string>;
  canEdit: boolean;
  statuses: string[];
  onStatusChange: (status: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-lg border border-border bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${PRIORITY_DOT[task.priority] || 'bg-gray-400'}`} />
              <span className={`text-xs font-semibold uppercase ${PRIORITY_COLORS[task.priority] || ''}`}>{task.priority}</span>
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[task.status] || 'bg-accent'}`}>
                {task.status.replace(/_/g, ' ')}
              </span>
            </div>
            <h3 className="mt-2 text-lg font-semibold">{task.title}</h3>
          </div>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="space-y-3 text-sm">
          {task.description && (
            <div>
              <span className="text-xs font-medium text-muted-foreground">Description</span>
              <p className="mt-0.5">{task.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs font-medium text-muted-foreground">Customer</span>
              <p className="mt-0.5">{customerMap[task.customerId] || 'Unknown'}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground">Assignee</span>
              <p className="mt-0.5">{task.assignedToUserId ? (userMap[task.assignedToUserId] || 'Unknown') : 'Unassigned'}</p>
            </div>
            {task.dueDate && (
              <div>
                <span className="text-xs font-medium text-muted-foreground">Due Date</span>
                <p className="mt-0.5">{new Date(task.dueDate).toLocaleDateString('en-IN')}</p>
              </div>
            )}
            <div>
              <span className="text-xs font-medium text-muted-foreground">Generated By</span>
              <p className="mt-0.5 capitalize">{task.generatedBy}</p>
            </div>
            {task.resolution && (
              <div className="col-span-2">
                <span className="text-xs font-medium text-muted-foreground">Resolution</span>
                <p className="mt-0.5">{task.resolution}</p>
              </div>
            )}
            {task.createdAt && (
              <div>
                <span className="text-xs font-medium text-muted-foreground">Created</span>
                <p className="mt-0.5">{new Date(task.createdAt).toLocaleString('en-IN')}</p>
              </div>
            )}
          </div>

          {canEdit && (
            <div className="border-t border-border pt-3">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Change Status</label>
              <select
                className="input-field"
                value={task.status}
                onChange={(e) => onStatusChange(e.target.value)}
              >
                {statuses.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
