import ResetForm from './ResetForm';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { client } = params;
  const name = client.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return {
    title: `Reset Password - ${name} - VisitorID\u2122`,
  };
}

function getClientName(client) {
  return client.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * /dashboard/[client]/reset?token=xxx
 *
 * Shows the reset password form. If no token, shows an invalid link message.
 */
export default function ResetPage({ params, searchParams }) {
  const { client } = params;
  const token = searchParams?.token;

  if (!token) {
    return (
      <div style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        backgroundColor: '#f8fafc',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}>
        <div style={{
          backgroundColor: '#fff',
          borderRadius: 16,
          padding: '48px 40px',
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          textAlign: 'center',
        }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: '0 0 8px' }}>
            Invalid Reset Link
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 24px' }}>
            This password reset link is missing or has expired. Please request a new one.
          </p>
          <a
            href={`/dashboard/${client}`}
            style={{
              display: 'inline-block',
              padding: '10px 24px',
              fontSize: 14,
              fontWeight: 600,
              color: '#6366f1',
              textDecoration: 'none',
            }}
          >
            Back to Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <ResetForm
      clientKey={client}
      clientName={getClientName(client)}
      token={token}
    />
  );
}
