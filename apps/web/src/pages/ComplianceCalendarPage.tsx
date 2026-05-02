import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface CalTask {
  id: string;
  title: string;
  customerId: string;
  serviceId?: string;
  status: string;
  dueDate?: string;
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-200 text-green-900 dark:bg-green-900/40 dark:text-green-200',
  in_progress: 'bg-amber-200 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  assigned: 'bg-blue-200 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200',
  review: 'bg-purple-200 text-purple-900 dark:bg-purple-900/40 dark:text-purple-200',
  unassigned: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  overdue: 'bg-red-200 text-red-900 dark:bg-red-900/40 dark:text-red-200',
};

export default function ComplianceCalendarPage() {
  const [tasks, setTasks] = useState<CalTask[]>([]);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    api<CalTask[]>('/dashboards/compliance-calendar').then(setTasks).catch(() => {});
  }, []);

  const [year, mon] = month.split('-').map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const firstDayOfWeek = new Date(year, mon - 1, 1).getDay();

  const tasksByDay: Record<number, CalTask[]> = {};
  tasks.forEach((t) => {
    if (!t.dueDate) return;
    const d = new Date(t.dueDate);
    if (d.getFullYear() === year && d.getMonth() + 1 === mon) {
      const day = d.getDate();
      (tasksByDay[day] ??= []).push(t);
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

  return (
    <section className="space-y-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Compliance Calendar</h2>
        <div className="flex items-center gap-2">
          <button className="icon-button" onClick={prevMonth}>&lt;</button>
          <span className="text-sm font-medium">
            {new Date(year, mon - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </span>
          <button className="icon-button" onClick={nextMonth}>&gt;</button>
        </div>
      </div>

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
            const dayTasks = tasksByDay[day] || [];
            return (
              <div key={day} className="bg-panel p-2 min-h-[80px]">
                <div className="text-xs font-medium text-muted-foreground mb-1">{day}</div>
                {dayTasks.map((t) => (
                  <div key={t.id} className={`mb-0.5 truncate rounded px-1 py-0.5 text-[10px] ${STATUS_COLORS[t.status] || 'bg-accent'}`} title={t.title}>
                    {t.title}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(STATUS_COLORS).map(([status, cls]) => (
          <span key={status} className={`rounded px-2 py-1 ${cls}`}>{status.replace(/_/g, ' ')}</span>
        ))}
      </div>
    </section>
  );
}
