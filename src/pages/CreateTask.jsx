import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { createTask } from '../lib/tasks';
import { shareTaskToWhatsApp } from '../lib/share';

export default function CreateTask({ profile }) {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [title, setTitle] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [deadline, setDeadline] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [proofRequired, setProofRequired] = useState(false);
  const [requiresChecklistResponse, setRequiresChecklistResponse] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [createdTask, setCreatedTask] = useState(null);

  useEffect(() => {
    async function loadUsers() {
      const { data } = await supabase.from('users').select('id, full_name, role').eq('active', true);
      setUsers(data || []);
      if (profile.role === 'user') {
        const admin = (data || []).find((u) => u.role === 'admin');
        if (admin) setAssignedTo(admin.id);
      }
    }
    loadUsers();
  }, [profile.role]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!title.trim() || !assignedTo) {
      setError('Enter a title and choose who this is assigned to.');
      return;
    }
    setSaving(true);
    const { data, error: insertError } = await createTask({
      title: title.trim(),
      description: description.trim() || null,
      created_by: profile.id,
      assigned_to: assignedTo,
      priority,
      proof_required: proofRequired,
      requires_checklist_response: requiresChecklistResponse,
      deadline: deadline ? new Date(deadline).toISOString() : null
    });
    setSaving(false);
    if (insertError) {
      setError('Couldn’t create the task. Please try again.');
      return;
    }
    setCreatedTask(data);
  }

  if (createdTask) {
    return (
      <div className="app-page">
        <div className="form-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>✓</div>
          <div className="card-title" style={{ marginBottom: 4 }}>
            Task created
          </div>
          <p className="card-meta" style={{ marginBottom: 20 }}>
            &ldquo;{createdTask.title}&rdquo; is ready to go. Let them know on WhatsApp, or just leave it — they'll also see it in-app.
          </p>
          <button
            type="button"
            className="btn btn-block"
            onClick={() => shareTaskToWhatsApp(createdTask)}
            style={{ color: '#25d366', borderColor: '#25d366', marginBottom: 10 }}
          >
            ⤴ Send via WhatsApp
          </button>
          <button type="button" className="btn btn-primary btn-block" onClick={() => navigate('/')}>
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page">
      <h1 className="page-title">{profile.role === 'user' ? 'Ask admin' : 'Create task'}</h1>
      <form className="form-card" onSubmit={handleSubmit}>
        <div className="field">
          <label className="field-label" htmlFor="task-title">
            Title
          </label>
          <input
            id="task-title"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Prepare September sales report"
          />
        </div>

        {profile.role === 'admin' && (
          <div className="field">
            <label className="field-label" htmlFor="task-assignee">
              Assign to
            </label>
            <select id="task-assignee" className="select" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
              <option value="">Choose a person</option>
              {users
                .filter((u) => u.id !== profile.id)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} {u.role === 'admin' ? '(Admin)' : ''}
                  </option>
                ))}
            </select>
          </div>
        )}

        <div className="field">
          <label className="field-label" htmlFor="task-deadline">
            Deadline (optional)
          </label>
          <input
            id="task-deadline"
            className="input"
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>

        <div className="link-action" style={{ marginBottom: 14 }} onClick={() => setShowMore(!showMore)}>
          {showMore ? 'Hide details' : '+ Add details (optional)'}
        </div>

        {showMore && (
          <>
            <div className="field">
              <label className="field-label" htmlFor="task-description">
                Description / instructions
              </label>
              <textarea
                id="task-description"
                className="textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="task-priority">
                Priority
              </label>
              <select id="task-priority" className="select" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </div>
            <label className="checkbox-row field">
              <input type="checkbox" checked={proofRequired} onChange={(e) => setProofRequired(e.target.checked)} />
              Proof required (attachment needed before approval)
            </label>
            <label className="checkbox-row field">
              <input
                type="checkbox"
                checked={requiresChecklistResponse}
                onChange={(e) => setRequiresChecklistResponse(e.target.checked)}
              />
              Checklist response (assignee must answer Yes, No, or give an explanation)
            </label>
          </>
        )}

        {error && <div className="banner banner-error">{error}</div>}

        <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
          {saving ? 'Creating…' : 'Create task'}
        </button>
      </form>
    </div>
  );
}
