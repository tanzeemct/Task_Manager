import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function RecurringTasks({ profile }) {
  const [templates, setTemplates] = useState([]);
  const [users, setUsers] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: '',
    assigned_to: '',
    frequency: 'daily',
    interval_count: 1,
    default_time: '17:00',
    end_type: 'never',
    end_count: 10
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from('recurring_templates').select('*, assignee:assigned_to(full_name)').order('created_at', { ascending: false });
    setTemplates(data || []);
    const { data: u } = await supabase.from('users').select('id, full_name').eq('active', true).neq('id', profile.id);
    setUsers(u || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    if (!form.title.trim() || !form.assigned_to) {
      setError('Enter a title and choose who this recurs to.');
      return;
    }
    setSaving(true);
    const { error: insertError } = await supabase.from('recurring_templates').insert({
      title: form.title.trim(),
      assigned_to: form.assigned_to,
      created_by: profile.id,
      frequency: form.frequency,
      interval_count: Number(form.interval_count),
      default_time: form.default_time,
      end_type: form.end_type,
      end_count: form.end_type === 'after_count' ? Number(form.end_count) : null
    });
    setSaving(false);
    if (insertError) {
      setError('Couldn’t create the recurring task.');
      return;
    }
    setShowCreate(false);
    setForm({ title: '', assigned_to: '', frequency: 'daily', interval_count: 1, default_time: '17:00', end_type: 'never', end_count: 10 });
    load();
  }

  async function toggleActive(t) {
    await supabase.from('recurring_templates').update({ active: !t.active }).eq('id', t.id);
    load();
  }

  return (
    <div className="app-page">
      <h1 className="page-title">Recurring tasks</h1>

      {templates.length === 0 && <div className="empty-state" style={{ marginBottom: 14 }}>No recurring tasks set up yet.</div>}

      <div className="card-list">
        {templates.map((t) => (
          <div key={t.id} className="card">
            <div className="card-row">
              <div className="card-title">{t.title}</div>
              <button onClick={() => toggleActive(t)} className="btn btn-sm">
                {t.active ? 'Pause' : 'Resume'}
              </button>
            </div>
            <div className="card-meta">
              {t.frequency} · every {t.interval_count} · assigned to {t.assignee?.full_name} · {t.occurrences_created} created
            </div>
          </div>
        ))}
      </div>

      {!showCreate ? (
        <button onClick={() => setShowCreate(true)} className="btn btn-block" style={{ marginTop: 12 }}>
          + New recurring task
        </button>
      ) : (
        <form onSubmit={handleCreate} className="form-card" style={{ marginTop: 12 }}>
          <div className="field">
            <label className="field-label" htmlFor="rt-title">
              Title
            </label>
            <input
              id="rt-title"
              className="input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Daily cash closing"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="rt-assignee">
              Assign to
            </label>
            <select id="rt-assignee" className="select" value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}>
              <option value="">Choose a person</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="rt-frequency">
              Repeat
            </label>
            <select id="rt-frequency" className="select" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="custom">Custom (days)</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="rt-interval">
              Every
            </label>
            <input
              id="rt-interval"
              className="input"
              type="number"
              min="1"
              value={form.interval_count}
              onChange={(e) => setForm({ ...form, interval_count: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="rt-time">
              Due time each occurrence
            </label>
            <input
              id="rt-time"
              className="input"
              type="time"
              value={form.default_time}
              onChange={(e) => setForm({ ...form, default_time: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="rt-end">
              Ends
            </label>
            <select id="rt-end" className="select" value={form.end_type} onChange={(e) => setForm({ ...form, end_type: e.target.value })}>
              <option value="never">Never</option>
              <option value="after_count">After a number of occurrences</option>
            </select>
          </div>
          {form.end_type === 'after_count' && (
            <div className="field">
              <input
                className="input"
                type="number"
                min="1"
                value={form.end_count}
                onChange={(e) => setForm({ ...form, end_count: e.target.value })}
              />
            </div>
          )}
          {error && <div className="banner banner-error">{error}</div>}
          <div className="row">
            <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>
              {saving ? 'Creating…' : 'Create'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="btn">
              Cancel
            </button>
          </div>
        </form>
      )}
      <p className="field-hint" style={{ marginTop: 14 }}>
        Next occurrences are generated when an Admin opens the app (see README for upgrading this to a true background schedule).
      </p>
    </div>
  );
}
