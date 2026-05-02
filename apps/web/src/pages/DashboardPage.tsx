import { useEffect, useState } from 'react';
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
    // Paginate through all tasks (API max 100 per page)
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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {isPartner && partner && (
          <>
            <KpiCard label="Revenue" value={formatPaise(partner.revenue)} tone="green" />
            <KpiCard label="WIP Tasks" value={String(partner.wip)} tone="blue" />
            <KpiCard label="Overdue Tasks" value={String(partner.overdueTasks)} tone="red" />
            <KpiCard label="Invoices" value={String(partner.invoiceCount)} tone="amber" />
          </>
        )}
        {!isPartner && isManager && manager && (
          <>
            <KpiCard label="Open Tasks" value={String(manager.openTasks)} tone="blue" />
            <KpiCard label="Pending Reviews" value={String(manager.pendingReviews)} tone="amber" />
            <KpiCard label="Upcoming Recurrences" value={String(manager.upcomingRecurrences)} tone="green" />
          </>
        )}
        {!isPartner && !isManager && associate && (
          <>
            <KpiCard label="My Open Tasks" value={String(associate.myOpenTasks)} tone="blue" />
            <KpiCard label="My Overdue" value={String(associate.myOverdueTasks)} tone="red" />
            <KpiCard label="My Hours" value={String(associate.myHours)} tone="green" />
          </>
        )}
      </div>

      {workloadData.length > 0 && (
        <div className="panel">
          <div className="panel-title">{isPartner || isManager ? 'Task Distribution by Status' : 'My Tasks by Status'}</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workloadData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="metric">
      <span className={`status-dot ${tone}`} />
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
