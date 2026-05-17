import { useEffect, useRef, useState } from 'react';
import { Download, FileUp, Upload, X } from 'lucide-react';
import { api, apiDownload, apiUpload } from '../lib/api';
import { useAuth } from '../lib/auth';

interface BulkResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: { row: number; reason: string; data?: Record<string, unknown> }[];
}

interface UserItem {
  id: string;
  name: string;
  email: string;
  phone?: string;
  isActive: boolean;
  roleId: string;
  lastLoginAt?: string;
  defaultHourlyRate?: string | null;
  costRate?: string | null;
}

interface RoleItem {
  id: string;
  name: string;
  isSystemRole: boolean;
  permissionCodes: string[];
}

interface PermissionItem {
  id: string;
  code: string;
  description: string;
  module: string;
}

export default function UsersPage() {
  const { hasPermission } = useAuth();
  const canCreateUser = hasPermission('user.create');
  const canEditRole = hasPermission('role.edit');

  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [allPermissions, setAllPermissions] = useState<PermissionItem[]>([]);
  const [tab, setTab] = useState<'users' | 'roles'>('users');
  const [showUserForm, setShowUserForm] = useState(false);
  const [bulkBusy, setBulkBusy] = useState<'' | 'template' | 'export' | 'import'>('');
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [selectedPermIds, setSelectedPermIds] = useState<string[]>([]);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', roleId: '', phone: '', defaultHourlyRate: '', costRate: '' });
  const [error, setError] = useState('');
  const [resetTarget, setResetTarget] = useState<UserItem | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [rateTarget, setRateTarget] = useState<UserItem | null>(null);
  const [rateForm, setRateForm] = useState({ defaultHourlyRate: '', costRate: '' });
  const [editTarget, setEditTarget] = useState<UserItem | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', roleId: '', isActive: true });
  const [editError, setEditError] = useState('');

  const loadUsers = () => api<UserItem[]>('/users').then(setUsers).catch(() => {});
  const loadRoles = () => api<RoleItem[]>('/roles').then(setRoles).catch(() => {});

  useEffect(() => {
    loadUsers();
    loadRoles();
    api<PermissionItem[]>('/permissions').then(setAllPermissions).catch(() => {});
  }, []);

  const handleDownloadTemplate = async () => {
    setBulkBusy('template');
    try { await apiDownload('/users/bulk/template', 'users-template.xlsx'); }
    catch (err) { alert(err instanceof Error ? err.message : 'Template download failed'); }
    finally { setBulkBusy(''); }
  };

  const handleExport = async () => {
    setBulkBusy('export');
    try { await apiDownload('/users/bulk/export', 'users.xlsx'); }
    catch (err) { alert(err instanceof Error ? err.message : 'Export failed'); }
    finally { setBulkBusy(''); }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkBusy('import');
    setBulkResult(null);
    try {
      const res = await apiUpload<BulkResult>('/users/bulk/import', file);
      setBulkResult(res);
      loadUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setBulkBusy('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api('/users', { method: 'POST', body: JSON.stringify({
        ...userForm,
        defaultHourlyRate: userForm.defaultHourlyRate || undefined,
        costRate: userForm.costRate || undefined,
      }) });
      setShowUserForm(false);
      setUserForm({ name: '', email: '', password: '', roleId: '', phone: '', defaultHourlyRate: '', costRate: '' });
      loadUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setResetError('');
    setResetSuccess('');
    try {
      await api(`/users/${resetTarget.id}/reset-password`, {
        method: 'PATCH',
        body: JSON.stringify({ newPassword }),
      });
      setResetSuccess(`Password reset for ${resetTarget.email}`);
      setNewPassword('');
      setTimeout(() => { setResetTarget(null); setResetSuccess(''); }, 2000);
    } catch (err: unknown) {
      setResetError(err instanceof Error ? err.message : 'Failed to reset password');
    }
  };

  const codeToId = Object.fromEntries(allPermissions.map((p) => [p.code, p.id]));

  const startEditRole = (role: RoleItem) => {
    setEditingRole(role.id);
    setSelectedPermIds(role.permissionCodes.map((code) => codeToId[code]).filter(Boolean));
  };

  const saveRolePermissions = async () => {
    if (!editingRole) return;
    try {
      await api(`/roles/${editingRole}/permissions`, {
        method: 'PATCH',
        body: JSON.stringify({ permissionIds: selectedPermIds }),
      });
      setEditingRole(null);
      loadRoles();
    } catch {}
  };

  const togglePerm = (permId: string) => {
    setSelectedPermIds((prev) =>
      prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId],
    );
  };

  const roleMap = Object.fromEntries(roles.map((r) => [r.id, r.name]));
  const permsByModule = allPermissions.reduce<Record<string, PermissionItem[]>>((acc, p) => {
    (acc[p.module] ??= []).push(p);
    return acc;
  }, {});

  return (
    <section className="space-y-4 p-4 lg:p-6">
      <div className="flex items-center gap-4">
        <button className={`text-sm font-medium ${tab === 'users' ? 'text-primary underline' : 'text-muted-foreground'}`} onClick={() => setTab('users')}>Users</button>
        <button className={`text-sm font-medium ${tab === 'roles' ? 'text-primary underline' : 'text-muted-foreground'}`} onClick={() => setTab('roles')}>Roles & Permissions</button>
      </div>

      {tab === 'users' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Users</h2>
            {canCreateUser && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!!bulkBusy}
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-panel px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
                  title="Download blank Excel template"
                >
                  <FileUp className="h-3.5 w-3.5" />
                  {bulkBusy === 'template' ? 'Preparing…' : 'Template'}
                </button>
                <button
                  type="button"
                  disabled={!!bulkBusy}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-panel px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
                  title="Upload filled .xlsx to import"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {bulkBusy === 'import' ? 'Importing…' : 'Import'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={handleImportFile}
                />
                <button
                  type="button"
                  disabled={!!bulkBusy}
                  onClick={handleExport}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-panel px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
                  title="Download all users as Excel"
                >
                  <Download className="h-3.5 w-3.5" />
                  {bulkBusy === 'export' ? 'Exporting…' : 'Export'}
                </button>
                <button className="primary-button" onClick={() => setShowUserForm(!showUserForm)}>
                  {showUserForm ? 'Cancel' : 'Add User'}
                </button>
              </div>
            )}
          </div>

          {bulkResult && (
            <div className="rounded-md border border-border bg-panel p-3 text-sm">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-semibold">
                  Import complete — <span className="text-emerald-600">{bulkResult.inserted} new</span>, <span className="text-blue-600">{bulkResult.updated} updated</span>, <span className="text-amber-600">{bulkResult.skipped} skipped</span>
                </span>
                <button onClick={() => setBulkResult(null)} className="text-xs text-muted-foreground hover:text-foreground">Dismiss</button>
              </div>
              {bulkResult.errors.length > 0 && (
                <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto rounded border border-border bg-accent/20 p-2 text-xs">
                  {bulkResult.errors.slice(0, 50).map((e, i) => (
                    <li key={i}>
                      <span className="font-mono text-amber-700">row {e.row}:</span> {e.reason}
                      {e.data?.email ? ` (${String(e.data.email)})` : e.data?.name ? ` (${String(e.data.name)})` : ''}
                    </li>
                  ))}
                  {bulkResult.errors.length > 50 && (
                    <li className="italic text-muted-foreground">… {bulkResult.errors.length - 50} more</li>
                  )}
                </ul>
              )}
            </div>
          )}

          {showUserForm && (
            <form onSubmit={handleCreateUser} className="panel space-y-3">
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Name</label>
                  <input className="input-field" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} required />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Email</label>
                  <input type="email" className="input-field" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} required />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Password (min 12 chars)</label>
                  <input type="password" className="input-field" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} required minLength={12} />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Role</label>
                  <select className="input-field" value={userForm.roleId} onChange={(e) => setUserForm({ ...userForm, roleId: e.target.value })} required>
                    <option value="">Select...</option>
                    {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Phone</label>
                  <input className="input-field" value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Default Hourly Rate (₹/hr)</label>
                  <input
                    className="input-field"
                    type="number"
                    step="0.01"
                    placeholder="2000.00"
                    value={userForm.defaultHourlyRate ? (Number(userForm.defaultHourlyRate) / 100).toString() : ''}
                    onChange={(e) => {
                      const r = Number(e.target.value || 0);
                      setUserForm({ ...userForm, defaultHourlyRate: r > 0 ? String(Math.round(r * 100)) : '' });
                    }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-muted-foreground">Cost Rate (₹/hr)</label>
                  <input
                    className="input-field"
                    type="number"
                    step="0.01"
                    placeholder="1000.00"
                    value={userForm.costRate ? (Number(userForm.costRate) / 100).toString() : ''}
                    onChange={(e) => {
                      const r = Number(e.target.value || 0);
                      setUserForm({ ...userForm, costRate: r > 0 ? String(Math.round(r * 100)) : '' });
                    }}
                  />
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Internal cost (used for margin calc).</p>
                </div>
              </div>
              <button type="submit" className="primary-button">Create User</button>
            </form>
          )}

          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Bill Rate</th>
                  <th>Cost Rate</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  {canCreateUser && <th>Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="py-3 font-medium">{u.name}</td>
                    <td>{u.email}</td>
                    <td>{roleMap[u.roleId] || '-'}</td>
                    <td className="text-xs">{u.defaultHourlyRate ? `₹${(Number(u.defaultHourlyRate) / 100).toLocaleString('en-IN')}/hr` : <span className="text-muted-foreground">-</span>}</td>
                    <td className="text-xs">{u.costRate ? `₹${(Number(u.costRate) / 100).toLocaleString('en-IN')}/hr` : <span className="text-muted-foreground">-</span>}</td>
                    <td>
                      <span className={`rounded px-2 py-1 text-xs ${u.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="text-xs">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('en-IN') : 'Never'}</td>
                    {canCreateUser && (
                      <td>
                        <div className="flex items-center gap-2">
                          <button
                            className="rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                            onClick={() => {
                              setEditTarget(u);
                              setEditForm({ name: u.name, email: u.email, phone: u.phone || '', roleId: u.roleId, isActive: u.isActive });
                              setEditError('');
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                            onClick={() => { setRateTarget(u); setRateForm({ defaultHourlyRate: u.defaultHourlyRate || '', costRate: u.costRate || '' }); }}
                          >
                            Rates
                          </button>
                          <button
                            className="rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                            onClick={() => { setResetTarget(u); setNewPassword(''); setResetError(''); setResetSuccess(''); }}
                          >
                            Reset Password
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'roles' && (
        <>
          <h2 className="text-lg font-semibold">Roles & Permissions</h2>
          <div className="space-y-3">
            {roles.map((role) => (
              <div key={role.id} className="panel">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{role.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {role.permissionCodes.length} permissions
                      {role.isSystemRole && ' (system role)'}
                    </p>
                  </div>
                  {canEditRole && (
                    <button
                      className="text-xs text-primary hover:underline"
                      onClick={() => editingRole === role.id ? setEditingRole(null) : startEditRole(role)}
                    >
                      {editingRole === role.id ? 'Cancel' : 'Edit Permissions'}
                    </button>
                  )}
                </div>
                {editingRole !== role.id && role.permissionCodes.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {role.permissionCodes.map((code) => (
                      <span key={code} className="rounded bg-accent px-2 py-0.5 text-xs">{code}</span>
                    ))}
                  </div>
                )}
                {editingRole === role.id && (
                  <div className="mt-3 space-y-3">
                    {Object.entries(permsByModule).map(([mod, perms]) => (
                      <div key={mod}>
                        <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{mod}</p>
                        <div className="flex flex-wrap gap-2">
                          {perms.map((p) => (
                            <label key={p.id} className="flex items-center gap-1 text-xs cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedPermIds.includes(p.id)}
                                onChange={() => togglePerm(p.id)}
                              />
                              {p.code}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                    <button className="primary-button" onClick={saveRolePermissions}>Save Permissions</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      {/* Reset Password Modal */}
      {resetTarget && (
        <div className="modal-overlay" onClick={() => setResetTarget(null)} role="dialog" aria-modal="true" aria-labelledby="reset-pw-title">
          <div className="modal-card modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="min-w-0">
                <span className="modal-eyebrow">Admin Action</span>
                <h3 id="reset-pw-title" className="modal-title">Reset Password</h3>
                <p className="modal-subtitle truncate">For <span className="font-semibold text-foreground">{resetTarget.email}</span></p>
              </div>
              <button type="button" className="modal-close" onClick={() => setResetTarget(null)} aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleResetPassword}>
              <div className="modal-body space-y-3">
                {resetSuccess && (
                  <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
                    {resetSuccess}
                  </div>
                )}
                {resetError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                    {resetError}
                  </div>
                )}
                <div>
                  <label className="field-label">New Password</label>
                  <input
                    type="password"
                    className="input-field"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={8}
                    required
                    placeholder="Min 8 characters"
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="secondary-button" onClick={() => setResetTarget(null)}>Cancel</button>
                <button type="submit" className="primary-button">Reset Password</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editTarget && (
        <div className="modal-overlay" onClick={() => setEditTarget(null)} role="dialog" aria-modal="true">
          <div className="modal-card modal-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="modal-eyebrow">User</span>
                <h3 className="modal-title">Edit {editTarget.name}</h3>
                <p className="modal-subtitle">Update profile + role + active status. For password use Reset Password.</p>
              </div>
              <button className="modal-close" onClick={() => setEditTarget(null)} aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setEditError('');
              try {
                await api(`/users/${editTarget.id}`, {
                  method: 'PATCH',
                  body: JSON.stringify({
                    name: editForm.name,
                    email: editForm.email,
                    phone: editForm.phone || null,
                    roleId: editForm.roleId,
                    isActive: editForm.isActive,
                  }),
                });
                setEditTarget(null);
                loadUsers();
              } catch (err: unknown) {
                setEditError(err instanceof Error ? err.message : 'Save failed');
              }
            }}>
              <div className="modal-body space-y-3">
                {editError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">{editError}</div>}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">Name *</label>
                    <input className="input-field" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
                  </div>
                  <div>
                    <label className="field-label">Email *</label>
                    <input type="email" className="input-field" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required />
                  </div>
                  <div>
                    <label className="field-label">Phone</label>
                    <input className="input-field" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                  </div>
                  <div>
                    <label className="field-label">Role *</label>
                    <select className="input-field" value={editForm.roleId} onChange={(e) => setEditForm({ ...editForm, roleId: e.target.value })} required>
                      {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <input type="checkbox" className="h-4 w-4" checked={editForm.isActive} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })} />
                  Active (deactivated users cannot sign in)
                </label>
              </div>
              <div className="modal-footer">
                <button type="button" className="secondary-button" onClick={() => setEditTarget(null)}>Cancel</button>
                <button type="submit" className="primary-button">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rates Modal */}
      {rateTarget && (
        <div className="modal-overlay" onClick={() => setRateTarget(null)} role="dialog" aria-modal="true">
          <div className="modal-card modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="modal-eyebrow">Billing Rates</span>
                <h3 className="modal-title">{rateTarget.name}</h3>
                <p className="modal-subtitle">Default per-hour rates for new time logs by this user</p>
              </div>
              <button className="modal-close" onClick={() => setRateTarget(null)} aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="modal-body space-y-3">
              <div>
                <label className="field-label">Bill Rate (₹/hr)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  placeholder="2000.00"
                  value={rateForm.defaultHourlyRate ? (Number(rateForm.defaultHourlyRate) / 100).toString() : ''}
                  onChange={(e) => {
                    const r = Number(e.target.value || 0);
                    setRateForm({ ...rateForm, defaultHourlyRate: r > 0 ? String(Math.round(r * 100)) : '' });
                  }}
                />
                <p className="mt-0.5 text-[11px] text-muted-foreground">Charged to clients (revenue from time logs).</p>
              </div>
              <div>
                <label className="field-label">Cost Rate (₹/hr)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  placeholder="1000.00"
                  value={rateForm.costRate ? (Number(rateForm.costRate) / 100).toString() : ''}
                  onChange={(e) => {
                    const r = Number(e.target.value || 0);
                    setRateForm({ ...rateForm, costRate: r > 0 ? String(Math.round(r * 100)) : '' });
                  }}
                />
                <p className="mt-0.5 text-[11px] text-muted-foreground">Internal cost (used for margin in analytics).</p>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="secondary-button" onClick={() => setRateTarget(null)}>Cancel</button>
              <button
                type="button"
                className="primary-button"
                onClick={async () => {
                  try {
                    await api(`/users/${rateTarget.id}/rates`, {
                      method: 'PATCH',
                      body: JSON.stringify({
                        defaultHourlyRate: rateForm.defaultHourlyRate || null,
                        costRate: rateForm.costRate || null,
                      }),
                    });
                    setRateTarget(null);
                    loadUsers();
                  } catch (err: unknown) {
                    alert(err instanceof Error ? err.message : 'Failed');
                  }
                }}
              >
                Save Rates
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
