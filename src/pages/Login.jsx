import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { requestPasswordReset } from '../lib/auth';

export default function Login() {
  const [mode, setMode] = useState('signin'); // 'signin' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError('Couldn’t sign in. Check your email and password and try again.');
    }
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Enter your email first.');
      return;
    }
    setLoading(true);
    const { error: resetError } = await requestPasswordReset(email.trim());
    setLoading(false);
    if (resetError) {
      setError('Couldn’t send the reset email. Please try again.');
      return;
    }
    setResetSent(true);
  }

  function switchToForgot() {
    setMode('forgot');
    setError('');
    setResetSent(false);
  }

  function switchToSignin() {
    setMode('signin');
    setError('');
    setResetSent(false);
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
          <h1 style={{ fontSize: 21, fontWeight: 600, letterSpacing: '-0.01em' }}>Team Tasks</h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
            {mode === 'signin' ? 'Sign in to your workspace' : 'Reset your password'}
          </p>
        </div>

        {mode === 'signin' ? (
          <form className="form-card" onSubmit={handleLogin}>
            <div className="field">
              <label className="field-label" htmlFor="login-email">
                Email
              </label>
              <input
                id="login-email"
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                autoComplete="email"
              />
            </div>
            <div className="field" style={{ marginBottom: 6 }}>
              <label className="field-label" htmlFor="login-password">
                Password
              </label>
              <input
                id="login-password"
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div style={{ textAlign: 'right', marginBottom: error ? 12 : 18 }}>
              <span className="link-action" style={{ fontSize: 12.5 }} onClick={switchToForgot}>
                Forgot password?
              </span>
            </div>
            {error && <div className="banner banner-error">{error}</div>}
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        ) : (
          <div className="form-card">
            {resetSent ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 30, marginBottom: 8 }}>✓</div>
                <p className="card-meta" style={{ marginBottom: 20 }}>
                  اگر یہ email account میں موجود ہے تو password reset link بھیج دیا گیا ہے — اپنا inbox چیک کریں۔
                </p>
                <button type="button" className="btn btn-block" onClick={switchToSignin}>
                  Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword}>
                <div className="field" style={{ marginBottom: error ? 12 : 18 }}>
                  <label className="field-label" htmlFor="forgot-email">
                    Email
                  </label>
                  <input
                    id="forgot-email"
                    className="input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    autoComplete="email"
                  />
                </div>
                {error && <div className="banner banner-error">{error}</div>}
                <button type="submit" className="btn btn-primary btn-block" disabled={loading} style={{ marginBottom: 10 }}>
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
                <button type="button" className="btn btn-block" onClick={switchToSignin}>
                  Back to sign in
                </button>
              </form>
            )}
          </div>
        )}

        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 18, textAlign: 'center' }}>
          New team members are added by your Admin — there's no self-signup.
        </p>
      </div>
    </div>
  );
}
