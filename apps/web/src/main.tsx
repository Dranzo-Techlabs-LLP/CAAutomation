import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3, Bell, BookOpen, CalendarDays, ClipboardList,
  FileText, Inbox, KeyRound, LineChart, LogOut, Menu, Moon, Receipt, Repeat, Settings, Shield, ShieldCheck, Sun, Users, UsersRound, Workflow, X,
} from 'lucide-react';
import { useState } from 'react';
import { api } from './lib/api';
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
import ReportsPage from './pages/ReportsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import PaymentAdvicesPage from './pages/PaymentAdvicesPage';
import RolesPage from './pages/RolesPage';
import SettingsPage from './pages/SettingsPage';
import './styles.css';

const queryClient = new QueryClient();

interface NavEntry {
  path: string;
  label: string;
  icon: React.ReactNode;
  permission?: string;
  section?: string;
}

const NAV: NavEntry[] = [
  { path: '/', label: 'Dashboard', icon: <BarChart3 />, section: 'main' },
  { path: '/tasks', label: 'Tasks', icon: <ClipboardList />, section: 'main' },
  { path: '/customers', label: 'Customers', icon: <Users />, permission: 'customer.view', section: 'main' },
  { path: '/enquiries', label: 'Enquiries', icon: <Inbox />, permission: 'enquiry.view', section: 'main' },
  { path: '/compliance', label: 'Compliance', icon: <CalendarDays />, permission: 'dashboard.compliance_calendar', section: 'main' },
  { path: '/recurrences', label: 'Recurrences', icon: <Repeat />, permission: 'recurrence.view', section: 'manage' },
  { path: '/teams', label: 'Teams', icon: <UsersRound />, permission: 'team.view', section: 'manage' },
  { path: '/services', label: 'Services', icon: <BookOpen />, permission: 'service.view', section: 'manage' },
  { path: '/billing', label: 'Invoices', icon: <FileText />, permission: 'billing.view', section: 'manage' },
  { path: '/payment-advices', label: 'Payment Advices', icon: <Receipt />, permission: 'billing.view', section: 'manage' },
  { path: '/workflows', label: 'Workflows', icon: <Workflow />, permission: 'workflow.view', section: 'manage' },
  { path: '/reports', label: 'Reports', icon: <LineChart />, permission: 'report.view', section: 'manage' },
  { path: '/analytics', label: 'Analytics', icon: <BarChart3 />, permission: 'report.view', section: 'manage' },
  { path: '/notifications', label: 'Notifications', icon: <Bell />, section: 'system' },
  { path: '/audit', label: 'Audit Logs', icon: <Shield />, permission: 'audit.view', section: 'system' },
  { path: '/settings', label: 'Settings', icon: <Settings />, permission: 'settings.edit', section: 'system' },
  { path: '/admin/users', label: 'Users', icon: <Users />, permission: 'user.view', section: 'system' },
  { path: '/admin/roles', label: 'Roles & Permissions', icon: <Shield />, permission: 'role.view', section: 'system' },
];

