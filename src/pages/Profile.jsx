import { useState } from 'react';
import { changePassword, signOut } from '../lib/auth';

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

export default function Profile({ profile }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleChangePassword(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords don’t match.');
      return;
    }
    setSaving(true);
    const { error: updateError } = await changePassword(newPassword);
    setSaving(false);
    if (updateError) {
      setError('Couldn’t update your password. Please try again.');
      return;
    }
    setSuccess('Password updated.');
    setNewPassword('');
    setConfirmPassword('');
  }

  return (
    <div className="app-page app-page--narrow">
      <h1 className="page-title">Account</h1>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="row" style={{ gap: 12 }}>
          <div className="avatar" style={{ width: 44, height: 44, fontSize: 15 }}>
            {initials(profile.full_name)}
          </div>
          <div>
            <div className="card-title">{profile.full_name}</div>
            <div className="card-meta" style={{ marginTop: 2 }}>
              {profile.role === 'admin' ? 'Admin' : 'User'}
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Change password</div>
        <form className="form-card" onSubmit={handleChangePassword}>
          <div className="field">
            <label className="field-label" htmlFor="new-password">
              New password
            </label>
            <input
              id="new-password"
              className="input"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
          </div>
          <div className="field" style={{ marginBottom: 6 }}>
            <label className="field-label" htmlFor="confirm-password">
              Confirm new password
            </label>
            <input
              id="confirm-password"
              className="input"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          {error && <div className="banner banner-error" style={{ marginTop: 12 }}>{error}</div>}
          {success && <div className="banner banner-success" style={{ marginTop: 12 }}>{success}</div>}

          <button type="submit" className="btn btn-primary btn-block" disabled={saving} style={{ marginTop: 12 }}>
            {saving ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>

      <button className="btn btn-danger btn-block" onClick={signOut}>
        Sign out
      </button>
    </div>
  );
}
