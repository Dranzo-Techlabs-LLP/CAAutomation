import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface UserItem {
  id: string;
  name: string;
  email: string;
  phone?: string;
  isActive: boolean;
  roleId: string;
  lastLoginAt?: string;
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
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [selectedPermIds, setSelectedPermIds] = useState<string[]>([]);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', roleId: '', phone: '' });
  const [error, setError] = useState('');

  const loadUsers = () => api<UserItem[]>('/users').then(setUsers).catch(() => {});
  const loadRoles = () => api<RoleItem[]>('/roles').then(setRoles).catch(() => {});

  useEffect(() => {
    loadUsers();
    loadRoles();
    api<PermissionItem[]>('/permissions').then(setAllPermissions).catch(() => {});
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api('/users', { method: 'POST', body: JSON.stringify(userForm) });
      setShowUserForm(false);
      setUserForm({ name: '', email: '', password: '', roleId: '', phone: '' });
      loadUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
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
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Users</h2>
            {canCreateUser && (
              <button className="primary-button" onClick={() => setShowUserForm(!showUserForm)}>
                {showUserForm ? 'Cancel' : 'Add User'}
              </button>
            )}
          </div>

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
                  <th>Status</th>
                  <th>Last Login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="py-3 font-medium">{u.name}</td>
                    <td>{u.email}</td>
                    <td>{roleMap[u.roleId] || '-'}</td>
                    <td>
                      <span className={`rounded px-2 py-1 text-xs ${u.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="text-xs">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('en-IN') : 'Never'}</td>
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
    </section>
  );
}
