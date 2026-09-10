import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { isOverdue } from '../lib/status';

export default function Reports() {
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [closings, setClosings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: t }, { data: u }, { data: c }] = await Promise.all([
        supabase.from('tasks').select('*, assignee:assigned_to(full_name)'),
        supabase.from('users').select('id, full_name').eq('active', true),
        supabase.from('monthly_closings').select('*, tasks(id, status)')
      ]);
      setTasks((t || []).map((x) => ({ ...x, assignee_name: x.assignee?.full_name })));
      setUsers(u || []);
      setClosings(c || []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  const overdue = tasks.filter(isOverdue).length;
  const awaitingApproval = tasks.filter((t) => t.status === 'awaiting_approval').length;
  const completed = tasks.filter((t) => t.status === 'approved').length;
  const pending = tasks.filter((t) => ['pending', 'accepted', 'in_progress', 'changes_requested'].includes(t.status)).length;

  return (
    <div className="app-page">
      <h1 className="page-title">Reports</h1>

      <div className="section">
        <div className="section-title">Team overview</div>
        <div className="kpi-grid">
          <Stat label="Total tasks" value={tasks.length} color="var(--color-text)" bg="var(--color-surface-alt)" />
          <Stat label="Completed" value={completed} color="#27500A" bg="#EAF3DE" />
          <Stat label="Pending / active" value={pending} color="#0C447C" bg="#E6F1FB" />
          <Stat label="Overdue" value={overdue} color="var(--color-danger-text)" bg="var(--color-danger-bg)" />
          <Stat label="Awaiting approval" value={awaitingApproval} color="#854F0B" bg="#FAEEDA" />
        </div>
      </div>

      <div className="section">
        <div className="section-title">Employee-wise</div>
        <div className="card-list">
          {users.map((u) => {
            const userTasks = tasks.filter((t) => t.assigned_to === u.id);
            const userCompleted = userTasks.filter((t) => t.status === 'approved').length;
            const userOverdue = userTasks.filter(isOverdue).length;
            return (
              <Link key={u.id} to={`/tasks?user=${u.id}`} className="card card-row">
                <span style={{ fontSize: 14 }}>{u.full_name}</span>
                <span className="card-meta" style={{ marginTop: 0 }}>
                  {userTasks.length} tasks · {userCompleted} done{userOverdue > 0 ? ` · ${userOverdue} overdue` : ''}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="section">
        <div className="section-title">Monthly closing summary</div>
        {closings.length === 0 && <div className="empty-state">No closings created yet.</div>}
        <div className="card-list">
          {closings.map((c) => {
            const total = c.tasks.length;
            const done = c.tasks.filter((t) => t.status === 'approved').length;
            return (
              <Link key={c.id} to={`/closing/${c.id}`} className="card card-row">
                <span style={{ fontSize: 14 }}>{c.title}</span>
                <span className="card-meta" style={{ marginTop: 0 }}>
                  {total ? Math.round((done / total) * 100) : 0}% ({done}/{total})
                </span>
              </Link>
            );
          })}
        </div>
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
