import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

/* ── Types ── */
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
  staffDueDate?: string;
  reviewDate?: string;
  clientDueDate?: string;
  generatedBy: string;
  resolution?: string;
  createdAt?: string;
}
interface Comment { id: string; userId: string; body: string; createdAt: string; }
interface Attachment { id: string; fileName: string; fileUrl: string; mimeType: string; sizeBytes: string; tag: string; createdAt: string; uploadedByUserId: string; }
interface TimeLogEntry { id: string; userId: string; startedAt: string; endedAt?: string; durationMinutes?: number; notes?: string; isBillable: boolean; }
interface Subtask { id: string; title: string; description?: string | null; status: string; priority: string; assignedToUserId?: string | null; dueDate?: string | null; }
interface TaskStatusDef { id: string; code: string; label: string; color?: string | null; sortOrder: number; isInitial: boolean; isTerminal: boolean; isSystem: boolean; }
interface AuditEntry { id: string; userId?: string | null; action: string; entityType: string; entityId: string; beforeJson?: Record<string, unknown> | null; afterJson?: Record<string, unknown> | null; createdAt: string; }

/* ── Constants ── */
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
  unassigned: 'border-gray-300 dark:border-gray-600', assigned: 'border-blue-400 dark:border-blue-500',
  in_progress: 'border-amber-400 dark:border-amber-500', on_hold: 'border-orange-400 dark:border-orange-500',
  review: 'border-purple-400 dark:border-purple-500', completed: 'border-green-500 dark:border-green-400',
  cancelled: 'border-red-400 dark:border-red-500',
};
const PRIORITY_DOT: Record<string, string> = { low: 'bg-gray-400', medium: 'bg-blue-500', high: 'bg-orange-500', urgent: 'bg-red-500' };
const PRIORITY_COLORS: Record<string, string> = { low: 'text-gray-500', medium: 'text-blue-600', high: 'text-orange-600', urgent: 'text-red-600 font-bold' };

type ViewMode = 'list' | 'kanban';
type DetailTab = 'details' | 'subtasks' | 'comments' | 'attachments' | 'efforts' | 'history';

// Map color hint (Tailwind fragment or hex) to background+text classes
function colorChipClasses(color?: string | null): string {
  const c = (color || '').toLowerCase();
  const map: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    teal: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
    indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  };
  return map[c] || 'bg-accent text-foreground';
}

function colorBorderClass(color?: string | null): string {
  const c = (color || '').toLowerCase();
  const map: Record<string, string> = {
    gray: 'border-gray-300 dark:border-gray-600',
    blue: 'border-blue-400 dark:border-blue-500',
    amber: 'border-amber-400 dark:border-amber-500',
    orange: 'border-orange-400 dark:border-orange-500',
    purple: 'border-purple-400 dark:border-purple-500',
    green: 'border-green-500 dark:border-green-400',
    red: 'border-red-400 dark:border-red-500',
    teal: 'border-teal-400 dark:border-teal-500',
    indigo: 'border-indigo-400 dark:border-indigo-500',
  };
  return map[c] || 'border-border';
}

