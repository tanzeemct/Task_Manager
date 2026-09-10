import { Link } from 'react-router-dom';

export default function More({ profile }) {
  const items = [
    { to: '/users', label: 'Team', desc: 'Add, deactivate, and view team members', icon: '👥' },
    { to: '/recurring', label: 'Recurring tasks', desc: 'Manage repeating task templates', icon: '↻' },
    { to: '/reports', label: 'Reports', desc: 'Team overview and employee performance', icon: '📊' },
    { to: '/profile', label: 'Account', desc: 'Change your password and sign out', icon: '⚙' }
  ];
  return (
    <div className="app-page">
      <h1 className="page-title">More</h1>
      <div className="card-list">
        {items.map((item) => (
          <Link key={item.to} to={item.to} className="card">
            <div className="row" style={{ gap: 12 }}>
              <div className="avatar">{item.icon}</div>
              <div>
                <div className="card-title">{item.label}</div>
                <div className="card-meta">{item.desc}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
      <p className="empty-state" style={{ marginTop: 20 }}>
        Signed in as {profile.full_name} · Admin
      </p>
    </div>
  );
}
