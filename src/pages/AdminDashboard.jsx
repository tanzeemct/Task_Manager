import { Link } from 'react-router-dom';
import { useTasks } from '../lib/tasks';
import { isOverdue } from '../lib/status';
import TaskCard from '../components/TaskCard';
import TaskRegisterTable from '../components/TaskRegisterTable';

export default function AdminDashboard({ profile }) {
  const { tasks, loading } = useTasks({ isAdmin: true, userId: profile.id });

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  const overdue = tasks.filter(isOverdue);
  const awaitingApproval = tasks.filter((t) => t.status === 'awaiting_approval');
  const inProgress = tasks.filter((t) => t.status === 'in_progress');
  const completedToday = tasks.filter(
    (t) => t.status === 'approved' && new Date(t.updated_at).toDateString() === new Date().toDateString()
  );

  const kpi = [
    { label: 'Overdue', value: overdue.length, color: 'var(--color-danger-text)', bg: 'var(--color-danger-bg)' },
    { label: 'Awaiting approval', value: awaitingApproval.length, color: '#854F0B', bg: '#FAEEDA' },
    { label: 'In progress', value: inProgress.length, color: '#0C447C', bg: '#E6F1FB' },
    { label: 'Completed today', value: completedToday.length, color: '#27500A', bg: '#EAF3DE' }
  ];

  return (
    <div className="app-page">
      <h1 className="page-title">Good morning, {profile.full_name}</h1>

      <div className="kpi-grid section">
        {kpi.map((k) => (
          <div key={k.label} className="kpi-card" style={{ background: k.bg, color: k.color }}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.value}</div>
          </div>
        ))}
      </div>

      <Section title="Awaiting your approval" tasks={awaitingApproval} empty="Nothing waiting on your review." />
      <Section title="Overdue" tasks={overdue} empty="All caught up — nothing overdue." />
      <Section
        title="Today's tasks"
        tasks={tasks.filter((t) => t.deadline && new Date(t.deadline).toDateString() === new Date().toDateString())}
        empty="Nothing due today."
      />

      <div className="section">
        <div className="section-title">ٹاسک رجسٹر</div>
        <TaskRegisterTable tasks={tasks} />
      </div>

      <Link to="/create" className="btn-fab" aria-label="Create task">
        +
      </Link>
    </div>
  );
}

function Section({ title, tasks, empty }) {
  return (
    <div className="section">
      <div className="section-title">{title}</div>
      {tasks.length === 0 ? (
        <div className="empty-state">{empty}</div>
      ) : (
        <div className="card-list">
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} showAssignee />
          ))}
        </div>
      )}
    </div>
  );
}
