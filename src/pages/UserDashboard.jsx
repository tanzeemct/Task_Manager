import { Link } from 'react-router-dom';
import { useTasks } from '../lib/tasks';
import { isOverdue, primaryAction } from '../lib/status';
import TaskCard from '../components/TaskCard';

export default function UserDashboard({ profile }) {
  const { tasks, loading } = useTasks({ isAdmin: false, userId: profile.id });

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  const needsAction = tasks.filter((t) => primaryAction(t, profile.id, false));
  const overdue = tasks.filter(isOverdue);
  const dueToday = tasks.filter(
    (t) => t.deadline && new Date(t.deadline).toDateString() === new Date().toDateString()
  );
  const upcoming = tasks.filter(
    (t) => t.deadline && new Date(t.deadline) > new Date() && !dueToday.includes(t)
  );
  const recentlyCompleted = tasks.filter((t) => t.status === 'approved').slice(0, 5);

  return (
    <div className="app-page">
      <h1 className="page-title">Hi {profile.full_name}</h1>

      <Section title="Needs your action" tasks={needsAction} empty="Nothing needs your action right now." highlight />
      <Section title="Due today" tasks={dueToday} empty="Nothing due today." />
      <Section title="Overdue" tasks={overdue} empty="Nothing overdue." />
      <Section title="Upcoming" tasks={upcoming} empty="No upcoming tasks." />
      <Section title="Recently completed" tasks={recentlyCompleted} empty="No completed tasks yet." />

      <Link to="/create" className="btn-fab" aria-label="Ask admin / create task" title="Ask admin / create task">
        +
      </Link>
    </div>
  );
}

function Section({ title, tasks, empty, highlight }) {
  if (tasks.length === 0 && !highlight) return null;
  return (
    <div className="section">
      <div className="section-title">{title}</div>
      {tasks.length === 0 ? (
        <div className="empty-state">{empty}</div>
      ) : (
        <div className="card-list">
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
        </div>
      )}
    </div>
  );
}
