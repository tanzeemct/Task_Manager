import { useState } from 'react';
import { changePassword } from '../lib/auth';

export default function ResetPassword({ onDone }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords don’t match.');
      return;
    }
    setSaving(true);
    const { error: updateError } = await changePassword(password);
    setSaving(false);
    if (updateError) {
      setError('Couldn’t update your password. Please try again.');
      return;
    }
    setSuccess(true);
  }

  return (
    <div className="app-page app-page--narrow app-page--centered" style={{ minHeight: '100vh' }}>
      <div style={{ width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            className="topbar-brand-mark"
            style={{ width: 44, height: 44, borderRadius: 12, fontSize: 19, margin: '0 auto 14px' }}
          >
            T
          </div>
          <h1 style={{ fontSize: 21, fontWeight: 600, letterSpacing: '-0.01em' }}>Set a new password</h1>
        </div>

        {success ? (
          <div className="form-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>✓</div>
            <p className="card-meta" style={{ marginBottom: 20 }}>Your password has been updated.</p>
            <button className="btn btn-primary btn-block" onClick={onDone}>
              Continue
            </button>
          </div>
        ) : (
          <form className="form-card" onSubmit={handleSubmit}>
            <div className="field">
              <label className="field-label" htmlFor="reset-password">
                New password
              </label>
              <input
                id="reset-password"
                className="input"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </div>
            <div className="field" style={{ marginBottom: error ? 12 : 18 }}>
              <label className="field-label" htmlFor="reset-confirm">
                Confirm new password
              </label>
              <input
                id="reset-confirm"
                className="input"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            {error && <div className="banner banner-error">{error}</div>}
            <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
              {saving ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
