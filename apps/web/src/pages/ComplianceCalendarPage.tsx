import { useEffect, useState, useCallback } from 'react';
import { Filter, X } from 'lucide-react';
import { api } from '../lib/api';

interface CalTask {
  id: string;
  title: string;
  customerId: string;
  assignedToUserId?: string;
  serviceId?: string;
  status: string;
  dueDate?: string;
  staffDueDate?: string;
  reviewDate?: string;
  clientDueDate?: string;
}

type DateType = 'dueDate' | 'staffDueDate' | 'reviewDate' | 'clientDueDate';

const DATE_TYPE_LABELS: Record<DateType, string> = {
  dueDate: 'Due Date',
  staffDueDate: 'Staff Due Date',
  reviewDate: 'Review Date',
  clientDueDate: 'Client Due Date',
};

const DATE_TYPE_COLORS: Record<DateType, string> = {
  dueDate: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  staffDueDate: 'bg-blue-200 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200',
  reviewDate: 'bg-purple-200 text-purple-900 dark:bg-purple-900/40 dark:text-purple-200',
  clientDueDate: 'bg-orange-200 text-orange-900 dark:bg-orange-900/40 dark:text-orange-200',
};

const TASK_STATUSES = ['unassigned', 'assigned', 'in_progress', 'on_hold', 'review', 'completed', 'cancelled'];

interface CalendarEntry {
  task: CalTask;
  dateType: DateType;
  date: Date;
}

