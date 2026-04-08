'use client';

import { useState } from 'react';

export default function LoginForm({ clientKey, clientName }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/dashboard/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client: clientKey, password }),
      });

      const data = await res.json();

      if (res.ok) {
        window.location.reload();
      } else {
        setError(data.error || 'Invalid password');
        setLoading(false);
      }
    } catch {
      setError('Connection error. Please try again.');
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setForgotError('');
    setForgotLoading(true);

    try {
      const res = await fetch('/api/dashboard/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client: clientKey }),
      });

      if (res.ok) {
        setForgotSent(true);
      } else {
        setForgotError('Something went wrong. Please try again.');
      }
    } catch {
      setForgotError('Connection error. Please try again.');
    }

    setForgotLoading(false);
  };

  // Forgot password view
  if (showForgot) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.logoRow}>
            <div style={styles.lockIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
          </div>
          <h1 style={styles.title}>VisitorID<sup style={{ fontSize: '0.5em', verticalAlign: 'super' }}>&trade;</sup></h1>
          <p style={styles.subtitle}>{clientName}</p>

          {forgotSent ? (
            <div>
              <div style={styles.successBox}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                <span>If an account exists for this dashboard, a reset link has been sent to the email on file.</span>
              </div>
              <p style={{ fontSize: 13, color: '#64748b', marginTop: 16, lineHeight: 1.5 }}>
                Check your inbox (and spam folder). The link expires in 2 hours.
              </p>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, marginBottom: 24, textAlign: 'left' }}>
                We&apos;ll send a password reset link to the email address on file for this dashboard.
              </p>
              {forgotError && <p style={styles.error}>{forgotError}</p>}
              <button
                onClick={handleForgotPassword}
                style={styles.button}
                disabled={forgotLoading}
              >
                {forgotLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </div>
          )}

          <button
            onClick={() => { setShowForgot(false); setForgotSent(false); setForgotError(''); }}
            style={styles.backLink}
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  // Normal login view
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logoRow}>
          <div style={styles.lockIcon}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
        </div>
        <h1 style={styles.title}>VisitorID<sup style={{ fontSize: '0.5em', verticalAlign: 'super' }}>&trade;</sup></h1>
        <p style={styles.subtitle}>{clientName}</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>Dashboard Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            style={styles.input}
            autoFocus
            disabled={loading}
          />
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" style={styles.button} disabled={loading || !password}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <button
          onClick={() => setShowForgot(true)}
          style={styles.forgotLink}
        >
          Forgot password?
        </button>

        <p style={styles.footer}>
          Contact your P5 Marketing account manager if you need access.
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    backgroundColor: '#f8fafc',
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: '48px 40px',
    maxWidth: 420,
    width: '100%',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    textAlign: 'center',
  },
  logoRow: {
    marginBottom: 20,
  },
  lockIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#eef2ff',
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: '#1e293b',
    margin: '0 0 4px',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    margin: '0 0 32px',
  },
  form: {
    textAlign: 'left',
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#475569',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    fontSize: 15,
    border: '1.5px solid #e2e8f0',
    borderRadius: 10,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  },
  error: {
    color: '#dc2626',
    fontSize: 13,
    margin: '8px 0 0',
  },
  button: {
    width: '100%',
    padding: '12px 0',
    fontSize: 15,
    fontWeight: 600,
    color: '#fff',
    backgroundColor: '#6366f1',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    marginTop: 16,
    transition: 'background-color 0.2s',
  },
  forgotLink: {
    display: 'block',
    margin: '16px auto 0',
    padding: 0,
    border: 'none',
    background: 'none',
    fontSize: 13,
    color: '#6366f1',
    cursor: 'pointer',
    fontWeight: 500,
  },
  backLink: {
    display: 'block',
    margin: '20px auto 0',
    padding: 0,
    border: 'none',
    background: 'none',
    fontSize: 13,
    color: '#6366f1',
    cursor: 'pointer',
    fontWeight: 500,
  },
  successBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '14px 16px',
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    fontSize: 13,
    color: '#15803d',
    textAlign: 'left',
    lineHeight: 1.5,
  },
  footer: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 24,
    textAlign: 'center',
  },
};
