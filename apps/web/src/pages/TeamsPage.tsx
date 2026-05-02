import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface Team {
  id: string;
  name: string;
  description?: string;
  leadUserId?: string;
  members?: { id: string; userId: string; roleInTeam: string; userName?: string }[];
}

export default function TeamsPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('team.create');
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', leadUserId: '' });
  const [error, setError] = useState('');

  const load = () => api<Team[]>('/teams').then(setTeams).catch(() => {});

  useEffect(() => {
    load();
    api<{ id: string; name: string }[]>('/users').then(setUsers).catch(() => setUsers([]));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const body: Record<string, unknown> = { name: form.name };
      if (form.description) body.description = form.description;
      if (form.leadUserId) body.leadUserId = form.leadUserId;
      await api('/teams', { method: 'POST', body: JSON.stringify(body) });
      setShowForm(false);
      setForm({ name: '', description: '', leadUserId: '' });
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

  return (
    <section className="space-y-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Teams</h2>
        {canCreate && (
          <button className="primary-button" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'Create Team'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="panel space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
              <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Description</label>
              <input className="input-field" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Lead</label>
              <select className="input-field" value={form.leadUserId} onChange={(e) => setForm({ ...form, leadUserId: e.target.value })}>
                <option value="">Select...</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" className="primary-button">Create</button>
        </form>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((team) => (
          <div key={team.id} className="panel">
            <h3 className="font-medium">{team.name}</h3>
            {team.description && <p className="mt-1 text-xs text-muted-foreground">{team.description}</p>}
            {team.leadUserId && (
              <p className="mt-2 text-xs">Lead: <span className="font-medium">{userMap[team.leadUserId] || 'Unknown'}</span></p>
            )}
            {team.members && team.members.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground">Members ({team.members.length})</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {team.members.map((m) => (
                    <span key={m.id} className="rounded bg-accent px-2 py-0.5 text-xs">
                      {m.userName || userMap[m.userId] || 'Unknown'}
                      {m.roleInTeam === 'lead' && ' (Lead)'}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        {teams.length === 0 && (
          <div className="panel py-8 text-center text-muted-foreground col-span-full">No teams found</div>
        )}
      </div>
    </section>
  );
}
