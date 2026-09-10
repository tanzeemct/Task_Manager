import { STATUS_META } from '../lib/status';

export default function StatusBadge({ status, overdue }) {
  const meta = STATUS_META[status] || STATUS_META.pending;
  return (
    <span className="row" style={{ gap: 6 }}>
      <span className="badge" style={{ background: meta.bg, color: meta.color }}>
        {meta.icon} {meta.label}
      </span>
      {overdue && (
        <span className="badge" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)' }}>
          ⚠ Overdue
        </span>
      )}
    </span>
  );
}
