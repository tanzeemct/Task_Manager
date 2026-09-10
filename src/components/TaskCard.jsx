import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';
import { isOverdue } from '../lib/status';

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

export default function TaskCard({ task, showAssignee }) {
  const overdue = isOverdue(task);
  return (
    <Link to={`/task/${task.id}`} className="card">
      <div className="card-row" style={{ alignItems: 'flex-start' }}>
        <div className="row" style={{ flex: 1, minWidth: 0, alignItems: 'flex-start', gap: 10 }}>
          {showAssignee && <div className="avatar">{initials(task.assignee_name)}</div>}
          <div style={{ minWidth: 0 }}>
            <div className="card-title">{task.title}</div>
            <div className="card-meta">
              {showAssignee && task.assignee_name ? `${task.assignee_name} · ` : ''}
              {task.deadline
                ? `Due ${new Date(task.deadline).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}`
                : 'No deadline'}
            </div>
          </div>
        </div>
        <StatusBadge status={task.status} overdue={overdue} />
      </div>
    </Link>
  );
}
