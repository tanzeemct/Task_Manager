import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import TaskCard from '../components/TaskCard';
import { isOverdue } from '../lib/status';

export default function MonthlyClosingDetail() {
  const { id } = useParams();
  const [closing, setClosing] = useState(null);
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    async function load() {
      const { data: c } = await supabase.from('monthly_closings').select('*').eq('id', id).single();
      const { data: t } = await supabase
        .from('tasks')
        .select('*, assignee:assigned_to(full_name)')
        .eq('closing_id', id)
        .order('closing_order');
      setClosing(c);
      setTasks((t || []).map((x) => ({ ...x, assignee_name: x.assignee?.full_name })));
    }
    load();
  }, [id]);

  if (!closing) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  const total = tasks.length;
  const approved = tasks.filter((t) => t.status === 'approved').length;
  const overdue = tasks.filter(isOverdue).length;
  const awaiting = tasks.filter((t) => t.status === 'awaiting_approval').length;
  const pending = total - approved - overdue - awaiting;
  const pct = total ? Math.round((approved / total) * 100) : 0;

  return (
    <div className="app-page">
      <h1 className="page-title" style={{ marginBottom: 4 }}>
        {closing.title}
      </h1>
      <div className="card-meta" style={{ marginBottom: 10 }}>
        {approved} of {total} items done
      </div>
      <div className="progress-track" style={{ marginBottom: 6 }}>
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div style={{ textAlign: 'right', fontSize: 21, fontWeight: 600, marginBottom: 18 }}>{pct}%</div>

      <div className="kpi-grid section">
        <Stat label="Completed" value={approved} color="#27500A" bg="#EAF3DE" />
        <Stat label="Pending" value={Math.max(pending, 0)} color="var(--color-text)" bg="var(--color-surface-alt)" />
        <Stat label="Overdue" value={overdue} color="var(--color-danger-text)" bg="var(--color-danger-bg)" />
        <Stat label="Awaiting approval" value={awaiting} color="#854F0B" bg="#FAEEDA" />
      </div>

      <div className="card-list">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} showAssignee />
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, color, bg }) {
  return (
    <div className="kpi-card" style={{ background: bg, color }}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}
