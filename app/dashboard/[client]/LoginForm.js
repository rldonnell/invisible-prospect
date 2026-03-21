'use client';

import { useState } from 'react';

export default function LoginForm({ clientKey, clientName }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
        // Reload the page — server will now see the cookie and serve the dashboard
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
        <h1 style={styles.title}>Invisible Patient Intelligence</h1>
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
  footer: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 24,
    textAlign: 'center',
  },
};
