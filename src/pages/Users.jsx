import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { createUserDirectly, resetUserPassword } from '../lib/adminUsers';

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

export default function Users({ profile }) {
  const [users, setUsers] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [method, setMethod] = useState('direct'); // 'direct' | 'invite'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [resetTarget, setResetTarget] = useState(null); // user id whose "reset password" form is open
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSaving, setResetSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from('users').select('*').order('full_name');
    setUsers(data || []);
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setName('');
    setEmail('');
    setPassword('');
    setRole('user');
    setShowAdd(false);
  }

  async function createDirect(e) {
    e.preventDefault();
    setStatus('');
    if (!name.trim() || !email.trim() || password.length < 6) {
      setStatus('error:Enter a name, email, and a password of at least 6 characters.');
      return;
    }
    setSaving(true);
    const { error } = await createUserDirectly({ fullName: name.trim(), email: email.trim().toLowerCase(), password, role });
    setSaving(false);
    if (error) {
      setStatus(`error:${error}`);
      return;
    }
    setStatus(`success:${name} can now sign in with the email and password you set.`);
    resetForm();
    load();
  }

  async function sendInvite(e) {
    e.preventDefault();
    setStatus('');
    if (!name.trim() || !email.trim()) {
      setStatus('error:Enter a name and email.');
      return;
    }
    setSaving(true);
    const { error: insertError } = await supabase
      .from('pending_invites')
      .upsert({ email: email.trim().toLowerCase(), full_name: name.trim(), role, invited_by: profile.id });

    if (insertError) {
      setSaving(false);
      setStatus('error:Couldn’t save the invite. Please try again.');
      return;
    }

    const { error: otpError } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase() });
    setSaving(false);
    if (otpError) {
      setStatus('error:Invite saved, but the sign-in email couldn’t be sent. Ask them to try signing in with this email directly.');
      return;
    }
    setStatus(`success:Invite sent to ${email}. They'll get an email with a sign-in link.`);
    resetForm();
  }

  async function toggleActive(user) {
    await supabase.from('users').update({ active: !user.active }).eq('id', user.id);
    load();
  }

  function openReset(userId) {
    setResetTarget(userId);
    setResetPassword('');
    setResetError('');
  }

  async function submitReset(e, userId) {
    e.preventDefault();
    setResetError('');
    if (resetPassword.length < 6) {
      setResetError('Password must be at least 6 characters.');
      return;
    }
    setResetSaving(true);
    const { error } = await resetUserPassword(userId, resetPassword);
    setResetSaving(false);
    if (error) {
      setResetError(error);
      return;
    }
    setResetTarget(null);
    setResetPassword('');
    setStatus('success:Password updated. Share the new password with them yourself.');
  }

  return (
    <div className="app-page">
      <h1 className="page-title">Team</h1>

      {status && (
        <div className={`banner ${status.startsWith('error') ? 'banner-error' : 'banner-success'}`}>
          {status.split(':').slice(1).join(':')}
        </div>
      )}

      <div className="card-list">
        {users.map((u) => (
          <div key={u.id} className="card">
            <div className="card-row">
              <div className="row" style={{ gap: 10 }}>
                <div className="avatar">{initials(u.full_name)}</div>
                <div>
                  <Link to={`/tasks?user=${u.id}`} className="card-title" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                    {u.full_name}
                  </Link>
                  <div className="card-meta">{u.email || '—'}</div>
                  <div className="card-meta">
                    {u.role === 'admin' ? 'Admin' : 'User'} · {u.active ? 'Active' : 'Deactivated'}
                  </div>
                </div>
              </div>
              <div className="stack" style={{ gap: 6, alignItems: 'flex-end' }}>
                <button onClick={() => openReset(u.id)} className="btn btn-sm">
                  Reset password
                </button>
                {u.id !== profile.id && (
                  <button onClick={() => toggleActive(u)} className={`btn btn-sm ${u.active ? 'btn-danger' : ''}`}>
                    {u.active ? 'Deactivate' : 'Reactivate'}
                  </button>
                )}
              </div>
            </div>

            {resetTarget === u.id && (
              <form onSubmit={(e) => submitReset(e, u.id)} style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
                <div className="field" style={{ marginBottom: resetError ? 8 : 10 }}>
                  <label className="field-label" htmlFor={`reset-pw-${u.id}`}>
                    New password for {u.full_name}
                  </label>
                  <input
                    id={`reset-pw-${u.id}`}
                    className="input"
                    type="password"
                    autoComplete="new-password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="At least 6 characters"
                  />
                </div>
                {resetError && <div className="banner banner-error" style={{ marginBottom: 10 }}>{resetError}</div>}
                <div className="row">
                  <button type="submit" disabled={resetSaving} className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                    {resetSaving ? 'Saving…' : 'Save new password'}
                  </button>
                  <button type="button" className="btn btn-sm" onClick={() => setResetTarget(null)}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        ))}
      </div>

      {!showAdd ? (
        <button onClick={() => setShowAdd(true)} className="btn btn-block" style={{ marginTop: 14 }}>
          + Add team member
        </button>
      ) : (
        <div className="form-card" style={{ marginTop: 14 }}>
          <div className="row" style={{ marginBottom: 14, gap: 6 }}>
            <button
              type="button"
              className={`btn btn-sm ${method === 'direct' ? 'btn-primary' : ''}`}
              style={{ flex: 1 }}
              onClick={() => setMethod('direct')}
            >
              Create with password
            </button>
            <button
              type="button"
              className={`btn btn-sm ${method === 'invite' ? 'btn-primary' : ''}`}
              style={{ flex: 1 }}
              onClick={() => setMethod('invite')}
            >
              Send email invite
            </button>
          </div>

          <form onSubmit={method === 'direct' ? createDirect : sendInvite}>
            <div className="field">
              <label className="field-label" htmlFor="add-name">
                Name
              </label>
              <input id="add-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="add-email">
                Email
              </label>
              <input
                id="add-email"
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
              />
            </div>
            {method === 'direct' && (
              <div className="field">
                <label className="field-label" htmlFor="add-password">
                  Password
                </label>
                <input
                  id="add-password"
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                />
              </div>
            )}
            <div className="field">
              <label className="field-label" htmlFor="add-role">
                Role
              </label>
              <select id="add-role" className="select" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="row">
              <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>
                {saving ? 'Saving…' : method === 'direct' ? 'Create account' : 'Send invite'}
              </button>
              <button type="button" onClick={resetForm} className="btn">
                Cancel
              </button>
            </div>
            <p className="field-hint" style={{ marginTop: 10 }}>
              {method === 'direct'
                ? 'They can sign in immediately with this email and password — share it with them yourself (e.g. via WhatsApp).'
                : "They'll receive a sign-in link by email — no password to set up manually."}
            </p>
          </form>
        </div>
      )}
    </div>
  );
}
