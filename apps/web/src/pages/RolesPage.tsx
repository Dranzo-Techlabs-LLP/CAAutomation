import { useEffect, useState } from 'react';
import { Pencil, Plus, Shield, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface Role {
  id: string;
  firmId: string;
  name: string;
  isSystemRole: boolean;
  permissionCodes: string[];
}
interface Permission {
  id: string;
  code: string;
  description?: string | null;
  module?: string | null;
}

export default function RolesPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('role.create');
  const canEdit = hasPermission('role.edit');

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [editing, setEditing] = useState<Role | null>(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [editName, setEditName] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const load = () => api<Role[]>('/roles').then(setRoles).catch(() => {});

  useEffect(() => {
    load();
    api<Permission[]>('/permissions').then(setPermissions).catch(() => {});
  }, []);

  const openEdit = (r: Role) => {
    setEditing(r);
    setEditName(r.name);
    const ids = new Set<string>();
    r.permissionCodes.forEach((code) => {
      const p = permissions.find((x) => x.code === code);
      if (p) ids.add(p.id);
    });
    setSelectedPerms(ids);
    setError('');
  };

  const togglePerm = (id: string) => {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleModule = (module: string, checked: boolean) => {
    const ids = permissions.filter((p) => (p.module || 'other') === module).map((p) => p.id);
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => { if (checked) next.add(id); else next.delete(id); });
      return next;
    });
  };

  const saveRole = async () => {
    if (!editing) return;
    setError('');
    try {
      if (!editing.isSystemRole && editName !== editing.name) {
        await api(`/roles/${editing.id}`, { method: 'PATCH', body: JSON.stringify({ name: editName }) });
      }
      await api(`/roles/${editing.id}/permissions`, { method: 'PATCH', body: JSON.stringify({ permissionIds: Array.from(selectedPerms) }) });
      setEditing(null);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const createRole = async () => {
    if (!newRoleName.trim()) return;
    try {
      await api('/roles', { method: 'POST', body: JSON.stringify({ name: newRoleName.trim() }) });
      setNewRoleName('');
      load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed');
    }
  };

  const deleteRole = async (r: Role) => {
    if (r.isSystemRole) { alert('System roles cannot be deleted'); return; }
    if (!confirm(`Delete role "${r.name}"?`)) return;
    try {
      await api(`/roles/${r.id}`, { method: 'DELETE' });
      load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  // Group permissions by module
  const grouped: Record<string, Permission[]> = {};
  permissions.forEach((p) => {
    const m = p.module || 'other';
    (grouped[m] ??= []).push(p);
  });

  return (
    <section className="space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Roles & Permissions</h2>
          <p className="text-xs text-muted-foreground">Define who can access which features. System roles cannot be renamed or deleted.</p>
        </div>
      </div>

      {/* Create */}
      {canCreate && (
        <div className="panel flex items-end gap-2">
          <div className="flex-1">
            <label className="field-label">New Role Name</label>
            <input className="input-field" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="e.g. Auditor, Accountant" />
          </div>
          <button className="primary-button" onClick={createRole} disabled={!newRoleName.trim()}>
            <Plus className="h-4 w-4" /> Create Role
          </button>
        </div>
      )}

      {/* List */}
      <div className="panel overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-background text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold">Role</th>
              <th className="px-4 py-2.5 text-left font-semibold">Permissions</th>
              <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {roles.map((r) => (
              <tr key={r.id} className="hover:bg-accent/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-foreground">{r.name}</span>
                    {r.isSystemRole && <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">system</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-[12px] text-muted-foreground">
                  {r.permissionCodes.length} permission{r.permissionCodes.length === 1 ? '' : 's'}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {canEdit && (
                      <button onClick={() => openEdit(r)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title="Edit">
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {canEdit && !r.isSystemRole && (
                      <button onClick={() => deleteRole(r)} className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {roles.length === 0 && (
              <tr><td colSpan={3} className="py-8 text-center text-muted-foreground">No roles found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)} role="dialog" aria-modal="true">
          <div className="modal-card modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="min-w-0">
                <span className="modal-eyebrow">Role</span>
                <h3 className="modal-title">{editing.isSystemRole ? editing.name : 'Edit Role'}</h3>
                <p className="modal-subtitle">{selectedPerms.size} permission{selectedPerms.size === 1 ? '' : 's'} selected</p>
              </div>
              <button className="modal-close" onClick={() => setEditing(null)} aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            <div className="modal-body space-y-4">
              {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">{error}</div>}
              {!editing.isSystemRole && (
                <div>
                  <label className="field-label">Role Name *</label>
                  <input className="input-field" value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
              )}
              <div>
                <label className="field-label">Permissions</label>
                <div className="space-y-3">
                  {Object.keys(grouped).sort().map((module) => {
                    const list = grouped[module];
                    const total = list.length;
                    const selected = list.filter((p) => selectedPerms.has(p.id)).length;
                    const allOn = selected === total;
                    return (
                      <div key={module} className="rounded-lg border border-border">
                        <div className="flex items-center justify-between border-b border-border bg-accent/30 px-3 py-2">
                          <span className="text-xs font-semibold uppercase tracking-wide text-foreground">{module}</span>
                          <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                            <input type="checkbox" className="h-3.5 w-3.5" checked={allOn} ref={(el) => { if (el) el.indeterminate = !allOn && selected > 0; }} onChange={(e) => toggleModule(module, e.target.checked)} />
                            All ({selected}/{total})
                          </label>
                        </div>
                        <ul className="grid grid-cols-1 gap-1 p-2 sm:grid-cols-2">
                          {list.map((p) => (
                            <li key={p.id}>
                              <label className="flex cursor-pointer items-start gap-2 rounded-md p-2 hover:bg-accent/50">
                                <input type="checkbox" className="mt-0.5 h-4 w-4" checked={selectedPerms.has(p.id)} onChange={() => togglePerm(p.id)} />
                                <div className="min-w-0 flex-1">
                                  <div className="text-[12.5px] font-mono font-medium text-foreground">{p.code}</div>
                                  {p.description && p.description !== p.code && <div className="text-[11px] text-muted-foreground">{p.description}</div>}
                                </div>
                              </label>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="secondary-button" onClick={() => setEditing(null)}>Cancel</button>
              <button className="primary-button" onClick={saveRole}>Save</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
