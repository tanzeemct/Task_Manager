import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../lib/notifications';

function dayLabel(date) {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function Notifications({ profile }) {
  const { notifications, markRead } = useNotifications(profile.id);
  const navigate = useNavigate();

  if (notifications.length === 0) {
    return (
      <div className="app-page">
        <h1 className="page-title">Notifications</h1>
        <div className="empty-state empty-state--block">
          <div className="empty-icon">🔔</div>
          You&rsquo;re all caught up.
        </div>
      </div>
    );
  }

  const groups = {};
  notifications.forEach((n) => {
    const label = dayLabel(n.created_at);
    groups[label] = groups[label] || [];
    groups[label].push(n);
  });

  async function open(n) {
    if (!n.read) await markRead(n.id);
    if (n.task_id) navigate(`/task/${n.task_id}`);
  }

  return (
    <div className="app-page">
      <h1 className="page-title">Notifications</h1>
      {Object.entries(groups).map(([label, items]) => (
        <div key={label} className="section">
          <div className="section-title">{label}</div>
          <div className="stack" style={{ gap: 0 }}>
            {items.map((n) => (
              <div
                key={n.id}
                onClick={() => open(n)}
                className="row"
                style={{
                  padding: '11px 4px',
                  borderBottom: '1px solid var(--color-border)',
                  cursor: 'pointer'
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: n.read ? 'transparent' : 'var(--color-primary)',
                    flexShrink: 0
                  }}
                />
                <div style={{ flex: 1, fontSize: 14, fontWeight: n.read ? 400 : 500 }}>{n.message}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', flexShrink: 0 }}>
                  {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
