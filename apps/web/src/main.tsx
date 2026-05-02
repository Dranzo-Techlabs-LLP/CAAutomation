import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3, Bell, BookOpen, CalendarDays, ChevronRight, ClipboardList,
  FileText, LogOut, Menu, Moon, Repeat, Settings, Shield, ShieldCheck, Sun, Users, UsersRound, Workflow, X,
} from 'lucide-react';
import { useAuth } from './lib/auth';
import { useUiStore } from './lib/ui-store';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CustomersPage from './pages/CustomersPage';
import TasksPage from './pages/TasksPage';
import EnquiriesPage from './pages/EnquiriesPage';
import RecurrencesPage from './pages/RecurrencesPage';
import TeamsPage from './pages/TeamsPage';
import BillingPage from './pages/BillingPage';
import NotificationsPage from './pages/NotificationsPage';
import AuditPage from './pages/AuditPage';
import UsersPage from './pages/UsersPage';
import ServicesPage from './pages/ServicesPage';
import ComplianceCalendarPage from './pages/ComplianceCalendarPage';
import WorkflowsPage from './pages/WorkflowsPage';
import SettingsPage from './pages/SettingsPage';
import './styles.css';

const queryClient = new QueryClient();

interface NavEntry {
  path: string;
  label: string;
  icon: React.ReactNode;
  permission?: string;
}

const NAV: NavEntry[] = [
  { path: '/', label: 'Dashboard', icon: <BarChart3 /> },
  { path: '/tasks', label: 'Tasks', icon: <ClipboardList /> },
  { path: '/customers', label: 'Customers', icon: <Users />, permission: 'customer.view' },
  { path: '/enquiries', label: 'Enquiries', icon: <ChevronRight />, permission: 'enquiry.view' },
  { path: '/recurrences', label: 'Recurrences', icon: <Repeat />, permission: 'recurrence.view' },
  { path: '/teams', label: 'Teams', icon: <UsersRound />, permission: 'team.view' },
  { path: '/services', label: 'Services', icon: <BookOpen />, permission: 'service.view' },
  { path: '/billing', label: 'Billing', icon: <FileText />, permission: 'billing.view' },
  { path: '/compliance', label: 'Compliance Calendar', icon: <CalendarDays />, permission: 'dashboard.compliance_calendar' },
  { path: '/workflows', label: 'Workflows', icon: <Workflow />, permission: 'workflow.view' },
  { path: '/notifications', label: 'Notifications', icon: <Bell /> },
  { path: '/audit', label: 'Audit Logs', icon: <Shield />, permission: 'audit.view' },
  { path: '/settings', label: 'Settings', icon: <Settings />, permission: 'settings.edit' },
  { path: '/admin/users', label: 'Users & Roles', icon: <Shield />, permission: 'user.view' },
];

function AppShell() {
  const { user, loading, logout, hasPermission } = useAuth();
  const { dark, toggleDark, sidebarOpen, toggleSidebar } = useUiStore();
  const location = useLocation();
  const navigate = useNavigate();

  const visibleNav = NAV.filter((n) => !n.permission || hasPermission(n.permission));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-foreground">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={toggleSidebar} />
      )}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-border bg-panel transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 items-center justify-between border-b border-border px-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold">TBM Practice OS</span>
          </div>
          <button className="lg:hidden icon-button" onClick={toggleSidebar}><X className="h-4 w-4" /></button>
        </div>
        <nav className="space-y-1 p-3 text-sm overflow-y-auto" style={{ maxHeight: 'calc(100vh - 128px)' }}>
          {visibleNav.map((item) => {
            const active = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => sidebarOpen && toggleSidebar()}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left ${active ? 'bg-accent text-foreground font-medium' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
              >
                {React.cloneElement(item.icon as React.ReactElement<{ className?: string }>, { className: 'h-4 w-4' })}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-border p-3">
          <div className="mb-2 px-3 text-xs text-muted-foreground truncate">
            {user.name} ({user.roleName || 'User'})
          </div>
          <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="lg:pl-64">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-panel/95 px-4 backdrop-blur lg:px-6">
          <div className="flex items-center gap-3">
            <button className="icon-button lg:hidden" onClick={toggleSidebar}>
              <Menu className="h-4 w-4" />
            </button>
            <div>
              <p className="text-xs text-muted-foreground">{user.roleName || 'User'} workspace</p>
              <h1 className="text-base font-semibold">Practice command center</h1>
            </div>
          </div>
          <button className="icon-button" onClick={toggleDark} aria-label="Toggle dark mode">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </header>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/enquiries" element={<EnquiriesPage />} />
          <Route path="/recurrences" element={<RecurrencesPage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/compliance" element={<ComplianceCalendarPage />} />
          <Route path="/workflows" element={<WorkflowsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin/users" element={<UsersPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function Root() {
  const loadUser = useAuth((s) => s.loadUser);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={<AppShell />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
