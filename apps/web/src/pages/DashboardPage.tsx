import React, { useEffect, useState } from 'react';
import { TrendingUp, Clock, AlertTriangle, FileText, CheckCircle, BarChart3 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface PartnerData {
  revenue: number;
  wip: number;
  overdueTasks: number;
  invoiceCount: number;
}
interface ManagerData {
  openTasks: number;
  pendingReviews: number;
  upcomingRecurrences: number;
}
interface AssociateData {
  myOpenTasks: number;
  myOverdueTasks: number;
  myHours: number;
}

function formatPaise(paise: number) {
  const rupees = paise / 100;
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(1)}L`;
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1)}K`;
  return `₹${rupees.toFixed(0)}`;
}

export default function DashboardPage() {
  const { hasPermission } = useAuth();
  const isPartner = hasPermission('dashboard.partner');
  const isManager = hasPermission('dashboard.manager');

  const [partner, setPartner] = useState<PartnerData | null>(null);
  const [manager, setManager] = useState<ManagerData | null>(null);
  const [associate, setAssociate] = useState<AssociateData | null>(null);
  const [tasks, setTasks] = useState<{ status: string }[]>([]);

  useEffect(() => {
    if (isPartner) {
      api<PartnerData>('/dashboards/partner').then(setPartner).catch(() => {});
    }
    if (isManager) {
      api<ManagerData>('/dashboards/manager').then(setManager).catch(() => {});
    }
    if (!isPartner && !isManager) {
      api<AssociateData>('/dashboards/associate').then(setAssociate).catch(() => {});
    }
    const base = isPartner || isManager ? '/tasks' : '/tasks/my';
    const all: { status: string }[] = [];
    const fetchPage = (cursor?: string): Promise<void> => {
      const url = cursor ? `${base}?limit=100&cursor=${cursor}` : `${base}?limit=100`;
      return api<{ data: { status: string }[]; nextCursor?: string }>(url).then((r) => {
        all.push(...(r.data || []));
        if (r.nextCursor) return fetchPage(r.nextCursor);
      });
    };
    fetchPage().then(() => setTasks(all)).catch(() => {});
  }, [isPartner, isManager]);

  const statusCounts = tasks.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {});

  const workloadData = Object.entries(statusCounts).map(([name, count]) => ({
    name: name.replace(/_/g, ' '),
    count,
  }));

  return (
    <section className="space-y-6 p-4 lg:p-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isPartner && partner && (
          <>
            <KpiCard label="Revenue" value={formatPaise(partner.revenue)} icon={<TrendingUp />} color="emerald" />
            <KpiCard label="WIP Tasks" value={String(partner.wip)} icon={<Clock />} color="blue" />
            <KpiCard label="Overdue Tasks" value={String(partner.overdueTasks)} icon={<AlertTriangle />} color="red" />
            <KpiCard label="Invoices" value={String(partner.invoiceCount)} icon={<FileText />} color="amber" />
          </>
        )}
        {!isPartner && isManager && manager && (
          <>
            <KpiCard label="Open Tasks" value={String(manager.openTasks)} icon={<Clock />} color="blue" />
            <KpiCard label="Pending Reviews" value={String(manager.pendingReviews)} icon={<AlertTriangle />} color="amber" />
            <KpiCard label="Upcoming Recurrences" value={String(manager.upcomingRecurrences)} icon={<CheckCircle />} color="emerald" />
          </>
        )}
        {!isPartner && !isManager && associate && (
          <>
            <KpiCard label="My Open Tasks" value={String(associate.myOpenTasks)} icon={<Clock />} color="blue" />
            <KpiCard label="My Overdue" value={String(associate.myOverdueTasks)} icon={<AlertTriangle />} color="red" />
            <KpiCard label="My Hours" value={String(associate.myHours)} icon={<BarChart3 />} color="emerald" />
          </>
        )}
      </div>

      {workloadData.length > 0 && (
        <div className="panel">
          <div className="panel-title">{isPartner || isManager ? 'Task Distribution by Status' : 'My Tasks by Status'}</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workloadData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--panel))',
                    boxShadow: 'var(--shadow-md)',
                    fontSize: '13px',
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {workloadData.length === 0 && (
        <div className="panel flex flex-col items-center justify-center py-16 text-center">
          <BarChart3 className="mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">No task data yet</p>
          <p className="mt-1 text-xs text-muted-foreground/70">Create tasks to see your workload distribution</p>
        </div>
      )}
    </section>
  );
}

const COLOR_MAP: Record<string, { bg: string; icon: string; text: string }> = {
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: 'text-emerald-600 dark:text-emerald-400', text: 'text-emerald-700 dark:text-emerald-300' },
  blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', icon: 'text-blue-600 dark:text-blue-400', text: 'text-blue-700 dark:text-blue-300' },
  red: { bg: 'bg-red-50 dark:bg-red-900/20', icon: 'text-red-600 dark:text-red-400', text: 'text-red-700 dark:text-red-300' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-900/20', icon: 'text-amber-600 dark:text-amber-400', text: 'text-amber-700 dark:text-amber-300' },
};

function KpiCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  const c = COLOR_MAP[color] || COLOR_MAP.blue;
  return (
    <div className="metric group">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.bg} transition-transform group-hover:scale-110`}>
          {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: `h-5 w-5 ${c.icon}` })}
        </div>
      </div>
    </div>
  );
}

