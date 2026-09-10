// Single source of truth for how each status is labeled and colored.
// Every screen imports from here so the visual system stays consistent.
export const STATUS_META = {
  pending: { label: 'Pending', color: '#854F0B', bg: '#FAEEDA', icon: '○' },
  accepted: { label: 'Accepted', color: '#0C447C', bg: '#E6F1FB', icon: '◐' },
  in_progress: { label: 'In progress', color: '#0C447C', bg: '#E6F1FB', icon: '▶' },
  completed: { label: 'Completed', color: '#085041', bg: '#E1F5EE', icon: '✓' },
  awaiting_approval: { label: 'Awaiting approval', color: '#854F0B', bg: '#FAEEDA', icon: '⏳' },
  approved: { label: 'Approved', color: '#27500A', bg: '#EAF3DE', icon: '✓✓' },
  rejected: { label: 'Rejected', color: '#791F1F', bg: '#FCEBEB', icon: '✕' },
  changes_requested: { label: 'Changes requested', color: '#854F0B', bg: '#FAEEDA', icon: '↺' },
  cancelled: { label: 'Cancelled', color: '#444441', bg: '#F1EFE8', icon: '⊘' },
  extension_requested: { label: 'Extension requested', color: '#854F0B', bg: '#FAEEDA', icon: '⏱' }
};

export function isOverdue(task) {
  if (!task.deadline) return false;
  if (['approved', 'cancelled'].includes(task.status)) return false;
  return new Date(task.deadline) < new Date();
}

// The one primary action a given viewer can take on a task right now,
// or null if it's not actionable by them at this status.
export function primaryAction(task, viewerId, isAdmin) {
  const isAssignee = task.assigned_to === viewerId;
  const isCreatorOrAdmin = task.created_by === viewerId || isAdmin;

  if (isAssignee) {
    if (task.status === 'pending') return { key: 'accept', label: 'Accept task' };
    if (task.status === 'accepted') return { key: 'start', label: 'Start task' };
    if (task.status === 'in_progress') return { key: 'complete', label: 'Mark complete' };
    if (task.status === 'changes_requested') return { key: 'complete', label: 'Resubmit' };
  }
  // A person who is BOTH the assignee and an Admin (e.g. Admin completing a
  // task a User assigned to them) can never approve their own submission —
  // the database rejects it (see migration_003.sql), so the button must
  // never appear for that case either, or it would fail every time it's clicked.
  if (isCreatorOrAdmin && !isAssignee && task.status === 'awaiting_approval') {
    return { key: 'approve', label: 'Approve & finalize' };
  }
  return null;
}
