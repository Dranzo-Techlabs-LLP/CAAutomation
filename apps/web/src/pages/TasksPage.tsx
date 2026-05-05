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
type DetailTab = 'details' | 'comments' | 'attachments' | 'efforts';

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
          {STATUSES.map((status) => {
            const col = tasks.filter((t) => t.status === status);
            return (
              <div key={status} className="flex w-72 min-w-[18rem] flex-shrink-0 flex-col rounded-lg bg-accent/30 dark:bg-accent/10">
                <div className={`flex items-center justify-between border-b-2 ${STATUS_HEADER_COLORS[status] || ''} px-3 py-2.5`}>
                  <span className="text-xs font-semibold uppercase tracking-wide">{status.replace(/_/g, ' ')}</span>
                  <span className="rounded-full bg-background px-2 py-0.5 text-[13px] font-medium text-muted-foreground">{col.length}</span>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto p-2" style={{ maxHeight: 'calc(60vh - 48px)' }}>
                  {col.map((task) => (
                    <div key={task.id} className="cursor-pointer rounded-md border border-border bg-background p-3 shadow-sm transition-all hover:shadow-md" onClick={() => setSelectedTask(task)}>
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
                  {col.length === 0 && <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No tasks</div>}
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
                <span className={`rounded px-2 py-1 text-xs font-medium ${STATUS_COLORS[task.status] || 'bg-accent'}`}>{task.status.replace(/_/g, ' ')}</span>
                {canEdit && <select className="input-field text-xs" value={task.status} onClick={(e) => e.stopPropagation()} onChange={(e) => updateStatus(task.id, e.target.value)}>{STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}</select>}
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

  useEffect(() => {
    loadComments();
    loadAttachments();
    loadTimeLogs();
  }, [task.id]);

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
    { key: 'comments', label: 'Discussion', count: comments.length },
    { key: 'attachments', label: 'Attachments', count: attachments.length },
    { key: 'efforts', label: 'Efforts', count: timeLogs.length },
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
                      <a href={a.fileUrl} target="_blank" rel="noopener noreferrer" className="ml-2 rounded-md border border-border px-2 py-1 text-xs text-primary hover:bg-accent" onClick={(e) => e.stopPropagation()}>
                        {a.fileUrl.startsWith('data:') ? 'Download' : 'Open'}
                      </a>
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
        </div>
      </div>
    </div>
  );
}
