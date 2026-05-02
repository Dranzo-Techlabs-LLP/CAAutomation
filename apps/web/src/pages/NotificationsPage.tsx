import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Notification {
  id: string;
  type: string;
  payloadJson?: { title?: string; message?: string };
  readAt?: string;
  createdAt: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const load = () => api<Notification[]>('/notifications/unread').then(setNotifications).catch(() => {});
  useEffect(() => { load(); }, []);

  const markRead = async (id: string) => {
    try {
      await api(`/notifications/${id}/read`, { method: 'PATCH' });
      load();
    } catch {}
  };

  return (
    <section className="space-y-4 p-4 lg:p-6">
      <h2 className="text-lg font-semibold">Notifications</h2>
      <div className="space-y-2">
        {notifications.map((n) => (
          <div key={n.id} className="panel flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{n.payloadJson?.title || n.type}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{n.payloadJson?.message || ''}</p>
              <p className="mt-1 text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString('en-IN')}</p>
            </div>
            <button className="text-xs text-primary hover:underline whitespace-nowrap" onClick={() => markRead(n.id)}>
              Mark read
            </button>
          </div>
        ))}
        {notifications.length === 0 && (
          <div className="panel py-8 text-center text-muted-foreground">No unread notifications</div>
        )}
      </div>
    </section>
  );
}