/* ── Main Page ── */
export default function TasksPage() {
  const { hasPermission, user } = useAuth();
  const canCreate = hasPermission('task.create');
  const canEdit = hasPermission('task.edit');
  const canViewAll = hasPermission('task.view');
  // Allow commenting/attaching/time-logging if user has specific permission OR general task.edit
  const canComment = hasPermission('task.comment') || hasPermission('task.edit');
  const canAttach = hasPermission('attachment.create') || hasPermission('task.edit');
  const canLogTime = hasPermission('time_log.create') || hasPermission('task.edit');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [services, setServices] = useState<{ id: string; name: string }[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [statuses, setStatuses] = useState<TaskStatusDef[]>([]);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [logTimeFor, setLogTimeFor] = useState<{ task: Task; targetStatus: string } | null>(null);
  const [logTimeForm, setLogTimeForm] = useState({ hours: '', minutes: '', notes: '' });
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('all');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [form, setForm] = useState({ title: '', customerId: '', serviceId: '', priority: 'medium', description: '', assignedToUserId: '', assignedTeamId: '', dueDate: '', staffDueDate: '', reviewDate: '', clientDueDate: '', resolution: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const base = canViewAll ? '/tasks' : '/tasks/my';
    const all: Task[] = [];
    let cursor: string | undefined;
    const fetchPage = async (): Promise<void> => {
      const url = cursor ? `${base}?limit=100&cursor=${cursor}` : `${base}?limit=100`;
      const r = await api<{ data: Task[]; nextCursor?: string }>(url);
      all.push(...(r.data || []));
      if (r.nextCursor) { cursor = r.nextCursor; return fetchPage(); }
    };
    fetchPage().then(() => setTasks(all)).catch(() => {}).finally(() => setLoading(false));
  }, [canViewAll]);

  useEffect(() => {
    load();
    api<{ id: string; name: string }[]>('/customers').then(setCustomers).catch(() => {});
    api<{ id: string; name: string }[]>('/users').then(setUsers).catch(() => setUsers([]));
    api<{ id: string; name: string }[]>('/services-catalog').then(setServices).catch(() => {});
    api<{ id: string; name: string }[]>('/teams').then(setTeams).catch(() => setTeams([]));
    api<TaskStatusDef[]>('/task-statuses').then(setStatuses).catch(() => setStatuses([]));
  }, [load]);

  const resetForm = () => { setForm({ title: '', customerId: '', serviceId: '', priority: 'medium', description: '', assignedToUserId: '', assignedTeamId: '', dueDate: '', staffDueDate: '', reviewDate: '', clientDueDate: '', resolution: '' }); setShowForm(false); setError(''); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try {
      const body: Record<string, unknown> = { title: form.title, customerId: form.customerId, priority: form.priority };
      if (form.serviceId) body.serviceId = form.serviceId;
      if (form.description) body.description = form.description;
      if (form.assignedToUserId) body.assignedToUserId = form.assignedToUserId;
      if (form.assignedTeamId) body.assignedTeamId = form.assignedTeamId;
      if (form.dueDate) body.dueDate = new Date(form.dueDate).toISOString();
      if (form.staffDueDate) body.staffDueDate = new Date(form.staffDueDate).toISOString();
      if (form.reviewDate) body.reviewDate = new Date(form.reviewDate).toISOString();
      if (form.clientDueDate) body.clientDueDate = new Date(form.clientDueDate).toISOString();
      if (form.resolution) body.resolution = form.resolution;
      await api('/tasks', { method: 'POST', body: JSON.stringify(body) });
      resetForm(); load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to create task'); }
  };

  const updateStatus = async (taskId: string, status: string) => {
    try { await api(`/tasks/${taskId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); load(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed'); }
  };

  // Drag-drop status change with time-log gate when moving to a terminal status
  const onCardDragStart = (taskId: string) => (e: React.DragEvent) => {
    setDragTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  };
  const onColumnDragOver = (status: string) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStatus !== status) setDragOverStatus(status);
  };
  const onColumnDragLeave = () => setDragOverStatus(null);
  const onColumnDrop = (status: string) => async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverStatus(null);
    const id = dragTaskId || e.dataTransfer.getData('text/plain');
    setDragTaskId(null);
    if (!id) return;
    const t = tasks.find((x) => x.id === id);
    if (!t || t.status === status) return;
    const target = statuses.find((s) => s.code === status);
    // Time-log gate: if moving to a terminal state and no time logs yet, prompt
    if (target?.isTerminal) {
      try {
        const logs = await api<{ id: string; durationMinutes?: number }[]>(`/time-logs/task/${id}`);
        const total = logs.reduce((s, l) => s + (l.durationMinutes || 0), 0);
        if (total === 0) {
          setLogTimeFor({ task: t, targetStatus: status });
          setLogTimeForm({ hours: '', minutes: '', notes: '' });
          return;
        }
      } catch { /* if time-logs endpoint fails, allow status change */ }
    }
    await updateStatus(id, status);
  };

  const submitLogTimeAndClose = async () => {
    if (!logTimeFor) return;
    const totalMin = (Number(logTimeFor && logTimeForm.hours) || 0) * 60 + (Number(logTimeForm.minutes) || 0);
    if (totalMin <= 0) { alert('Enter time spent (hours / minutes)'); return; }
    try {
      const now = new Date();
      const start = new Date(now.getTime() - totalMin * 60000);
      await api('/time-logs', {
        method: 'POST',
        body: JSON.stringify({
          taskId: logTimeFor.task.id,
          startedAt: start.toISOString(),
          endedAt: now.toISOString(),
          notes: logTimeForm.notes || undefined,
          isBillable: true,
        }),
      });
      await updateStatus(logTimeFor.task.id, logTimeFor.targetStatus);
      setLogTimeFor(null);
      setLogTimeForm({ hours: '', minutes: '', notes: '' });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to log time');
    }
  };

  const skipLogAndClose = async () => {
    if (!logTimeFor) return;
    await updateStatus(logTimeFor.task.id, logTimeFor.targetStatus);
    setLogTimeFor(null);
  };

  const updateResolution = async (taskId: string, resolution: string) => {
    try { await api(`/tasks/${taskId}/resolution`, { method: 'PATCH', body: JSON.stringify({ resolution }) }); load(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed'); }
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm('Delete this task?')) return;
    try { await api(`/tasks/${taskId}`, { method: 'DELETE' }); load(); setSelectedTask(null); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed'); }
  };

  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c.name]));
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));
  const filtered = tasks.filter((t) => {
    if (filter !== 'all' && t.status !== filter) return false;
    if (filterCustomer && t.customerId !== filterCustomer) return false;
    if (filterUser && t.assignedToUserId !== filterUser) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    return true;
  });

  return (
    <section className="space-y-4 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Tasks</h2>
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-muted-foreground">{tasks.length}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-border">
            <button className={`px-3 py-1.5 text-xs ${viewMode === 'kanban' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-accent'} rounded-l-md`} onClick={() => setViewMode('kanban')}>Board</button>
            <button className={`px-3 py-1.5 text-xs ${viewMode === 'list' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-accent'} rounded-r-md`} onClick={() => setViewMode('list')}>List</button>
          </div>
          {canCreate && <button className="primary-button text-sm" onClick={() => showForm ? resetForm() : setShowForm(true)}>{showForm ? 'Cancel' : '+ New Task'}</button>}
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select className="input-field text-xs" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All Status ({tasks.length})</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')} ({tasks.filter((t) => t.status === s).length})</option>)}
        </select>
        <select className="input-field text-xs" value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)}>
          <option value="">All Clients</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input-field text-xs" value={filterUser} onChange={(e) => setFilterUser(e.target.value)}>
          <option value="">All Staff</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select className="input-field text-xs" value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
          <option value="">All Priority</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
        </select>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="panel space-y-3">
          <div className="panel-title">Create New Task</div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div><label className="mb-1 block text-[13px] font-medium text-muted-foreground">Title *</label><input className="input-field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
            <div><label className="mb-1 block text-[13px] font-medium text-muted-foreground">Customer *</label><select className="input-field" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required><option value="">Select...</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label className="mb-1 block text-[13px] font-medium text-muted-foreground">Service</label><select className="input-field" value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })}><option value="">None</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div><label className="mb-1 block text-[13px] font-medium text-muted-foreground">Priority</label><select className="input-field" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}</select></div>
            <div><label className="mb-1 block text-[13px] font-medium text-muted-foreground">Assign to User</label><select className="input-field" value={form.assignedToUserId} onChange={(e) => setForm({ ...form, assignedToUserId: e.target.value })}><option value="">Unassigned</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
            <div><label className="mb-1 block text-[13px] font-medium text-muted-foreground">Assign to Team</label><select className="input-field" value={form.assignedTeamId} onChange={(e) => setForm({ ...form, assignedTeamId: e.target.value })}><option value="">None</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
            <div><label className="mb-1 block text-[13px] font-medium text-muted-foreground">Due Date</label><input type="date" className="input-field" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
            <div><label className="mb-1 block text-[13px] font-medium text-muted-foreground">Staff Due Date</label><input type="date" className="input-field" value={form.staffDueDate} onChange={(e) => setForm({ ...form, staffDueDate: e.target.value })} /></div>
            <div><label className="mb-1 block text-[13px] font-medium text-muted-foreground">Review Date</label><input type="date" className="input-field" value={form.reviewDate} onChange={(e) => setForm({ ...form, reviewDate: e.target.value })} /></div>
            <div><label className="mb-1 block text-[13px] font-medium text-muted-foreground">Client Due Date</label><input type="date" className="input-field" value={form.clientDueDate} onChange={(e) => setForm({ ...form, clientDueDate: e.target.value })} /></div>
          </div>
          <div><label className="mb-1 block text-[13px] font-medium text-muted-foreground">Description</label><textarea className="input-field" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div><label className="mb-1 block text-[13px] font-medium text-muted-foreground">Resolution</label><textarea className="input-field" rows={2} value={form.resolution} onChange={(e) => setForm({ ...form, resolution: e.target.value })} placeholder="Resolution details (optional)" /></div>
          <button type="submit" className="primary-button">Create Task</button>
        </form>
      )}

      {loading && <div className="py-8 text-center text-muted-foreground">Loading tasks...</div>}

      {/* Kanban */}
      {!loading && viewMode === 'kanban' && (
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '60vh' }}>
          {(statuses.length ? statuses : STATUSES.map((s, i) => ({ id: s, code: s, label: s.replace(/_/g, ' '), color: null, sortOrder: i, isInitial: false, isTerminal: s === 'completed' || s === 'cancelled', isSystem: true }))).map((status) => {
            const col = filtered.filter((t) => t.status === status.code);
            const isOver = dragOverStatus === status.code;
            return (
              <div
                key={status.id}
                className={`flex w-72 min-w-[18rem] flex-shrink-0 flex-col rounded-lg bg-accent/30 dark:bg-accent/10 transition-all ${isOver ? 'ring-2 ring-primary scale-[1.01]' : ''}`}
                onDragOver={onColumnDragOver(status.code)}
                onDragLeave={onColumnDragLeave}
                onDrop={onColumnDrop(status.code)}
              >
                <div className={`flex items-center justify-between border-b-2 ${colorBorderClass(status.color)} px-3 py-2.5`}>
                  <span className="text-xs font-semibold uppercase tracking-wide capitalize">{status.label}{status.isTerminal && <span className="ml-1 text-[9px] text-muted-foreground" title="Terminal state — time-log prompt on drop">●</span>}</span>
                  <span className="rounded-full bg-background px-2 py-0.5 text-[13px] font-medium text-muted-foreground">{col.length}</span>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto p-2" style={{ maxHeight: 'calc(60vh - 48px)' }}>
                  {col.map((task) => (
                    <div
                      key={task.id}
                      draggable={canEdit}
                      onDragStart={onCardDragStart(task.id)}
                      onClick={() => setSelectedTask(task)}
                      className={`cursor-pointer rounded-md border border-border bg-background p-3 shadow-sm transition-all hover:shadow-md ${dragTaskId === task.id ? 'opacity-50' : ''}`}
                    >
                      <div className="mb-2 flex items-start justify-between gap-1">
                        <h4 className="text-sm font-medium leading-tight">{task.title}</h4>
                        <span className={`mt-0.5 inline-block h-2 w-2 flex-shrink-0 rounded-full ${PRIORITY_DOT[task.priority] || 'bg-gray-400'}`} title={task.priority} />
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="truncate">{customerMap[task.customerId] || 'Unknown'}</div>
                        {task.assignedToUserId && <div className="truncate font-medium text-foreground">{userMap[task.assignedToUserId] || ''}</div>}
                        {task.dueDate && <div className={task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed' ? 'text-red-600 font-medium' : ''}>Due: {new Date(task.dueDate).toLocaleDateString('en-IN')}</div>}
                      </div>
                    </div>
                  ))}
                  {col.length === 0 && <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">{isOver ? 'Drop here' : 'No tasks'}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List */}
      {!loading && viewMode === 'list' && (
        <div className="space-y-2">
          {filtered.map((task) => (
            <div key={task.id} className="panel flex cursor-pointer flex-col gap-2 transition-colors hover:bg-accent/50 sm:flex-row sm:items-center sm:justify-between" onClick={() => setSelectedTask(task)}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${PRIORITY_DOT[task.priority] || ''}`} />
                  <span className={`text-xs font-semibold uppercase ${PRIORITY_COLORS[task.priority] || ''}`}>{task.priority}</span>
                  <h3 className="truncate text-sm font-medium">{task.title}</h3>
                </div>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>{customerMap[task.customerId] || 'Unknown'}</span>
                  {task.assignedToUserId && <span>Assigned: {userMap[task.assignedToUserId] || ''}</span>}
                  {task.dueDate && <span className={new Date(task.dueDate) < new Date() && task.status !== 'completed' ? 'text-red-600 font-medium' : ''}>Due: {new Date(task.dueDate).toLocaleDateString('en-IN')}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(() => {
                  const sd = statuses.find((s) => s.code === task.status);
                  return <span className={`rounded px-2 py-1 text-xs font-medium ${sd ? colorChipClasses(sd.color) : (STATUS_COLORS[task.status] || 'bg-accent')}`}>{sd?.label || task.status.replace(/_/g, ' ')}</span>;
                })()}
                {canEdit && <select className="input-field text-xs" value={task.status} onClick={(e) => e.stopPropagation()} onChange={(e) => updateStatus(task.id, e.target.value)}>{(statuses.length ? statuses.map((s) => ({ value: s.code, label: s.label })) : STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>}
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="panel py-8 text-center text-muted-foreground">No tasks found</div>}
        </div>
      )}

      {/* Task Detail Panel */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          customerMap={customerMap}
          userMap={userMap}
          users={users}
          canEdit={canEdit}
          canComment={canComment}
          canAttach={canAttach}
          canLogTime={canLogTime}
          currentUserId={user?.id || ''}
          onStatusChange={(s) => { updateStatus(selectedTask.id, s); setSelectedTask({ ...selectedTask, status: s }); }}
          onResolutionChange={(r) => { updateResolution(selectedTask.id, r); setSelectedTask({ ...selectedTask, resolution: r }); }}
          onUpdate={async (fields) => {
            await api(`/tasks/${selectedTask.id}`, { method: 'PATCH', body: JSON.stringify(fields) });
            load();
          }}
          onDelete={async () => {
            if (!confirm('Are you sure you want to delete this task?')) return;
            await api(`/tasks/${selectedTask.id}`, { method: 'DELETE' });
            setSelectedTask(null);
            load();
          }}
          onClose={() => { setSelectedTask(null); load(); }}
        />
      )}

      {/* Log time gate modal — fires when dragging to a terminal status without time logged */}
      {logTimeFor && (
        <div className="modal-overlay" onClick={() => setLogTimeFor(null)} role="dialog" aria-modal="true" aria-labelledby="logtime-title">
          <div className="modal-card modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="modal-eyebrow">Action required</span>
                <h3 id="logtime-title" className="modal-title">Log time before closing?</h3>
                <p className="modal-subtitle">No time has been logged on <span className="font-semibold">{logTimeFor.task.title}</span>. Record the effort spent before moving to <span className="font-semibold">{statuses.find((s) => s.code === logTimeFor.targetStatus)?.label || logTimeFor.targetStatus}</span>.</p>
              </div>
              <button className="modal-close" onClick={() => setLogTimeFor(null)} aria-label="Close">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="modal-body space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Hours</label>
                  <input type="number" min="0" className="input-field" value={logTimeForm.hours} onChange={(e) => setLogTimeForm({ ...logTimeForm, hours: e.target.value })} placeholder="0" />
                </div>
                <div>
                  <label className="field-label">Minutes</label>
                  <input type="number" min="0" max="59" className="input-field" value={logTimeForm.minutes} onChange={(e) => setLogTimeForm({ ...logTimeForm, minutes: e.target.value })} placeholder="30" />
                </div>
              </div>
              <div>
                <label className="field-label">Notes (optional)</label>
                <textarea className="input-field" rows={2} value={logTimeForm.notes} onChange={(e) => setLogTimeForm({ ...logTimeForm, notes: e.target.value })} placeholder="Brief description of work done" />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="secondary-button" onClick={skipLogAndClose}>Skip & Close anyway</button>
              <button type="button" className="primary-button" onClick={submitLogTimeAndClose}>Log Time & Close</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ── Task Detail Panel (modal) ── */
function TaskDetailPanel({
  task, customerMap, userMap, users, canEdit, canComment, canAttach, canLogTime, currentUserId,
  onStatusChange, onResolutionChange, onUpdate, onDelete, onClose,
}: {
  task: Task; customerMap: Record<string, string>; userMap: Record<string, string>;
  users: { id: string; name: string }[];
  canEdit: boolean; canComment: boolean; canAttach: boolean; canLogTime: boolean; currentUserId: string;
  onStatusChange: (s: string) => void; onResolutionChange: (r: string) => void;
  onUpdate: (fields: Record<string, unknown>) => Promise<void>; onDelete: () => Promise<void>; onClose: () => void;
}) {
  const [tab, setTab] = useState<DetailTab>('details');
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLogEntry[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtask, setNewSubtask] = useState({ title: '', assignedToUserId: '', dueDate: '' });
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [commentText, setCommentText] = useState('');
  const [resolution, setResolution] = useState(task.resolution || '');
  const [editingResolution, setEditingResolution] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [editForm, setEditForm] = useState({
    title: task.title,
    description: task.description || '',
    priority: task.priority,
    assignedToUserId: task.assignedToUserId || '',
    dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
    staffDueDate: task.staffDueDate ? task.staffDueDate.slice(0, 10) : '',
    reviewDate: task.reviewDate ? task.reviewDate.slice(0, 10) : '',
    clientDueDate: task.clientDueDate ? task.clientDueDate.slice(0, 10) : '',
  });

  // Attachment form
  const [attachForm, setAttachForm] = useState({ fileName: '', fileUrl: '', tag: 'other' });

  // Time log form
  const [timeForm, setTimeForm] = useState({ hours: '', minutes: '', date: new Date().toISOString().slice(0, 10), notes: '', isBillable: true });
  const [showTimeForm, setShowTimeForm] = useState(false);

  const loadComments = () => api<Comment[]>(`/tasks/${task.id}/comments`).then(setComments).catch(() => {});
  const loadAttachments = () => api<Attachment[]>(`/attachments/task/${task.id}`).then(setAttachments).catch(() => {});
  const loadTimeLogs = () => api<TimeLogEntry[]>(`/time-logs/task/${task.id}`).then(setTimeLogs).catch(() => {});
  const loadSubtasks = () => api<Subtask[]>(`/tasks/${task.id}/subtasks`).then(setSubtasks).catch(() => {});
  const loadHistory = () => api<AuditEntry[]>(`/audit-logs/entity/task/${task.id}`).then(setHistory).catch(() => setHistory([]));

  useEffect(() => {
    loadComments();
    loadAttachments();
    loadTimeLogs();
    loadSubtasks();
    loadHistory();
  }, [task.id]);

  const addSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtask.title.trim()) return;
    try {
      await api(`/tasks/${task.id}/subtasks`, {
        method: 'POST',
        body: JSON.stringify({
          title: newSubtask.title,
          assignedToUserId: newSubtask.assignedToUserId || undefined,
          dueDate: newSubtask.dueDate ? new Date(newSubtask.dueDate).toISOString() : undefined,
        }),
      });
      setNewSubtask({ title: '', assignedToUserId: '', dueDate: '' });
      loadSubtasks();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed');
    }
  };

  const updateSubtaskStatus = async (id: string, status: string) => {
    try {
      await api(`/tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      loadSubtasks();
    } catch {}
  };

  const updateSubtaskField = async (id: string, fields: Record<string, unknown>) => {
    try {
      await api(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(fields) });
      loadSubtasks();
    } catch {}
  };

  const deleteSubtask = async (id: string) => {
    if (!confirm('Delete this subtask?')) return;
    try {
      await api(`/tasks/${id}`, { method: 'DELETE' });
      loadSubtasks();
    } catch {}
  };

  const handleComment = async () => {
    if (!commentText.trim()) return;
    try {
      await api(`/tasks/${task.id}/comments`, { method: 'POST', body: JSON.stringify({ body: commentText }) });
      setCommentText('');
      loadComments();
    } catch {}
  };

  const handleAttach = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api('/attachments', {
        method: 'POST',
        body: JSON.stringify({
          entityType: 'task', entityId: task.id,
          fileName: attachForm.fileName, fileUrl: attachForm.fileUrl,
          mimeType: 'application/octet-stream', sizeBytes: '0', tag: attachForm.tag,
        }),
      });
      setAttachForm({ fileName: '', fileUrl: '', tag: 'other' });
      loadAttachments();
    } catch {}
  };

  const handleAttachFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      try {
        await api('/attachments', {
          method: 'POST',
          body: JSON.stringify({
            entityType: 'task', entityId: task.id,
            fileName: file.name, fileUrl: dataUrl,
            mimeType: file.type || 'application/octet-stream',
            sizeBytes: String(file.size), tag: 'other',
          }),
        });
        loadAttachments();
      } catch {}
    };
    reader.readAsDataURL(file);
  };

  const handleTimeLog = async (e: React.FormEvent) => {
    e.preventDefault();
    const hrs = parseInt(timeForm.hours || '0', 10);
    const mins = parseInt(timeForm.minutes || '0', 10);
    if (hrs === 0 && mins === 0) { alert('Enter duration'); return; }
    const totalMinutes = hrs * 60 + mins;
    // Build start/end from date + duration
    const startDate = new Date(timeForm.date + 'T09:00:00');
    const endDate = new Date(startDate.getTime() + totalMinutes * 60000);
    try {
      await api('/time-logs', {
        method: 'POST',
        body: JSON.stringify({
          taskId: task.id,
          startedAt: startDate.toISOString(),
          endedAt: endDate.toISOString(),
          notes: timeForm.notes || undefined,
          isBillable: timeForm.isBillable,
        }),
      });
      setTimeForm({ hours: '', minutes: '', date: new Date().toISOString().slice(0, 10), notes: '', isBillable: true });
      setShowTimeForm(false);
      loadTimeLogs();
    } catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed'); }
  };

  const saveResolution = () => {
    onResolutionChange(resolution);
    setEditingResolution(false);
  };

  const totalMinutes = timeLogs.reduce((s, t) => s + (t.durationMinutes || 0), 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  const tabs: { key: DetailTab; label: string; count?: number }[] = [
    { key: 'details', label: 'Details' },
    { key: 'subtasks', label: 'Subtasks', count: subtasks.length },
    { key: 'comments', label: 'Discussion', count: comments.length },
    { key: 'attachments', label: 'Attachments', count: attachments.length },
    { key: 'efforts', label: 'Efforts', count: timeLogs.length },
    { key: 'history', label: 'History', count: history.length },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/50" onClick={onClose}>
      <div className="flex h-full w-full max-w-2xl flex-col bg-background shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border p-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${PRIORITY_DOT[task.priority] || ''}`} />
              <span className={`text-xs font-semibold uppercase ${PRIORITY_COLORS[task.priority] || ''}`}>{task.priority}</span>
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[task.status] || 'bg-accent'}`}>{task.status.replace(/_/g, ' ')}</span>
            </div>
            <h3 className="mt-1 text-lg font-semibold">{task.title}</h3>
            <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>{customerMap[task.customerId] || 'Unknown'}</span>
              {task.assignedToUserId && <span>Assigned: {userMap[task.assignedToUserId] || ''}</span>}
              {task.dueDate && <span>Due: {new Date(task.dueDate).toLocaleDateString('en-IN')}</span>}
              {task.createdAt && <span>Created: {new Date(task.createdAt).toLocaleDateString('en-IN')}</span>}
            </div>
          </div>
          <div className="ml-2 flex items-center gap-1">
            {canEdit && (
              <button onClick={onDelete} className="rounded p-1 text-red-500 hover:bg-red-50" title="Delete Task">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" /></svg>
              </button>
            )}
            <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-accent">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors ${tab === t.key ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              {t.label}
              {t.count !== undefined && t.count > 0 && <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px]">{t.count}</span>}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Details Tab */}
          {tab === 'details' && (
            <div className="space-y-4">
              {/* Edit / View Toggle */}
              {canEdit && !editingDetails && (
                <div className="flex justify-end">
                  <button className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-primary hover:bg-accent" onClick={() => setEditingDetails(true)}>
                    Edit Task
                  </button>
                </div>
              )}

              {editingDetails ? (
                /* ── Edit Mode ── */
                <div className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-4">
                  <div>
                    <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Title</label>
                    <input className="input-field" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
                  </div>
                  <div>
                    <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Description</label>
                    <textarea className="input-field" rows={3} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Priority</label>
                      <select className="input-field" value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}>
                        {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Status</label>
                      <select className="input-field" value={task.status} onChange={(e) => onStatusChange(e.target.value)}>
                        {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Assign To</label>
                      <select className="input-field" value={editForm.assignedToUserId} onChange={(e) => setEditForm({ ...editForm, assignedToUserId: e.target.value })}>
                        <option value="">Unassigned</option>
                        {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Due Date</label>
                      <input type="date" className="input-field" value={editForm.dueDate} onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })} />
                    </div>
                    <div>
                      <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Staff Due Date</label>
                      <input type="date" className="input-field" value={editForm.staffDueDate} onChange={(e) => setEditForm({ ...editForm, staffDueDate: e.target.value })} />
                    </div>
                    <div>
                      <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Review Date</label>
                      <input type="date" className="input-field" value={editForm.reviewDate} onChange={(e) => setEditForm({ ...editForm, reviewDate: e.target.value })} />
                    </div>
                    <div>
                      <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Client Due Date</label>
                      <input type="date" className="input-field" value={editForm.clientDueDate} onChange={(e) => setEditForm({ ...editForm, clientDueDate: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button className="primary-button text-xs" onClick={async () => {
                      try {
                        const body: Record<string, unknown> = { title: editForm.title, priority: editForm.priority };
                        if (editForm.description) body.description = editForm.description;
                        if (editForm.assignedToUserId) body.assignedToUserId = editForm.assignedToUserId;
                        if (editForm.dueDate) body.dueDate = new Date(editForm.dueDate).toISOString();
                        if (editForm.staffDueDate) body.staffDueDate = new Date(editForm.staffDueDate).toISOString();
                        if (editForm.reviewDate) body.reviewDate = new Date(editForm.reviewDate).toISOString();
                        if (editForm.clientDueDate) body.clientDueDate = new Date(editForm.clientDueDate).toISOString();
                        await onUpdate(body);
                        setEditingDetails(false);
                      } catch (err: unknown) { alert(err instanceof Error ? err.message : 'Save failed'); }
                    }}>Save Changes</button>
                    <button className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent" onClick={() => setEditingDetails(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                /* ── View Mode ── */
                <>
                  {task.description && (
                    <div><span className="text-[13px] font-medium text-muted-foreground">Description</span><p className="mt-1 text-sm whitespace-pre-wrap rounded-md bg-accent/20 p-2">{task.description}</p></div>
                  )}

                  {/* Resolution */}
                  <div className="rounded-md border border-border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Resolution</span>
                      {canEdit && !editingResolution && (
                        <button className="text-xs text-primary hover:underline" onClick={() => setEditingResolution(true)}>
                          {task.resolution ? 'Edit' : 'Add Resolution'}
                        </button>
                      )}
                    </div>
                    {editingResolution ? (
                      <div className="mt-2 space-y-2">
                        <textarea className="input-field" rows={3} value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Describe the resolution..." />
                        <div className="flex gap-2">
                          <button className="primary-button text-xs" onClick={saveResolution}>Save</button>
                          <button className="text-xs text-muted-foreground hover:underline" onClick={() => { setEditingResolution(false); setResolution(task.resolution || ''); }}>Cancel</button>
                        </div>
                      </div>
                    ) : task.resolution ? (
                      <p className="mt-2 text-sm whitespace-pre-wrap">{task.resolution}</p>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground italic">No resolution yet</p>
                    )}
                  </div>

                  {/* Status (view-only when not editing) */}
                  {canEdit && (
                    <div>
                      <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Quick Status Change</label>
                      <select className="input-field" value={task.status} onChange={(e) => onStatusChange(e.target.value)}>
                        {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Info Grid */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-md border border-border p-2.5">
                      <span className="text-[13px] font-medium text-muted-foreground">Customer</span>
                      <p className="mt-0.5 font-medium">{customerMap[task.customerId] || '-'}</p>
                    </div>
                    <div className="rounded-md border border-border p-2.5">
                      <span className="text-[13px] font-medium text-muted-foreground">Assignee</span>
                      <p className="mt-0.5 font-medium">{task.assignedToUserId ? (userMap[task.assignedToUserId] || '-') : 'Unassigned'}</p>
                    </div>
                    <div className="rounded-md border border-border p-2.5">
                      <span className="text-[13px] font-medium text-muted-foreground">Priority</span>
                      <p className={`mt-0.5 font-medium capitalize ${PRIORITY_COLORS[task.priority] || ''}`}>{task.priority}</p>
                    </div>
                    <div className="rounded-md border border-border p-2.5">
                      <span className="text-[13px] font-medium text-muted-foreground">Total Effort</span>
                      <p className="mt-0.5 font-medium">{totalHours} hrs ({timeLogs.length} entries)</p>
                    </div>
                    <div className="rounded-md border border-border p-2.5">
                      <span className="text-[13px] font-medium text-muted-foreground">Generated By</span>
                      <p className="mt-0.5 font-medium capitalize">{task.generatedBy}</p>
                    </div>
                    {task.dueDate && (
                      <div className="rounded-md border border-border p-2.5">
                        <span className="text-[13px] font-medium text-muted-foreground">Due Date</span>
                        <p className={`mt-0.5 font-medium ${new Date(task.dueDate) < new Date() && task.status !== 'completed' ? 'text-red-600' : ''}`}>
                          {new Date(task.dueDate).toLocaleDateString('en-IN')}
                        </p>
                      </div>
                    )}
                    {task.staffDueDate && (
                      <div className="rounded-md border border-border p-2.5">
                        <span className="text-[13px] font-medium text-muted-foreground">Staff Due Date</span>
                        <p className={`mt-0.5 font-medium ${new Date(task.staffDueDate) < new Date() && task.status !== 'completed' ? 'text-orange-600' : ''}`}>
                          {new Date(task.staffDueDate).toLocaleDateString('en-IN')}
                        </p>
                      </div>
                    )}
                    {task.reviewDate && (
                      <div className="rounded-md border border-border p-2.5">
                        <span className="text-[13px] font-medium text-muted-foreground">Review Date</span>
                        <p className={`mt-0.5 font-medium ${new Date(task.reviewDate) < new Date() && task.status !== 'completed' ? 'text-purple-600' : ''}`}>
                          {new Date(task.reviewDate).toLocaleDateString('en-IN')}
                        </p>
                      </div>
                    )}
                    {task.clientDueDate && (
                      <div className="rounded-md border border-border p-2.5">
                        <span className="text-[13px] font-medium text-muted-foreground">Client Due Date</span>
                        <p className={`mt-0.5 font-medium ${new Date(task.clientDueDate) < new Date() && task.status !== 'completed' ? 'text-red-600' : ''}`}>
                          {new Date(task.clientDueDate).toLocaleDateString('en-IN')}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Subtasks Tab */}
          {tab === 'subtasks' && (
            <div className="space-y-3">
              {/* Progress */}
              {subtasks.length > 0 && (() => {
                const done = subtasks.filter((s) => s.status === 'completed').length;
                const pct = Math.round((done / subtasks.length) * 100);
                return (
                  <div className="rounded-lg border border-border bg-accent/20 p-3">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">Progress</span>
                      <span className="font-mono text-muted-foreground">{done} / {subtasks.length} done · {pct}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                      <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })()}

              {/* Add */}
              {canEdit && (
                <form onSubmit={addSubtask} className="rounded-lg border border-border bg-panel p-3 space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Add Subtask</div>
                  <div className="grid gap-2 sm:grid-cols-12">
                    <input className="input-field sm:col-span-6" placeholder="Subtask title..." value={newSubtask.title} onChange={(e) => setNewSubtask({ ...newSubtask, title: e.target.value })} required />
                    <select className="input-field sm:col-span-3" value={newSubtask.assignedToUserId} onChange={(e) => setNewSubtask({ ...newSubtask, assignedToUserId: e.target.value })}>
                      <option value="">Unassigned</option>
                      {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                    <input type="date" className="input-field sm:col-span-2" value={newSubtask.dueDate} onChange={(e) => setNewSubtask({ ...newSubtask, dueDate: e.target.value })} />
                    <button type="submit" className="primary-button text-xs sm:col-span-1">Add</button>
                  </div>
                </form>
              )}

              {/* List */}
              {subtasks.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-8 text-center">
                  <p className="text-sm font-medium text-foreground">No subtasks yet</p>
                  <p className="mt-1 text-[11.5px] text-muted-foreground">Break this task into smaller steps. Pre-defined templates from Services auto-populate here.</p>
                </div>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                  {subtasks.map((s) => {
                    const done = s.status === 'completed';
                    return (
                      <li key={s.id} className={`flex items-start gap-3 p-3 transition-colors ${done ? 'bg-green-50/50 dark:bg-green-900/10' : 'hover:bg-accent/30'}`}>
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 cursor-pointer accent-current"
                          checked={done}
                          disabled={!canEdit}
                          onChange={() => updateSubtaskStatus(s.id, done ? 'in_progress' : 'completed')}
                        />
                        <div className="min-w-0 flex-1">
                          <div className={`text-sm font-medium ${done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{s.title}</div>
                          {s.description && <p className="mt-0.5 text-[11.5px] text-muted-foreground whitespace-pre-wrap">{s.description}</p>}
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                            <span className={`rounded px-1.5 py-0.5 font-semibold ${STATUS_COLORS[s.status] || 'bg-accent text-foreground'}`}>{s.status.replace(/_/g, ' ')}</span>
                            <span className={`rounded px-1.5 py-0.5 font-semibold capitalize ${PRIORITY_COLORS[s.priority] || ''} bg-accent`}>{s.priority}</span>
                            {canEdit ? (
                              <select className="rounded border border-border bg-panel px-1 py-0.5 text-[11px]" value={s.assignedToUserId || ''} onChange={(e) => updateSubtaskField(s.id, { assignedToUserId: e.target.value || null })}>
                                <option value="">Unassigned</option>
                                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                              </select>
                            ) : (
                              <span className="text-muted-foreground">{s.assignedToUserId ? userMap[s.assignedToUserId] : 'Unassigned'}</span>
                            )}
                            {s.dueDate && <span className="text-muted-foreground">Due {new Date(s.dueDate).toLocaleDateString('en-IN')}</span>}
                          </div>
                        </div>
                        {canEdit && (
                          <button onClick={() => deleteSubtask(s.id)} className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20" title="Delete subtask">
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" /></svg>
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {/* Comments/Discussion Tab */}
          {tab === 'comments' && (
            <div className="space-y-4">
              {/* Comment Input */}
              {canComment && (
                <div className="space-y-2">
                  <textarea className="input-field" rows={3} value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Write a comment or update..." />
                  <button className="primary-button text-xs" disabled={!commentText.trim()} onClick={handleComment}>Post Comment</button>
                </div>
              )}

              {/* Comments List */}
              <div className="space-y-3">
                {comments.map((c) => (
                  <div key={c.id} className="rounded-md border border-border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">{userMap[c.userId] || 'Unknown'}</span>
                      <span className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleString('en-IN')}</span>
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{c.body}</p>
                  </div>
                ))}
                {comments.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">No comments yet. Start a discussion!</p>}
              </div>
            </div>
          )}

          {/* Attachments Tab */}
          {tab === 'attachments' && (
            <div className="space-y-4">
              {canAttach && (
                <div className="space-y-4">
                  {/* File Upload - prominent button */}
                  <div className="flex items-center gap-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
                      Upload File
                      <input type="file" className="hidden" onChange={handleAttachFile} />
                    </label>
                    <span className="text-xs text-muted-foreground">or add a link below</span>
                  </div>

                  {/* URL Attachment - proper labeled form */}
                  <form onSubmit={handleAttach} className="rounded-md border border-border p-3 space-y-3">
                    <div className="text-[13px] font-medium text-muted-foreground mb-2">Attach Link / URL</div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">File Name *</label>
                        <input className="input-field" placeholder="e.g. ITR Form 26AS" value={attachForm.fileName} onChange={(e) => setAttachForm({ ...attachForm, fileName: e.target.value })} required />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Category</label>
                        <select className="input-field" value={attachForm.tag} onChange={(e) => setAttachForm({ ...attachForm, tag: e.target.value })}>
                          <option value="evidence">Evidence</option>
                          <option value="proposal">Proposal</option>
                          <option value="signed_doc">Signed Doc</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">URL *</label>
                      <input className="input-field" placeholder="https://drive.google.com/..." value={attachForm.fileUrl} onChange={(e) => setAttachForm({ ...attachForm, fileUrl: e.target.value })} required />
                    </div>
                    <button type="submit" className="primary-button text-xs">Add Link</button>
                  </form>
                </div>
              )}

              {/* Attachments List */}
              <div className="space-y-2">
                {attachments.length > 0 && <div className="text-[13px] font-medium text-muted-foreground">{attachments.length} attachment{attachments.length !== 1 ? 's' : ''}</div>}
                {attachments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-md border border-border p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <svg className="h-4 w-4 flex-shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14,2 14,8 20,8" /></svg>
                        <span className="truncate text-sm font-medium">{a.fileName}</span>
                        <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">{a.tag}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {userMap[a.uploadedByUserId] || ''} · {new Date(a.createdAt).toLocaleDateString('en-IN')}
                        {Number(a.sizeBytes) > 0 && ` · ${(Number(a.sizeBytes) / 1024).toFixed(1)} KB`}
                      </div>
                    </div>
                    {a.fileUrl && (
                      <div className="ml-2 flex items-center gap-1">
                        <button
                          className="rounded-md border border-border px-2 py-1 text-xs text-primary hover:bg-accent"
                          onClick={(e) => { e.stopPropagation(); setPreviewAttachment(a); }}
                          title="Preview in app"
                        >
                          View
                        </button>
                        <a
                          href={a.fileUrl}
                          download={a.fileName}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {a.fileUrl.startsWith('data:') ? 'Download' : 'Open'}
                        </a>
                      </div>
                    )}
                  </div>
                ))}
                {attachments.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">No attachments yet</p>}
              </div>
            </div>
          )}

          {/* Efforts / Time Logs Tab */}
          {tab === 'efforts' && (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-md border border-border p-3 text-center">
                  <p className="text-2xl font-bold text-primary">{totalHours}</p>
                  <p className="text-xs text-muted-foreground">Total Hours</p>
                </div>
                <div className="rounded-md border border-border p-3 text-center">
                  <p className="text-2xl font-bold">{timeLogs.length}</p>
                  <p className="text-xs text-muted-foreground">Entries</p>
                </div>
                <div className="rounded-md border border-border p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{timeLogs.filter((t) => t.isBillable).length}</p>
                  <p className="text-xs text-muted-foreground">Billable</p>
                </div>
              </div>

              {/* Log Time Form */}
              {canLogTime && (
                <>
                  {!showTimeForm ? (
                    <button className="primary-button text-xs w-full" onClick={() => setShowTimeForm(true)}>+ Log Time Entry</button>
                  ) : (
                    <form onSubmit={handleTimeLog} className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-4">
                      <div className="text-xs font-semibold text-foreground">Log Time</div>
                      <div className="grid gap-3 grid-cols-3">
                        <div>
                          <label className="mb-1 block text-xs text-muted-foreground">Date *</label>
                          <input type="date" className="input-field" value={timeForm.date} onChange={(e) => setTimeForm({ ...timeForm, date: e.target.value })} required />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-muted-foreground">Hours</label>
                          <input type="number" min="0" max="23" className="input-field" placeholder="0" value={timeForm.hours} onChange={(e) => setTimeForm({ ...timeForm, hours: e.target.value })} />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-muted-foreground">Minutes</label>
                          <input type="number" min="0" max="59" className="input-field" placeholder="0" value={timeForm.minutes} onChange={(e) => setTimeForm({ ...timeForm, minutes: e.target.value })} />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Work Description</label>
                        <input className="input-field" value={timeForm.notes} onChange={(e) => setTimeForm({ ...timeForm, notes: e.target.value })} placeholder="e.g. Reviewed ITR documents, prepared filing summary" />
                      </div>
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input type="checkbox" className="rounded" checked={timeForm.isBillable} onChange={(e) => setTimeForm({ ...timeForm, isBillable: e.target.checked })} />
                        Billable to client
                      </label>
                      <div className="flex gap-2">
                        <button type="submit" className="primary-button text-xs">Save Entry</button>
                        <button type="button" className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent" onClick={() => setShowTimeForm(false)}>Cancel</button>
                      </div>
                    </form>
                  )}
                </>
              )}

              {/* Time Logs List */}
              <div className="space-y-2">
                {timeLogs.length > 0 && <div className="text-[13px] font-medium text-muted-foreground">Time Entries</div>}
                {timeLogs.map((tl) => {
                  const dur = tl.durationMinutes ? `${Math.floor(tl.durationMinutes / 60)}h ${tl.durationMinutes % 60}m` : '—';
                  return (
                    <div key={tl.id} className="flex items-center justify-between rounded-md border border-border p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <span>{userMap[tl.userId] || 'Unknown'}</span>
                          {tl.isBillable && <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] text-green-700 dark:bg-green-900/30 dark:text-green-300">Billable</span>}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {new Date(tl.startedAt).toLocaleDateString('en-IN')}
                        </div>
                        {tl.notes && <p className="mt-1 text-xs text-muted-foreground italic">{tl.notes}</p>}
                      </div>
                      <span className="ml-2 rounded-md bg-accent px-3 py-1.5 text-sm font-bold">{dur}</span>
                    </div>
                  );
                })}
                {timeLogs.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">No time entries logged yet</p>}
              </div>
            </div>
          )}

          {/* History Tab */}
          {tab === 'history' && (
            <div className="space-y-3">
              {history.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">No activity yet for this task.</p>
              ) : (
                <ol className="relative ml-2 border-l border-border">
                  {history.map((h) => {
                    const actionLabel: Record<string, string> = {
                      'task.created': 'Created task',
                      'task.updated': 'Updated task',
                      'task.status_changed': 'Status changed',
                      'task.resolution_added': 'Resolution updated',
                      'task.deleted': 'Deleted task',
                    };
                    const actorName = h.userId ? (userMap[h.userId] || 'Someone') : 'System';
                    // Compute diff display
                    const before = (h.beforeJson || {}) as Record<string, unknown>;
                    const after = (h.afterJson || {}) as Record<string, unknown>;
                    const fields = new Set([...Object.keys(before), ...Object.keys(after)]);
                    const diffs: { field: string; from: unknown; to: unknown }[] = [];
                    fields.forEach((f) => {
                      const b = before[f]; const a = after[f];
                      if (JSON.stringify(b) !== JSON.stringify(a)) diffs.push({ field: f, from: b, to: a });
                    });
                    const renderVal = (v: unknown) => {
                      if (v === null || v === undefined || v === '') return <em className="text-muted-foreground">empty</em>;
                      if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleString('en-IN');
                      if (typeof v === 'string' && userMap[v]) return userMap[v];
                      return String(v);
                    };
                    return (
                      <li key={h.id} className="mb-4 ml-4">
                        <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-primary bg-background" />
                        <div className="rounded-lg border border-border bg-panel p-3">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <div className="text-sm">
                              <span className="font-semibold text-foreground">{actorName}</span>
                              <span className="ml-1 text-muted-foreground">— {actionLabel[h.action] || h.action}</span>
                            </div>
                            <span className="text-[10.5px] text-muted-foreground">{new Date(h.createdAt).toLocaleString('en-IN')}</span>
                          </div>
                          {diffs.length > 0 && (
                            <ul className="mt-2 space-y-0.5 text-[11.5px]">
                              {diffs.map((d) => (
                                <li key={d.field} className="text-muted-foreground">
                                  <span className="font-medium text-foreground capitalize">{d.field.replace(/([A-Z])/g, ' $1')}:</span>{' '}
                                  {renderVal(d.from)} <span className="text-muted-foreground/60">→</span> <span className="font-medium text-foreground">{renderVal(d.to)}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Attachment preview modal */}
      {previewAttachment && (
        <AttachmentPreview attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />
      )}
    </div>
  );
}

// ── Attachment preview component ─────────────────────────────────────────────
function AttachmentPreview({ attachment, onClose }: { attachment: Attachment; onClose: () => void }) {
  const url = attachment.fileUrl;
  const mime = (attachment.mimeType || '').toLowerCase();
  const ext = (attachment.fileName.split('.').pop() || '').toLowerCase();
  const isImage = mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
  const isPdf = mime === 'application/pdf' || ext === 'pdf';
  const isOffice = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext) || mime.includes('officedocument') || mime.includes('msword') || mime.includes('excel');
  const isText = mime.startsWith('text/') || ['txt', 'csv', 'log', 'md', 'json', 'xml'].includes(ext);
  const isDataUrl = url.startsWith('data:');
  const officeViewerUrl = !isDataUrl && isOffice
    ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`
    : null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card modal-xl" onClick={(e) => e.stopPropagation()} style={{ height: 'calc(100dvh - 64px)' }}>
        <div className="modal-header">
          <div className="min-w-0">
            <span className="modal-eyebrow">Attachment</span>
            <h3 className="modal-title truncate">{attachment.fileName}</h3>
            <p className="modal-subtitle">{attachment.mimeType || 'unknown type'} · {Number(attachment.sizeBytes) > 0 ? `${(Number(attachment.sizeBytes) / 1024).toFixed(1)} KB` : 'size unknown'}</p>
          </div>
          <div className="flex items-center gap-2">
            <a href={url} download={attachment.fileName} className="secondary-button text-xs">Download</a>
            <button className="modal-close" onClick={onClose} aria-label="Close">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        <div className="modal-body is-flush" style={{ padding: 0 }}>
          {isImage && (
            <div className="flex h-full items-center justify-center bg-black/80 p-4">
              <img src={url} alt={attachment.fileName} className="max-h-full max-w-full object-contain" />
            </div>
          )}
          {isPdf && (
            <iframe title={attachment.fileName} src={url} className="h-full w-full border-0" />
          )}
          {isText && !isImage && !isPdf && (
            <div className="h-full overflow-auto bg-background p-4">
              <iframe title={attachment.fileName} src={url} className="h-full w-full border-0 bg-white" />
            </div>
          )}
          {isOffice && officeViewerUrl && (
            <iframe title={attachment.fileName} src={officeViewerUrl} className="h-full w-full border-0" />
          )}
          {isOffice && !officeViewerUrl && (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-12 text-center">
              <p className="text-sm font-medium text-foreground">Office documents (DOC / XLS / PPT) cannot be previewed when uploaded as inline files.</p>
              <p className="max-w-md text-[12px] text-muted-foreground">Upload the file to a public URL (e.g. cloud storage) so the Microsoft Office viewer can render it, or download below to open in your local app.</p>
              <a href={url} download={attachment.fileName} className="primary-button text-xs">Download File</a>
            </div>
          )}
          {!isImage && !isPdf && !isOffice && !isText && (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-12 text-center">
              <p className="text-sm font-medium text-foreground">No inline preview available for this file type.</p>
              <a href={url} download={attachment.fileName} className="primary-button text-xs">Download File</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
