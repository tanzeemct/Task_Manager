import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function MonthlyClosing({ profile }) {
  const [closings, setClosings] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  async function load() {
    const { data } = await supabase
      .from('monthly_closings')
      .select('*, tasks(id, status)')
      .order('created_at', { ascending: false });
    setClosings(data || []);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="app-page">
      <h1 className="page-title">Monthly closing</h1>

      {closings.length === 0 && <div className="empty-state" style={{ marginBottom: 14 }}>No closing started this month.</div>}

      <div className="card-list">
        {closings.map((c) => {
          const total = c.tasks.length;
          const approved = c.tasks.filter((t) => t.status === 'approved').length;
          const pct = total ? Math.round((approved / total) * 100) : 0;
          return (
            <Link key={c.id} to={`/closing/${c.id}`} className="card">
              <div className="card-title" style={{ marginBottom: 8 }}>
                {c.title}
              </div>
              <div className="progress-track" style={{ marginBottom: 5 }}>
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="card-meta">
                {pct}% complete ({approved}/{total})
              </div>
            </Link>
          );
        })}
      </div>

      {profile.role === 'admin' &&
        (!showCreate ? (
          <button onClick={() => setShowCreate(true)} className="btn btn-block" style={{ marginTop: 12 }}>
            + Create closing
          </button>
        ) : (
          <CreateClosingForm profile={profile} onDone={(id) => navigate(`/closing/${id}`)} onCancel={() => setShowCreate(false)} />
        ))}
    </div>
  );
}

function CreateClosingForm({ profile, onDone, onCancel }) {
  const [title, setTitle] = useState('');
  const [users, setUsers] = useState([]);
  const [items, setItems] = useState([{ title: '', assigned_to: '' }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase
      .from('users')
      .select('id, full_name')
      .eq('active', true)
      .neq('id', profile.id)
      .then(({ data }) => setUsers(data || []));
  }, [profile.id]);

  function updateItem(i, field, value) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    const validItems = items.filter((it) => it.title.trim() && it.assigned_to);
    if (!title.trim() || validItems.length === 0) {
      setError('Enter a title and at least one checklist item with an assignee.');
      return;
    }
    setSaving(true);
    const { data: closing, error: closingError } = await supabase
      .from('monthly_closings')
      .insert({ title: title.trim(), created_by: profile.id })
      .select()
      .single();

    if (closingError) {
      setSaving(false);
      setError('Couldn’t create the closing.');
      return;
    }

    const rows = validItems.map((it, idx) => ({
      title: it.title.trim(),
      created_by: profile.id,
      assigned_to: it.assigned_to,
      closing_id: closing.id,
      closing_order: idx
    }));
    await supabase.from('tasks').insert(rows);
    setSaving(false);
    onDone(closing.id);
  }

  return (
    <form onSubmit={handleCreate} className="form-card" style={{ marginTop: 12 }}>
      <div className="field">
        <label className="field-label" htmlFor="closing-title">
          Closing title
        </label>
        <input
          id="closing-title"
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="September 2026 closing"
        />
      </div>
      <div className="field-label">Checklist items</div>
      <div className="stack" style={{ marginBottom: 10 }}>
        {items.map((it, i) => (
          <div key={i} className="row">
            <input
              className="input"
              value={it.title}
              onChange={(e) => updateItem(i, 'title', e.target.value)}
              placeholder="Cash report"
              style={{ flex: 2 }}
            />
            <select className="select" value={it.assigned_to} onChange={(e) => updateItem(i, 'assigned_to', e.target.value)} style={{ flex: 1 }}>
              <option value="">Assign to</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div className="link-action" style={{ marginBottom: 14 }} onClick={() => setItems([...items, { title: '', assigned_to: '' }])}>
        + Add item
      </div>
      {error && <div className="banner banner-error">{error}</div>}
      <div className="row">
        <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>
          {saving ? 'Creating…' : 'Create closing'}
        </button>
        <button type="button" onClick={onCancel} className="btn">
          Cancel
        </button>
      </div>
    </form>
  );
}
