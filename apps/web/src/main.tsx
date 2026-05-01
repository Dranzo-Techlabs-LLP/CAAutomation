import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { BarChart3, Bell, CalendarDays, Moon, Repeat, ShieldCheck, Sun, Users } from 'lucide-react';
import { create } from 'zustand';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import './styles.css';

type UiState = {
  dark: boolean;
  toggleDark: () => void;
};

const useUiStore = create<UiState>((set) => ({
  dark: false,
  toggleDark: () => set((state) => ({ dark: !state.dark })),
}));

const queryClient = new QueryClient();

const kpis = [
  { label: 'Revenue', value: '₹18.4L', tone: 'green' },
  { label: 'WIP Tasks', value: '126', tone: 'blue' },
  { label: 'SLA Breaches', value: '9', tone: 'red' },
  { label: 'Utilization', value: '78%', tone: 'amber' },
];

const workload = [
  { name: 'GST', open: 42, review: 11 },
  { name: 'Audit', open: 25, review: 8 },
  { name: 'ITR', open: 36, review: 5 },
  { name: 'ROC', open: 18, review: 4 },
];

function AppShell() {
  const { dark, toggleDark } = useUiStore();
  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-panel lg:block">
        <div className="flex h-16 items-center gap-2 border-b border-border px-5">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold">TBM Practice OS</span>
        </div>
        <nav className="space-y-1 p-3 text-sm">
          <NavItem icon={<BarChart3 />} label="Dashboards" />
          <NavItem icon={<Users />} label="Customers" />
          <NavItem icon={<Repeat />} label="Recurrences" />
          <NavItem icon={<CalendarDays />} label="Compliance Calendar" />
          <NavItem icon={<Bell />} label="Notifications" />
        </nav>
      </aside>
      <main className="lg:pl-64">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-panel/95 px-4 backdrop-blur lg:px-6">
          <div>
            <p className="text-xs text-muted-foreground">Partner workspace</p>
            <h1 className="text-base font-semibold">Practice command center</h1>
          </div>
          <button className="icon-button" onClick={toggleDark} aria-label="Toggle dark mode">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </header>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/recurrences" element={<Recurrences />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function NavItem({ icon, label }: { icon: React.ReactElement<{ className?: string }>; label: string }) {
  return (
    <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-muted-foreground hover:bg-accent hover:text-foreground">
      {React.cloneElement(icon, { className: 'h-4 w-4' })}
      <span>{label}</span>
    </button>
  );
}

function Dashboard() {
  return (
    <section className="space-y-6 p-4 lg:p-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div className="metric" key={kpi.label}>
            <span className={`status-dot ${kpi.tone}`} />
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className="mt-2 text-2xl font-semibold">{kpi.value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className="panel">
          <div className="panel-title">Team workload</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workload}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="open" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="review" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel">
          <div className="panel-title">Today</div>
          <div className="divide-y divide-border text-sm">
            {['GSTR-3B review queue', 'ITR senior approval', 'ROC AOC-4 evidence pending'].map((item) => (
              <div className="flex items-center justify-between py-3" key={item}>
                <span>{item}</span>
                <span className="rounded bg-accent px-2 py-1 text-xs">Open</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function Recurrences() {
  return (
    <section className="space-y-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recurrences</h2>
        <button className="primary-button">Create</button>
      </div>
      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2">Name</th>
              <th>Customer</th>
              <th>Service</th>
              <th>Next run</th>
              <th>Strategy</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {['GSTR-3B Monthly', 'TDS Payment', 'PF & ESI Monthly'].map((name, index) => (
              <tr key={name}>
                <td className="py-3 font-medium">{name}</td>
                <td>Demo Client {index + 1}</td>
                <td>{index === 1 ? 'TDS' : 'GST'}</td>
                <td>2026-05-{20 + index}</td>
                <td>{index === 0 ? 'team_least_loaded' : 'customer_owner'}</td>
                <td><span className="rounded bg-accent px-2 py-1 text-xs">Active</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Root() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
