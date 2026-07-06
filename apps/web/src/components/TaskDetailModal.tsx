import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, CalendarClock, ClipboardList, ExternalLink, Flag, User, X,
} from 'lucide-react';
import { api } from '../lib/api';
import { useUiStore } from '../lib/ui-store';

interface TaskDetail {
  id: string;
  title: string;
  description?: string | null;
  priority: string;
  status: string;
  customerId: string;
  assignedToUserId?: string | null;
  assignedTeamId?: string | null;
  dueDate?: string | null;
  staffDueDate?: string | null;
  reviewDate?: string | null;
  clientDueDate?: string | null;
  resolution?: string | null;
  reviewComments?: string | null;
  createdAt?: string | null;
  parentTaskId?: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  unassigned: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  assigned: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  on_hold: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  review: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};
const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-gray-500',
  medium: 'text-blue-600',
  high: 'text-amber-600',
  urgent: 'text-red-600',
};

function fmtDate(d?: string | null) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function humanize(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function TaskDetailModal() {
  const taskId = useUiStore((s) => s.taskDetailId);
  const closeTask = useUiStore((s) => s.closeTask);
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const usersFetched = useRef(false);
  const [customerName, setCustomerName] = useState<string>('');

  // Close on Escape for keyboard accessibility.
  useEffect(() => {
    if (!taskId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeTask(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [taskId, closeTask]);

  useEffect(() => {
    if (!taskId) { setTask(null); setError(''); return; }
    let cancelled = false;
    setLoading(true);
    setError('');
    setCustomerName('');
    api<TaskDetail>(`/tasks/${taskId}`)
      .then(async (t) => {
        if (cancelled) return;
        setTask(t);
        // Best-effort name resolution — never block the modal on these.
        if (t.customerId) {
          api<{ name: string }>(`/customers/${t.customerId}`)
            .then((c) => { if (!cancelled) setCustomerName(c.name); })
            .catch(() => {});
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load task');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [taskId]);

  // Resolve assignee names once (small lookup, cached across opens). Guarded by
  // a ref so an empty-array response can't retrigger the effect into a loop.
  useEffect(() => {
    if (!taskId || usersFetched.current) return;
    usersFetched.current = true;
    api<{ id: string; name: string }[]>('/users/lookup')
      .then((u) => setUserMap(Object.fromEntries(u.map((x) => [x.id, x.name]))))
      .catch(() => { usersFetched.current = false; });
  }, [taskId]);

  if (!taskId) return null;

  const assignee = task?.assignedToUserId ? (userMap[task.assignedToUserId] || 'Assigned user') : 'Unassigned';

  return (
    <div className="modal-overlay" onClick={closeTask} role="dialog" aria-modal="true" aria-labelledby="task-detail-title">
      <div className="modal-card modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="min-w-0">
            <span className="modal-eyebrow">Task</span>
            <h3 id="task-detail-title" className="modal-title break-words">
              {loading ? 'Loading…' : task?.title || 'Task'}
            </h3>
            {task && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[task.status] || 'bg-accent'}`}>
                  {humanize(task.status)}
                </span>
                <span className={`inline-flex items-center gap-1 text-xs font-semibold ${PRIORITY_COLORS[task.priority] || 'text-muted-foreground'}`}>
                  <Flag className="h-3 w-3" />{humanize(task.priority)}
                </span>
                {task.parentTaskId && (
                  <span className="rounded bg-accent px-2 py-0.5 text-[11px] text-muted-foreground">Subtask</span>
                )}
              </div>
            )}
          </div>
          <button type="button" className="modal-close" onClick={closeTask} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="modal-body space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}
          {loading && !task && (
            <div className="flex items-center justify-center py-10">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
          {task && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Detail icon={<Building2 />} label="Customer" value={customerName || task.customerId} />
                <Detail icon={<User />} label="Assignee" value={assignee} />
                <Detail icon={<CalendarClock />} label="Due Date" value={fmtDate(task.dueDate)} />
                <Detail icon={<CalendarClock />} label="Staff Due" value={fmtDate(task.staffDueDate)} />
                <Detail icon={<CalendarClock />} label="Review Date" value={fmtDate(task.reviewDate)} />
                <Detail icon={<CalendarClock />} label="Client Due" value={fmtDate(task.clientDueDate)} />
              </div>

              <Section title="Description">
                {task.description ? (
                  <p className="whitespace-pre-wrap text-sm text-foreground">{task.description}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">No description provided.</p>
                )}
              </Section>

              {task.resolution && (
                <Section title="Resolution">
                  <p className="whitespace-pre-wrap text-sm text-foreground">{task.resolution}</p>
                </Section>
              )}
              {task.reviewComments && (
                <Section title="Review Comments">
                  <p className="whitespace-pre-wrap text-sm text-foreground">{task.reviewComments}</p>
                </Section>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="secondary-button" onClick={closeTask}>Close</button>
          {task && (
            <Link
              to={`/tasks?task=${task.id}`}
              onClick={closeTask}
              className="primary-button"
            >
              <ClipboardList className="h-4 w-4" /> Open in Tasks <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/60 text-muted-foreground">
        {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'h-3.5 w-3.5' })}
      </span>
      <div className="min-w-0">
        <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium" title={value}>{value}</p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}