export default function ComplianceCalendarPage() {
  const [tasks, setTasks] = useState<CalTask[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Filters
  const [filterCustomerId, setFilterCustomerId] = useState('');
  const [filterUserId, setFilterUserId] = useState('');
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [enabledDateTypes, setEnabledDateTypes] = useState<DateType[]>(['dueDate', 'staffDueDate', 'reviewDate', 'clientDueDate']);
  const [showFilters, setShowFilters] = useState(false);
  const [popoverTask, setPopoverTask] = useState<CalendarEntry | null>(null);

  const loadTasks = useCallback(() => {
    const all: CalTask[] = [];
    let cursor: string | undefined;
    const fetchPage = async (): Promise<void> => {
      const url = cursor ? `/tasks?limit=100&cursor=${cursor}` : `/tasks?limit=100`;
      const r = await api<{ data: CalTask[]; nextCursor?: string }>(url);
      all.push(...(r.data || []));
      if (r.nextCursor) { cursor = r.nextCursor; return fetchPage(); }
    };
    fetchPage().then(() => setTasks(all)).catch(() => {});
  }, []);

  useEffect(() => {
    loadTasks();
    api<{ id: string; name: string }[]>('/customers').then(setCustomers).catch(() => {});
    api<{ id: string; name: string }[]>('/users').then(setUsers).catch(() => setUsers([]));
  }, [loadTasks]);

  const [year, mon] = month.split('-').map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const firstDayOfWeek = new Date(year, mon - 1, 1).getDay();

  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c.name]));
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

  // Apply filters
  const filteredTasks = tasks.filter((t) => {
    if (filterCustomerId && t.customerId !== filterCustomerId) return false;
    if (filterUserId && t.assignedToUserId !== filterUserId) return false;
    if (filterStatuses.length > 0 && !filterStatuses.includes(t.status)) return false;
    return true;
  });

  // Build calendar entries
  const now = new Date();
  const entriesByDay: Record<number, CalendarEntry[]> = {};
  filteredTasks.forEach((t) => {
    for (const dt of enabledDateTypes) {
      const val = t[dt];
      if (!val) continue;
      const d = new Date(val);
      if (d.getFullYear() === year && d.getMonth() + 1 === mon) {
        const day = d.getDate();
        (entriesByDay[day] ??= []).push({ task: t, dateType: dt, date: d });
      }
    }
  });

  const prevMonth = () => {
    const d = new Date(year, mon - 2, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const nextMonth = () => {
    const d = new Date(year, mon, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const toggleDateType = (dt: DateType) => {
    setEnabledDateTypes((prev) => prev.includes(dt) ? prev.filter((x) => x !== dt) : [...prev, dt]);
  };

  const toggleStatus = (s: string) => {
    setFilterStatuses((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  };

  const clearFilters = () => {
    setFilterCustomerId('');
    setFilterUserId('');
    setFilterStatuses([]);
    setEnabledDateTypes(['dueDate', 'staffDueDate', 'reviewDate', 'clientDueDate']);
  };

  const isOverdue = (entry: CalendarEntry) => {
    return entry.date < now && entry.task.status !== 'completed' && entry.task.status !== 'cancelled';
  };

  return (
    <section className="space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Compliance Calendar</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button className="primary-button text-xs" style={{ background: showFilters ? 'hsl(var(--accent))' : undefined, color: showFilters ? 'hsl(var(--foreground))' : undefined }} onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4" /> Filters
          </button>
          <button className="icon-button" onClick={prevMonth}>&lt;</button>
          <span className="text-sm font-medium">
            {new Date(year, mon - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </span>
          <button className="icon-button" onClick={nextMonth}>&gt;</button>
        </div>
      </div>

      {/* Filter Bar */}
      {showFilters && (
        <div className="panel space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filters</span>
            <button className="flex items-center gap-1 text-xs text-primary hover:underline" onClick={clearFilters}>
              <X className="h-3 w-3" /> Clear All
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Client</label>
              <select className="input-field" value={filterCustomerId} onChange={(e) => setFilterCustomerId(e.target.value)}>
                <option value="">All Clients</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Staff</label>
              <select className="input-field" value={filterUserId} onChange={(e) => setFilterUserId(e.target.value)}>
                <option value="">All Staff</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Status</label>
              <div className="flex flex-wrap gap-1">
                {TASK_STATUSES.map((s) => (
                  <button key={s} type="button"
                    className={`rounded px-2 py-0.5 text-[10px] font-medium ${filterStatuses.includes(s) ? 'bg-primary text-primary-foreground' : 'bg-accent text-muted-foreground hover:bg-accent/80'}`}
                    onClick={() => toggleStatus(s)}>{s.replace(/_/g, ' ')}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Date Types</label>
              <div className="flex flex-wrap gap-1">
                {(Object.keys(DATE_TYPE_LABELS) as DateType[]).map((dt) => (
                  <button key={dt} type="button"
                    className={`rounded px-2 py-0.5 text-[10px] font-medium ${enabledDateTypes.includes(dt) ? DATE_TYPE_COLORS[dt] : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600'}`}
                    onClick={() => toggleDateType(dt)}>{DATE_TYPE_LABELS[dt]}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Grid */}
      <div className="panel">
        <div className="grid grid-cols-7 gap-px bg-border text-xs">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="bg-panel p-2 text-center font-medium text-muted-foreground">{d}</div>
          ))}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-panel p-2" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayEntries = entriesByDay[day] || [];
            return (
              <div key={day} className="bg-panel p-2 min-h-[80px]">
                <div className="text-[13px] font-medium text-muted-foreground mb-1">{day}</div>
                {dayEntries.map((entry, ei) => {
                  const overdue = isOverdue(entry);
                  return (
                    <div
                      key={`${entry.task.id}-${entry.dateType}-${ei}`}
                      className={`mb-0.5 truncate rounded px-1 py-0.5 text-[10px] cursor-pointer ${overdue ? 'bg-red-200 text-red-900 dark:bg-red-900/40 dark:text-red-200' : DATE_TYPE_COLORS[entry.dateType]}`}
                      title={`${entry.task.title} (${DATE_TYPE_LABELS[entry.dateType]})`}
                      onClick={() => setPopoverTask(entry)}
                    >
                      {entry.task.title}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {(Object.keys(DATE_TYPE_COLORS) as DateType[]).map((dt) => (
          <span key={dt} className={`rounded px-2 py-1 ${DATE_TYPE_COLORS[dt]}`}>{DATE_TYPE_LABELS[dt]}</span>
        ))}
        <span className="rounded px-2 py-1 bg-red-200 text-red-900 dark:bg-red-900/40 dark:text-red-200">Overdue</span>
      </div>

      {/* Task Popover */}
      {popoverTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPopoverTask(null)}>
          <div className="w-full max-w-sm panel space-y-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <h3 className="font-medium">{popoverTask.task.title}</h3>
              <button className="rounded p-1 text-muted-foreground hover:bg-accent" onClick={() => setPopoverTask(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Client</span>
                <p className="font-medium">{customerMap[popoverTask.task.customerId] || '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Assignee</span>
                <p className="font-medium">{popoverTask.task.assignedToUserId ? (userMap[popoverTask.task.assignedToUserId] || '-') : 'Unassigned'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Status</span>
                <p className="font-medium capitalize">{popoverTask.task.status.replace(/_/g, ' ')}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Date Type</span>
                <p className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${DATE_TYPE_COLORS[popoverTask.dateType]}`}>
                  {DATE_TYPE_LABELS[popoverTask.dateType]}
                </p>
              </div>
              {popoverTask.task.dueDate && (
                <div><span className="text-muted-foreground">Due Date</span><p>{new Date(popoverTask.task.dueDate).toLocaleDateString('en-IN')}</p></div>
              )}
              {popoverTask.task.staffDueDate && (
                <div><span className="text-muted-foreground">Staff Due Date</span><p>{new Date(popoverTask.task.staffDueDate).toLocaleDateString('en-IN')}</p></div>
              )}
              {popoverTask.task.reviewDate && (
                <div><span className="text-muted-foreground">Review Date</span><p>{new Date(popoverTask.task.reviewDate).toLocaleDateString('en-IN')}</p></div>
              )}
              {popoverTask.task.clientDueDate && (
                <div><span className="text-muted-foreground">Client Due Date</span><p>{new Date(popoverTask.task.clientDueDate).toLocaleDateString('en-IN')}</p></div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
