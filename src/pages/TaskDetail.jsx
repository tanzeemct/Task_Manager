import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchTaskWithDetails, updateTaskStatus, addComment, submitChecklistResponse } from '../lib/tasks';
import { supabase } from '../lib/supabaseClient';
import StatusBadge from '../components/StatusBadge';
import { isOverdue, primaryAction } from '../lib/status';
import { shareTaskToWhatsApp } from '../lib/share';

export default function TaskDetail({ profile }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ task: null, comments: [], attachments: [], history: [] });
  const [loading, setLoading] = useState(true);
  const [notFoundOrDenied, setNotFoundOrDenied] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showExtensionForm, setShowExtensionForm] = useState(false);
  const [extensionReason, setExtensionReason] = useState('');
  const [extensionDate, setExtensionDate] = useState('');
  const [actionError, setActionError] = useState('');
  const [showExplainForm, setShowExplainForm] = useState(false);
  const [explainText, setExplainText] = useState('');

  async function load() {
    setLoading(true);
    const result = await fetchTaskWithDetails(id);
    if (result.error || !result.task) {
      setNotFoundOrDenied(true);
    } else {
      setState(result);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }
  if (notFoundOrDenied) {
    return (
      <div className="app-page" style={{ textAlign: 'center', paddingTop: 48 }}>
        <p style={{ fontSize: 15 }}>You don&rsquo;t have access to this task.</p>
        <p className="card-meta">If this link was forwarded to you, ask the task owner to assign it to you directly.</p>
      </div>
    );
  }

  const { task, comments, attachments, history } = state;
  const overdue = isOverdue(task);
  const action = primaryAction(task, profile.id, profile.role === 'admin');
  const isAssignee = task.assigned_to === profile.id;
  const isCreatorOrAdmin = task.created_by === profile.id || profile.role === 'admin';

  async function doAction(key) {
    setBusy(true);
    const map = { accept: 'accepted', start: 'in_progress', complete: 'awaiting_approval', approve: 'approved' };
    const { error: actionErr } = await updateTaskStatus(task.id, map[key]);
    if (actionErr) setActionError('Couldn’t save that action. Please refresh and try again.');
    await load();
    setBusy(false);
  }

  async function doReject() {
    setBusy(true);
    const status = task.status === 'awaiting_approval' ? 'changes_requested' : 'rejected';
    const { error: actionError } = await updateTaskStatus(task.id, status);
    if (actionError) setActionError('Couldn’t save that action. Please refresh and try again.');
    await load();
    setBusy(false);
  }

  async function submitExtensionRequest(e) {
    e.preventDefault();
    if (!extensionReason.trim() || !extensionDate) return;
    setBusy(true);
    const { error: actionErr } = await updateTaskStatus(task.id, 'extension_requested', {
      previous_status: task.status,
      extension_reason: extensionReason.trim(),
      extension_requested_date: new Date().toISOString(),
      requested_new_deadline: new Date(extensionDate).toISOString()
    });
    if (actionErr) setActionError('Couldn’t submit the request. Please try again.');
    setShowExtensionForm(false);
    setExtensionReason('');
    setExtensionDate('');
    await load();
    setBusy(false);
  }

  async function decideExtension(approve) {
    setBusy(true);
    const { error: actionErr } = approve
      ? await updateTaskStatus(task.id, task.previous_status || 'in_progress', { deadline: task.requested_new_deadline })
      : await updateTaskStatus(task.id, task.previous_status || 'in_progress');
    if (actionErr) setActionError('Couldn’t save that decision. Please try again.');
    await load();
    setBusy(false);
  }

  async function answerChecklist(response, note) {
    setBusy(true);
    setActionError('');
    const { error: responseErr } = await submitChecklistResponse(task.id, profile.id, response, note);
    if (responseErr) setActionError('Couldn’t save that answer. Please try again.');
    setShowExplainForm(false);
    setExplainText('');
    await load();
    setBusy(false);
  }

  async function submitComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    const { error: commentErr } = await addComment(task.id, profile.id, commentText.trim());
    if (commentErr) {
      setActionError('Couldn’t post that comment. Please try again.');
      return;
    }
    setCommentText('');
    await load();
  }

  const ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.ms-excel'
  ];
  const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB — matches the server-side bucket limit

  async function uploadFile(e) {
    const file = e.target.files[0];
    e.target.value = ''; // allow re-selecting the same file name after an error
    if (!file) return;
    setActionError('');

    if (file.size > MAX_FILE_BYTES) {
      setActionError('That file is too large — the limit is 10MB.');
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setActionError('That file type isn’t supported. Use an image, PDF, Word, or Excel file.');
      return;
    }

    setBusy(true);
    const path = `${task.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('task-attachments').upload(path, file);
    if (uploadError) {
      setActionError('Couldn’t upload that file. Please check your connection and try again.');
    } else {
      const { error: insertError } = await supabase.from('attachments').insert({
        task_id: task.id,
        uploaded_by: profile.id,
        file_path: path,
        file_name: file.name,
        file_size: file.size
      });
      if (insertError) setActionError('File uploaded, but couldn’t be linked to the task. Please try again.');
    }
    await load();
    setBusy(false);
  }

  async function openAttachment(attachment) {
    // Signed URL, not a public link — expires in 60s and only issuable to
    // someone the storage policy already lets read this path (see migration_003.sql).
    const { data, error: signError } = await supabase.storage
      .from('task-attachments')
      .createSignedUrl(attachment.file_path, 60);
    if (signError || !data?.signedUrl) {
      setActionError('Couldn’t open that file. Please try again.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  async function deleteAttachment(attachment) {
    setBusy(true);
    setActionError('');
    // Database row first (this also re-checks permission via RLS), then the file itself.
    const { error: deleteRowError } = await supabase.from('attachments').delete().eq('id', attachment.id);
    if (deleteRowError) {
      setActionError('Couldn’t delete that file — it may already be locked because the task is finalized.');
      setBusy(false);
      return;
    }
    await supabase.storage.from('task-attachments').remove([attachment.file_path]);
    await load();
    setBusy(false);
  }

  return (
    <div className="app-page" style={{ paddingBottom: 110 }}>
      <button onClick={() => navigate(-1)} className="muted-link" style={{ marginBottom: 10, fontSize: 13 }}>
        ← Back
      </button>

      <div className="card-row" style={{ alignItems: 'flex-start' }}>
        <StatusBadge status={task.status} overdue={overdue} />
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => shareTaskToWhatsApp(task)}
          style={{ color: '#25d366', borderColor: '#25d366', flexShrink: 0 }}
        >
          ⤴ WhatsApp
        </button>
      </div>
      <h1 style={{ fontSize: 19, fontWeight: 600, margin: '10px 0 4px', letterSpacing: '-0.01em' }}>{task.title}</h1>
      <div className="card-meta" style={{ marginBottom: 16 }}>
        Assigned by {task.creator_name} · to {task.assignee_name}
      </div>

      {actionError && <div className="banner banner-error">{actionError}</div>}

      {task.deadline && (
        <div className="banner banner-warning">
          Due {new Date(task.deadline).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
        </div>
      )}

      {task.status === 'extension_requested' && (
        <div className="banner banner-warning" style={{ padding: '12px 13px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Extension requested</div>
          <div style={{ fontSize: 13 }}>&ldquo;{task.extension_reason}&rdquo;</div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
            Proposed new deadline: {new Date(task.requested_new_deadline).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
          </div>
          {isCreatorOrAdmin && (
            <div className="row" style={{ marginTop: 10 }}>
              <button disabled={busy} onClick={() => decideExtension(true)} className="btn btn-primary btn-sm" style={{ flex: 1, height: 36 }}>
                Approve extension
              </button>
              <button disabled={busy} onClick={() => decideExtension(false)} className="btn btn-sm" style={{ flex: 1, height: 36 }}>
                Deny
              </button>
            </div>
          )}
        </div>
      )}

      {showExtensionForm && (
        <form onSubmit={submitExtensionRequest} className="form-card" style={{ marginBottom: 14 }}>
          <div className="field">
            <label className="field-label" htmlFor="ext-reason">
              Reason
            </label>
            <textarea id="ext-reason" className="textarea" value={extensionReason} onChange={(e) => setExtensionReason(e.target.value)} rows={2} />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field-label" htmlFor="ext-date">
              Requested new deadline
            </label>
            <input
              id="ext-date"
              className="input"
              type="datetime-local"
              value={extensionDate}
              onChange={(e) => setExtensionDate(e.target.value)}
            />
          </div>
          <div className="row">
            <button type="submit" disabled={busy} className="btn btn-primary" style={{ flex: 1 }}>
              Submit request
            </button>
            <button type="button" onClick={() => setShowExtensionForm(false)} className="btn">
              Cancel
            </button>
          </div>
        </form>
      )}

      {task.description && <p style={{ fontSize: 14, color: 'var(--color-text)', lineHeight: 1.6, marginBottom: 20 }}>{task.description}</p>}

      {task.requires_checklist_response && (
        <div className="section">
          <div className="section-title">Checklist response</div>
          {task.checklist_response ? (
            <div className="form-card">
              <div className="row" style={{ marginBottom: task.checklist_response_note ? 6 : 0 }}>
                <span
                  className="badge"
                  style={
                    task.checklist_response === 'yes'
                      ? { background: '#EAF3DE', color: '#27500A' }
                      : task.checklist_response === 'no'
                        ? { background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)' }
                        : { background: '#E6F1FB', color: '#0C447C' }
                  }
                >
                  {task.checklist_response === 'yes' ? 'Yes' : task.checklist_response === 'no' ? 'No' : 'Explanation'}
                </span>
              </div>
              {task.checklist_response_note && <p style={{ fontSize: 13.5, lineHeight: 1.5 }}>{task.checklist_response_note}</p>}
            </div>
          ) : isAssignee || profile.role === 'admin' ? (
            <div className="form-card">
              <p className="card-meta" style={{ marginBottom: 12 }}>This task needs a Yes, No, or written explanation.</p>
              {!showExplainForm ? (
                <div className="row">
                  <button disabled={busy} className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => answerChecklist('yes')}>
                    Yes
                  </button>
                  <button disabled={busy} className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={() => answerChecklist('no')}>
                    No
                  </button>
                  <button disabled={busy} className="btn btn-sm" style={{ flex: 1 }} onClick={() => setShowExplainForm(true)}>
                    Explain
                  </button>
                </div>
              ) : (
                <div>
                  <textarea
                    className="textarea"
                    rows={3}
                    value={explainText}
                    onChange={(e) => setExplainText(e.target.value)}
                    placeholder="Write your explanation…"
                    style={{ marginBottom: 10 }}
                  />
                  <div className="row">
                    <button
                      disabled={busy || !explainText.trim()}
                      className="btn btn-primary"
                      style={{ flex: 1 }}
                      onClick={() => answerChecklist('explanation', explainText.trim())}
                    >
                      Submit
                    </button>
                    <button className="btn" onClick={() => setShowExplainForm(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">Waiting on {task.assignee_name}&rsquo;s response.</div>
          )}
        </div>
      )}

      <div className="section">
        <div className="section-title">Attachments</div>
        {attachments.length === 0 && <div className="empty-state" style={{ marginBottom: 10 }}>None yet.</div>}
        <div className="stack" style={{ marginBottom: 10 }}>
          {attachments.map((a) => {
            const canDelete = (a.uploaded_by === profile.id || profile.role === 'admin') && task.status !== 'approved';
            return (
              <div key={a.id} className="row" style={{ fontSize: 13 }}>
                📎{' '}
                <span style={{ color: 'var(--color-primary)', cursor: 'pointer', flex: 1 }} onClick={() => openAttachment(a)}>
                  {a.file_name}
                </span>
                {canDelete && (
                  <span className="text-danger" style={{ cursor: 'pointer', fontSize: 12 }} onClick={() => deleteAttachment(a)}>
                    Delete
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <input type="file" onChange={uploadFile} style={{ fontSize: 13 }} />
      </div>

      <div className="section">
        <div className="section-title">Comments</div>
        <div className="stack" style={{ marginBottom: 12 }}>
          {comments.map((c) => (
            <div key={c.id} style={{ fontSize: 13 }}>
              <b>{c.author?.full_name}:</b> {c.message}
            </div>
          ))}
        </div>
        <form onSubmit={submitComment} className="row">
          <input
            className="input"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment"
            style={{ flex: 1, height: 40 }}
          />
          <button type="submit" className="btn btn-primary" style={{ height: 40 }}>
            Send
          </button>
        </form>
      </div>

      <div className="link-action" style={{ marginBottom: 18 }} onClick={() => setShowHistory(!showHistory)}>
        {showHistory ? 'Hide' : 'Show'} full activity history
      </div>
      {showHistory && (
        <div className="stack">
          {history.map((h) => (
            <div key={h.id} style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              {new Date(h.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} — {h.actor?.full_name} {h.action}
            </div>
          ))}
        </div>
      )}

      {/* Sticky action bar */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'color-mix(in srgb, var(--color-surface) 92%, transparent)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderTop: '1px solid var(--color-border)',
          padding: 12,
          display: 'flex',
          gap: 10,
          zIndex: 15
        }}
      >
        {action && (
          <button disabled={busy} onClick={() => doAction(action.key)} className="btn btn-primary" style={{ flex: 1, height: 46 }}>
            {action.label}
          </button>
        )}
        {task.status === 'awaiting_approval' && isCreatorOrAdmin && !isAssignee && (
          <button disabled={busy} onClick={doReject} className="btn" style={{ flex: 1, height: 46 }}>
            Request changes
          </button>
        )}
        {isAssignee && ['pending', 'accepted'].includes(task.status) && (
          <button disabled={busy} onClick={doReject} className="btn btn-danger" style={{ height: 46 }}>
            Reject
          </button>
        )}
        {isAssignee && ['accepted', 'in_progress'].includes(task.status) && !showExtensionForm && (
          <button disabled={busy} onClick={() => setShowExtensionForm(true)} className="btn" style={{ height: 46 }}>
            Need more time
          </button>
        )}
      </div>
    </div>
  );
}
