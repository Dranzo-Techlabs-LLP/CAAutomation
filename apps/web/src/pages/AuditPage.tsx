import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  changes?: Record<string, unknown>;
  createdAt: string;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    api<AuditLog[]>('/audit-logs').then(setLogs).catch(() => {});
  }, []);

  return (
    <section className="space-y-4 p-4 lg:p-6">
      <h2 className="text-lg font-semibold">Audit Logs</h2>
      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2">Time</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="py-2 text-xs">{new Date(log.createdAt).toLocaleString('en-IN')}</td>
                <td className="font-medium text-xs">{log.action}</td>
                <td className="text-xs">{log.entityType} {log.entityId ? `#${log.entityId.slice(0, 8)}` : ''}</td>
                <td className="max-w-[300px] truncate text-xs text-muted-foreground">
                  {log.changes ? JSON.stringify(log.changes).slice(0, 100) : '-'}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">No audit logs found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
