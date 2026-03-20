export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ color: '#1B3A5C' }}>P5 Pixel Intelligence Pipeline</h1>
      <p style={{ color: '#555', fontSize: '1.1em' }}>
        Automated visitor identification, intent scoring, and CRM integration
        powered by Neon Postgres, Vercel Cron + GoHighLevel.
      </p>

      <h2>Active Endpoints</h2>

      <div style={{ background: '#f5f7fa', padding: '1.5rem', borderRadius: '8px', marginBottom: '1rem' }}>
        <h3 style={{ margin: '0 0 0.5rem 0', color: '#2E86AB' }}>Webhook — Pixel Data Ingestion</h3>
        <code>POST /api/webhook/pixel</code>
        <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.9em' }}>
          Receives visitor data from VisitorID pixel exports. Supports single events and batch uploads.
        </p>
      </div>

      <div style={{ background: '#f5f7fa', padding: '1.5rem', borderRadius: '8px', marginBottom: '1rem' }}>
        <h3 style={{ margin: '0 0 0.5rem 0', color: '#2E86AB' }}>Cron — Process Visitors</h3>
        <code>GET /api/cron/process-visitors</code>
        <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.9em' }}>
          Daily at 6 AM UTC — Applies taxonomy, scores intent, generates tags for all unprocessed visitors.
        </p>
      </div>

      <div style={{ background: '#f5f7fa', padding: '1.5rem', borderRadius: '8px', marginBottom: '1rem' }}>
        <h3 style={{ margin: '0 0 0.5rem 0', color: '#2E86AB' }}>Cron — Push to GoHighLevel</h3>
        <code>GET /api/cron/push-ghl</code>
        <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.9em' }}>
          Daily at 7 AM UTC — Pushes scored leads (Medium+) to GHL with tags and custom fields.
        </p>
      </div>

      <div style={{ background: '#f5f7fa', padding: '1.5rem', borderRadius: '8px', marginBottom: '1rem' }}>
        <h3 style={{ margin: '0 0 0.5rem 0', color: '#2E86AB' }}>Reports API</h3>
        <code>GET /api/reports?client=sa-spine</code>
        <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.9em' }}>
          Returns processed visitor data in dashboard-compatible JSON format.
        </p>
      </div>

      <h2>Configured Clients</h2>
      <ul>
        <li><strong>sa-spine</strong> — SA Spine (Spine Surgery)</li>
        <li><strong>az-breasts</strong> — AZ Breasts (Breast Surgery)</li>
        <li><strong>four-winds</strong> — Four Winds CMMS (B2B SaaS)</li>
        <li><strong>tbr</strong> — The Brilliance Revolution (Coaching)</li>
        <li><strong>plastic-surgery-generic</strong> — Generic Plastic Surgery</li>
      </ul>

      <div style={{ marginTop: '2rem', padding: '1rem', background: '#e8f4f8', borderRadius: '8px', fontSize: '0.85em', color: '#555' }}>
        Powered by <strong>P5 Marketing</strong> — <a href="https://p5marketing.com" target="_blank" style={{ color: '#2E86AB' }}>P5Marketing.com</a>
      </div>
    </main>
  );
}
