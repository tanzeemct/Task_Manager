import { Link, useLocation } from 'react-router-dom';

export default function BottomNav({ isAdmin }) {
  const location = useLocation();
  const items = isAdmin
    ? [
        { to: '/', label: 'Home', icon: '⌂' },
        { to: '/tasks', label: 'Tasks', icon: '☰' },
        { to: '/closing', label: 'Closing', icon: '✓' },
        { to: '/more', label: 'More', icon: '⋯' }
      ]
    : [
        { to: '/', label: 'Home', icon: '⌂' },
        { to: '/tasks', label: 'My tasks', icon: '☰' },
        { to: '/assigned-by-me', label: 'Assigned', icon: '↗' },
        { to: '/profile', label: 'More', icon: '⋯' }
      ];

  return (
    <nav className="bottomnav">
      {items.map((item) => {
        const moreRoutes = ['/more', '/users', '/recurring', '/reports', '/profile'];
        const active = item.label === 'More' ? moreRoutes.includes(location.pathname) : location.pathname === item.to;
        return (
          <Link key={item.to} to={item.to} className={`bottomnav-item${active ? ' active' : ''}`}>
            <span className="bottomnav-icon">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
