import { Link } from 'react-router-dom';
import { useNotifications } from '../lib/notifications';
import { useTheme } from '../lib/theme';

export default function TopBar({ profile }) {
  const { unreadCount } = useNotifications(profile.id);
  const { isDark, toggle } = useTheme();

  return (
    <div className="topbar">
      <Link to="/" className="topbar-brand">
        <span className="topbar-brand-mark">T</span>
        Team Tasks
      </Link>
      <div className="topbar-actions">
        <button
          type="button"
          className="icon-btn"
          onClick={toggle}
          aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {isDark ? '☀' : '☾'}
        </button>
        <Link to="/notifications" className="icon-btn" aria-label="Notifications">
          🔔
          {unreadCount > 0 && <span className="dot">{unreadCount > 9 ? '9+' : unreadCount}</span>}
        </Link>
      </div>
    </div>
  );
}