const SECTION_LABELS: Record<string, string> = {
  main: '',
  manage: 'Management',
  system: 'System',
};

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

  const [showChangePw, setShowChangePw] = useState(false);
  const [cpForm, setCpForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [cpError, setCpError] = useState('');
  const [cpSuccess, setCpSuccess] = useState('');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setCpError('');
    setCpSuccess('');
    if (cpForm.newPassword !== cpForm.confirmPassword) {
      setCpError('New passwords do not match');
      return;
    }
    try {
      await api('/users/me/change-password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword: cpForm.currentPassword, newPassword: cpForm.newPassword }),
      });
      setCpSuccess('Password changed successfully');
      setCpForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => { setShowChangePw(false); setCpSuccess(''); }, 2000);
    } catch (err: unknown) {
      setCpError(err instanceof Error ? err.message : 'Failed to change password');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Group nav by section
  const sections = ['main', 'manage', 'system'];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden" onClick={toggleSidebar} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-panel transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 flex-shrink-0 items-center justify-between border-b border-border px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <ShieldCheck className="h-4.5 w-4.5 text-primary" />
            </div>
            <span className="text-sm font-bold tracking-tight">TBM Practice OS</span>
          </div>
          <button className="lg:hidden rounded-md p-1.5 text-muted-foreground hover:bg-accent" onClick={toggleSidebar}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          {sections.map((section) => {
            const items = visibleNav.filter((n) => n.section === section);
            if (items.length === 0) return null;
            return (
              <div key={section} className={section !== 'main' ? 'mt-4' : ''}>
                {SECTION_LABELS[section] && (
                  <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                    {SECTION_LABELS[section]}
                  </p>
                )}
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const active = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => sidebarOpen && toggleSidebar()}
                        className={`nav-item ${active ? 'active' : ''}`}
                      >
                        {React.cloneElement(item.icon as React.ReactElement<{ className?: string }>, {
                          className: `h-[18px] w-[18px] ${active ? 'text-primary' : ''}`,
                        })}
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="flex-shrink-0 border-t border-border p-3">
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-accent/50 px-3 py-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
              {user.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{user.name}</p>
              <p className="truncate text-[10px] text-muted-foreground">{user.roleName || 'User'}</p>
            </div>
          </div>
          <button
            onClick={() => { setShowChangePw(true); setCpForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); setCpError(''); setCpSuccess(''); }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors"
          >
            <KeyRound className="h-4 w-4" />
            <span>Change Password</span>
          </button>
          <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors">
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:pl-64">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-panel/80 px-4 backdrop-blur-md lg:px-6">
          <div className="flex items-center gap-3">
            <button className="rounded-md p-1.5 text-muted-foreground hover:bg-accent lg:hidden" onClick={toggleSidebar}>
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-sm font-semibold">{visibleNav.find((n) => n.path === '/' ? location.pathname === '/' : location.pathname.startsWith(n.path))?.label || 'Dashboard'}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-panel text-muted-foreground hover:bg-accent transition-colors"
              onClick={toggleDark}
              aria-label="Toggle dark mode"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
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
          <Route path="/payment-advices" element={<PaymentAdvicesPage />} />
          <Route path="/compliance" element={<ComplianceCalendarPage />} />
          <Route path="/workflows" element={<WorkflowsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin/users" element={<UsersPage />} />
          <Route path="/admin/roles" element={<RolesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Change Password Modal */}
      {showChangePw && (
        <div className="modal-overlay" onClick={() => setShowChangePw(false)} role="dialog" aria-modal="true" aria-labelledby="change-pw-title">
          <div className="modal-card modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="modal-eyebrow">Account</span>
                <h3 id="change-pw-title" className="modal-title">Change Password</h3>
                <p className="modal-subtitle">Update your account password.</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setShowChangePw(false)} aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleChangePassword}>
              <div className="modal-body space-y-3">
                {cpSuccess && (
                  <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
                    {cpSuccess}
                  </div>
                )}
                {cpError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                    {cpError}
                  </div>
                )}
                <div>
                  <label className="field-label">Current Password</label>
                  <input
                    type="password"
                    className="input-field"
                    value={cpForm.currentPassword}
                    onChange={(e) => setCpForm({ ...cpForm, currentPassword: e.target.value })}
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="field-label">New Password</label>
                  <input
                    type="password"
                    className="input-field"
                    value={cpForm.newPassword}
                    onChange={(e) => setCpForm({ ...cpForm, newPassword: e.target.value })}
                    minLength={8}
                    required
                    placeholder="Min 8 characters"
                  />
                </div>
                <div>
                  <label className="field-label">Confirm New Password</label>
                  <input
                    type="password"
                    className="input-field"
                    value={cpForm.confirmPassword}
                    onChange={(e) => setCpForm({ ...cpForm, confirmPassword: e.target.value })}
                    minLength={8}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="secondary-button" onClick={() => setShowChangePw(false)}>Cancel</button>
                <button type="submit" className="primary-button">Change Password</button>
              </div>
            </form>
          </div>
        </div>
      )}
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
