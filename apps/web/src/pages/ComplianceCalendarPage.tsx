import { useEffect, useState, useCallback, useMemo } from 'react';
import { Filter, X, Users, Briefcase, UserCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

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
type ViewMode = 'client' | 'service' | 'staff';

const DATE_TYPE_LABELS: Record<DateType, string> = {
  dueDate: 'Client Due Date',
  staffDueDate: 'Staff Due Date',
  reviewDate: 'Review Date',
  clientDueDate: 'Partner Due Date',
};

const DATE_TYPE_COLORS: Record<DateType, string> = {
  dueDate: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  staffDueDate: 'bg-blue-200 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200',
  reviewDate: 'bg-purple-200 text-purple-900 dark:bg-purple-900/40 dark:text-purple-200',
  clientDueDate: 'bg-orange-200 text-orange-900 dark:bg-orange-900/40 dark:text-orange-200',
};

const TASK_STATUSES = ['unassigned', 'assigned', 'in_progress', 'on_hold', 'review', 'completed', 'cancelled'];

const STATUS_COLORS: Record<string, string> = {
  unassigned: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  assigned: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200',
  on_hold: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
  review: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
};

// Solid status colors used for the tiny dots inside each day-cell group
// (the existing STATUS_COLORS values are background tints with text colour;
// dots need a saturated single-colour swatch).
const STATUS_DOT_COLORS: Record<string, string> = {
  unassigned: 'bg-gray-400',
  assigned: 'bg-blue-500',
  in_progress: 'bg-yellow-500',
  on_hold: 'bg-orange-500',
  review: 'bg-purple-500',
  completed: 'bg-green-500',
  cancelled: 'bg-red-500',
};

const STATUS_LABELS: Record<string, string> = {
  unassigned: 'Unassigned',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  review: 'Review',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

interface CalendarEntry {
  task: CalTask;
  dateType: DateType;
  date: Date;
}

interface GroupModalState {
  day: number;
  groupId: string;
  groupLabel: string;
  entries: CalendarEntry[];
}

export default function ComplianceCalendarPage() {
  const { hasPermission } = useAuth();
  const canSeeAllStaff = hasPermission('task.view_all');

  const [tasks, setTasks] = useState<CalTask[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [services, setServices] = useState<{ id: string; name: string }[]>([]);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [viewMode, setViewMode] = useState<ViewMode>('client');

  // Filters
  const [filterCustomerId, setFilterCustomerId] = useState('');
  const [filterUserId, setFilterUserId] = useState('');
  const [filterServiceId, setFilterServiceId] = useState('');
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [enabledDateTypes, setEnabledDateTypes] = useState<DateType[]>(['dueDate', 'staffDueDate', 'reviewDate', 'clientDueDate']);
  const [showFilters, setShowFilters] = useState(false);
  const [popoverTask, setPopoverTask] = useState<CalendarEntry | null>(null);
  const [groupModal, setGroupModal] = useState<GroupModalState | null>(null);

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
    api<{ id: string; name: string }[]>('/users/lookup').then(setUsers).catch(() => setUsers([]));
    api<{ id: string; name: string }[]>('/services-catalog/lookup').then(setServices).catch(() => setServices([]));
  }, [loadTasks]);

  const [year, mon] = month.split('-').map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const firstDayOfWeek = new Date(year, mon - 1, 1).getDay();

  const customerMap = useMemo(() => Object.fromEntries(customers.map((c) => [c.id, c.name])), [customers]);
  const userMap = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u.name])), [users]);
  const serviceMap = useMemo(() => Object.fromEntries(services.map((s) => [s.id, s.name])), [services]);

  // Apply filters
  const filteredTasks = tasks.filter((t) => {
    if (filterCustomerId && t.customerId !== filterCustomerId) return false;
    if (filterUserId && t.assignedToUserId !== filterUserId) return false;
    if (filterServiceId && t.serviceId !== filterServiceId) return false;
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

  // Group entries per day by viewMode
  const getEntityKey = (entry: CalendarEntry): string => {
    if (viewMode === 'client') return entry.task.customerId || 'unknown';
    if (viewMode === 'service') return entry.task.serviceId || 'no-service';
    return entry.task.assignedToUserId || 'unassigned';
  };

  const getEntityLabel = (id: string): string => {
    if (viewMode === 'client') return customerMap[id] || (id === 'unknown' ? 'Unknown Client' : id);
    if (viewMode === 'service') return id === 'no-service' ? 'No Service' : (serviceMap[id] || id);
    return id === 'unassigned' ? 'Unassigned' : (userMap[id] || id);
  };

  const groupedByDay: Record<number, Record<string, CalendarEntry[]>> = {};
  Object.entries(entriesByDay).forEach(([day, entries]) => {
    const dayNum = Number(day);
    groupedByDay[dayNum] = {};
    entries.forEach((entry) => {
      const key = getEntityKey(entry);
      (groupedByDay[dayNum][key] ??= []).push(entry);
    });
  });

  const prevMonth = () => {
    const d = new Date(year, mon - 2, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const nextMonth = () => {
    const d = new Date(year, mon, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const goToday = () => {
    const t = new Date();
    setMonth(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`);
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
    setFilterServiceId('');
    setFilterStatuses([]);
    setEnabledDateTypes(['dueDate', 'staffDueDate', 'reviewDate', 'clientDueDate']);
  };

  const isOverdue = (entry: CalendarEntry) => {
    return entry.date < now && entry.task.status !== 'completed' && entry.task.status !== 'cancelled';
  };

  const hasOverdueInGroup = (entries: CalendarEntry[]) => entries.some(isOverdue);

  const todayDay = (now.getFullYear() === year && now.getMonth() + 1 === mon) ? now.getDate() : -1;

  // Pill color tone per view mode (subtle differentiation per business context)
  const viewAccent: Record<ViewMode, string> = {
    client: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:ring-emerald-800',
    service: 'bg-indigo-50 text-indigo-800 ring-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-200 dark:ring-indigo-800',
    staff: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:ring-amber-800',
  };

  const VIEW_TABS: { key: ViewMode; label: string; icon: React.ReactNode }[] = [
    { key: 'client', label: 'Client View', icon: <Users className="h-3.5 w-3.5" /> },
    { key: 'service', label: 'Service View', icon: <Briefcase className="h-3.5 w-3.5" /> },
    { key: 'staff', label: 'Staff View', icon: <UserCircle className="h-3.5 w-3.5" /> },
  ];

  const activeFilterCount = (filterCustomerId ? 1 : 0) + (filterUserId ? 1 : 0) + (filterServiceId ? 1 : 0) + (filterStatuses.length > 0 ? 1 : 0) + (enabledDateTypes.length < 4 ? 1 : 0);

  return (
    <section className="space-y-4 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Compliance Calendar</h2>
          <p className="text-xs text-muted-foreground">Plan and track compliance deadlines by client, service, or staff.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${showFilters ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-panel text-muted-foreground hover:bg-accent'}`}
            onClick={() => setShowFilters(!showFilters)}
            aria-pressed={showFilters}
          >
            <Filter className="h-3.5 w-3.5" /> Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{activeFilterCount}</span>
            )}
          </button>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-panel p-0.5">
            <button className="rounded-md p-1.5 text-muted-foreground hover:bg-accent" onClick={prevMonth} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={goToday} className="rounded-md px-2 py-1 text-xs font-medium hover:bg-accent">Today</button>
            <span className="min-w-[110px] px-2 text-center text-sm font-semibold">
              {new Date(year, mon - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </span>
            <button className="rounded-md p-1.5 text-muted-foreground hover:bg-accent" onClick={nextMonth} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Calendar view mode" className="inline-flex rounded-lg border border-border bg-panel p-0.5">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={viewMode === tab.key}
              onClick={() => setViewMode(tab.key)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === tab.key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent'}`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-muted-foreground">
          {viewMode === 'client' && 'Each pill shows a client and their task count for that day.'}
          {viewMode === 'service' && 'Each pill shows a service and how many tasks fall due that day.'}
          {viewMode === 'staff' && 'Each pill shows a staff member and their workload for that day.'}
        </span>
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <div>
              <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Client</label>
              <select className="input-field" value={filterCustomerId} onChange={(e) => setFilterCustomerId(e.target.value)}>
                <option value="">All Clients</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Service</label>
              <select className="input-field" value={filterServiceId} onChange={(e) => setFilterServiceId(e.target.value)}>
                <option value="">All Services</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {canSeeAllStaff && (
              <div>
                <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Staff</label>
                <select className="input-field" value={filterUserId} onChange={(e) => setFilterUserId(e.target.value)}>
                  <option value="">All Staff</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            )}
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
      <div className="panel overflow-hidden p-0">
        <div className="grid grid-cols-7 gap-px bg-border">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="bg-panel p-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{d}</div>
          ))}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-panel/50 p-2 min-h-[110px]" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const groups = groupedByDay[day] || {};
            const groupKeys = Object.keys(groups);
            const isToday = day === todayDay;
            const visibleGroups = groupKeys.slice(0, 4);
            const hiddenCount = groupKeys.length - visibleGroups.length;
            return (
              <div key={day} className={`bg-panel p-2 min-h-[110px] flex flex-col gap-1 ${isToday ? 'ring-2 ring-inset ring-primary/40' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className={`text-[12px] font-semibold ${isToday ? 'flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>{day}</div>
                  {groupKeys.length > 0 && (
                    <span className="text-[9px] font-medium text-muted-foreground/70">{groupKeys.length}</span>
                  )}
                </div>
                <div className="space-y-1">
                  {visibleGroups.map((gKey) => {
                    const entries = groups[gKey];
                    const label = getEntityLabel(gKey);
                    const overdue = hasOverdueInGroup(entries);
                    // Deduplicate statuses present in this group to show as colour dots
                    const uniqStatuses = Array.from(
                      new Set(entries.map((e) => e.task.status)),
                    );
                    const statusTitle = uniqStatuses
                      .map((s) => STATUS_LABELS[s] || s)
                      .join(', ');
                    return (
                      <button
                        key={gKey}
                        onClick={() => setGroupModal({ day, groupId: gKey, groupLabel: label, entries })}
                        className={`group flex w-full items-center justify-between gap-1 rounded-md px-1.5 py-1 text-left text-[10.5px] font-medium ring-1 ring-inset transition-colors hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-primary ${overdue ? 'bg-red-50 text-red-800 ring-red-200 dark:bg-red-900/20 dark:text-red-200 dark:ring-red-800' : viewAccent[viewMode]}`}
                        title={`${label} — ${entries.length} task${entries.length > 1 ? 's' : ''} (${statusTitle})`}
                      >
                        <span className="truncate">{label}</span>
                        <span className="flex shrink-0 items-center gap-0.5">
                          {uniqStatuses.slice(0, 4).map((s) => (
                            <span
                              key={s}
                              className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT_COLORS[s] || 'bg-gray-300'}`}
                              aria-label={STATUS_LABELS[s] || s}
                            />
                          ))}
                          <span className={`ml-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold ${overdue ? 'bg-red-600 text-white' : 'bg-white/80 text-current dark:bg-black/30'}`}>
                            {entries.length}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                  {hiddenCount > 0 && (
                    <button
                      className="w-full rounded px-1.5 py-0.5 text-left text-[10px] text-muted-foreground hover:bg-accent"
                      onClick={() => {
                        // Open first hidden group's modal as quick access; or open a "more" modal
                        const firstHidden = groupKeys[visibleGroups.length];
                        setGroupModal({ day, groupId: firstHidden, groupLabel: getEntityLabel(firstHidden), entries: groups[firstHidden] });
                      }}
                    >
                      +{hiddenCount} more
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend — status dots + date type tints + overdue */}
      <div className="space-y-1.5 rounded-md border border-border bg-panel/60 p-2 text-[11px]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-muted-foreground font-medium">Status:</span>
          {TASK_STATUSES.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_DOT_COLORS[s] || 'bg-gray-300'}`} />
              <span className="capitalize text-foreground">{STATUS_LABELS[s] || s}</span>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground font-medium">Date types:</span>
          {(Object.keys(DATE_TYPE_COLORS) as DateType[]).map((dt) => (
            <span key={dt} className={`rounded px-2 py-0.5 ${DATE_TYPE_COLORS[dt]}`}>{DATE_TYPE_LABELS[dt]}</span>
          ))}
          <span className="rounded px-2 py-0.5 bg-red-200 text-red-900 dark:bg-red-900/40 dark:text-red-200">Overdue</span>
        </div>
      </div>

      {/* Group Modal: tasks for entity on a specific day */}
      {groupModal && (
        <div className="modal-overlay" onClick={() => setGroupModal(null)} role="dialog" aria-modal="true" aria-labelledby="group-modal-title">
          <div className="modal-card modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="min-w-0">
                <span className="modal-eyebrow">
                  {viewMode === 'client' && 'Client'}
                  {viewMode === 'service' && 'Service'}
                  {viewMode === 'staff' && 'Staff'}
                  {' • '}{new Date(year, mon - 1, groupModal.day).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <h3 id="group-modal-title" className="modal-title truncate">{groupModal.groupLabel}</h3>
                <p className="modal-subtitle">{groupModal.entries.length} task{groupModal.entries.length > 1 ? 's' : ''} on this day</p>
              </div>
              <button className="modal-close" onClick={() => setGroupModal(null)} aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="modal-body is-flush">
              <ul className="modal-list">
                {groupModal.entries.map((entry, idx) => {
                  const overdue = isOverdue(entry);
                  const t = entry.task;
                  return (
                    <li key={`${t.id}-${entry.dateType}-${idx}`}>
                      <button
                        onClick={() => { setPopoverTask(entry); setGroupModal(null); }}
                        className="modal-list-item"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-sm font-semibold text-foreground">{t.title}</span>
                            {overdue && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/40 dark:text-red-200">OVERDUE</span>}
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className={`rounded px-1.5 py-0.5 text-[10.5px] font-semibold ${DATE_TYPE_COLORS[entry.dateType]}`}>{DATE_TYPE_LABELS[entry.dateType]}</span>
                            <span className={`rounded px-1.5 py-0.5 text-[10.5px] font-semibold capitalize ${STATUS_COLORS[t.status] || 'bg-accent text-foreground'}`}>{t.status.replace(/_/g, ' ')}</span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-muted-foreground">
                            {viewMode !== 'client' && t.customerId && (
                              <span>Client: <span className="font-semibold text-foreground">{customerMap[t.customerId] || '-'}</span></span>
                            )}
                            {viewMode !== 'service' && t.serviceId && (
                              <span>Service: <span className="font-semibold text-foreground">{serviceMap[t.serviceId] || '-'}</span></span>
                            )}
                            {viewMode !== 'staff' && (
                              <span>Staff: <span className="font-semibold text-foreground">{t.assignedToUserId ? (userMap[t.assignedToUserId] || '-') : 'Unassigned'}</span></span>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Task Detail Popover */}
      {popoverTask && (
        <div className="modal-overlay" style={{ zIndex: 60 }} onClick={() => setPopoverTask(null)} role="dialog" aria-modal="true" aria-labelledby="task-modal-title">
          <div className="modal-card modal-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="min-w-0">
                <span className="modal-eyebrow">Task Details</span>
                <h3 id="task-modal-title" className="modal-title">{popoverTask.task.title}</h3>
              </div>
              <button className="modal-close" onClick={() => setPopoverTask(null)} aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="modal-body">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Client</dt>
                  <dd className="mt-0.5 font-semibold text-foreground">{customerMap[popoverTask.task.customerId] || '-'}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Service</dt>
                  <dd className="mt-0.5 font-semibold text-foreground">{popoverTask.task.serviceId ? (serviceMap[popoverTask.task.serviceId] || '-') : '-'}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Assignee</dt>
                  <dd className="mt-0.5 font-semibold text-foreground">{popoverTask.task.assignedToUserId ? (userMap[popoverTask.task.assignedToUserId] || '-') : 'Unassigned'}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status</dt>
                  <dd className="mt-0.5">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold capitalize ${STATUS_COLORS[popoverTask.task.status] || 'bg-accent text-foreground'}`}>{popoverTask.task.status.replace(/_/g, ' ')}</span>
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Date Type</dt>
                  <dd className="mt-0.5">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${DATE_TYPE_COLORS[popoverTask.dateType]}`}>
                      {DATE_TYPE_LABELS[popoverTask.dateType]}
                    </span>
                  </dd>
                </div>
                {popoverTask.task.dueDate && (
                  <div><dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Due Date</dt><dd className="mt-0.5 font-semibold text-foreground">{new Date(popoverTask.task.dueDate).toLocaleDateString('en-IN')}</dd></div>
                )}
                {popoverTask.task.staffDueDate && (
                  <div><dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Staff Due Date</dt><dd className="mt-0.5 font-semibold text-foreground">{new Date(popoverTask.task.staffDueDate).toLocaleDateString('en-IN')}</dd></div>
                )}
                {popoverTask.task.reviewDate && (
                  <div><dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Review Date</dt><dd className="mt-0.5 font-semibold text-foreground">{new Date(popoverTask.task.reviewDate).toLocaleDateString('en-IN')}</dd></div>
                )}
                {popoverTask.task.clientDueDate && (
                  <div><dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Client Due Date</dt><dd className="mt-0.5 font-semibold text-foreground">{new Date(popoverTask.task.clientDueDate).toLocaleDateString('en-IN')}</dd></div>
                )}
              </dl>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
