import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTasks } from '../lib/tasks';
import TaskCard from '../components/TaskCard';

const STATUSES = ['all', 'pending', 'accepted', 'in_progress', 'awaiting_approval', 'approved', 'rejected', 'changes_requested', 'cancelled'];

export default function TaskList({ profile, mode = 'assigned' }) {
  const { tasks, loading } = useTasks({ isAdmin: profile.role === 'admin', userId: profile.id });
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [searchParams] = useSearchParams();
  const userFilter = searchParams.get('user');

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  let base = tasks;
  if (mode === 'created' && profile.role !== 'admin') {
    // "Tasks I assigned to Admin" — only tasks this User created, not tasks assigned to them
    base = tasks.filter((t) => t.created_by === profile.id);
  } else if (mode === 'assigned' && profile.role !== 'admin') {
    base = tasks.filter((t) => t.assigned_to === profile.id);
  }

  let filtered = filter === 'all' ? base : base.filter((t) => t.status === filter);
  if (userFilter) filtered = filtered.filter((t) => t.assigned_to === userFilter);
  if (query.trim()) filtered = filtered.filter((t) => t.title.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="app-page">
      <h1 className="page-title">
        {profile.role === 'admin' ? 'All tasks' : mode === 'created' ? 'Tasks I assigned to Admin' : 'My tasks'}
      </h1>
      <div className="row" style={{ marginBottom: 14, gap: 8 }}>
        <select className="select" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ flex: '0 0 auto', width: 'auto' }}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? 'All statuses' : s.replace('_', ' ')}
            </option>
          ))}
        </select>
        <input
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title"
          style={{ flex: 1 }}
        />
      </div>
      {filtered.length === 0 ? (
        <div className="empty-state empty-state--block">
          <div className="empty-icon">🔍</div>
          No tasks match this filter.
        </div>
      ) : (
        <div className="card-list">
          {filtered.map((t) => (
            <TaskCard key={t.id} task={t} showAssignee={profile.role === 'admin'} />
          ))}
        </div>
      )}
    </div>
  );
}
