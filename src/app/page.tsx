export default function HomePage() {
  const endpoints = [
    { method: 'GET', path: '/api/returns', desc: 'List returns with search, filter, sort & pagination' },
    { method: 'POST', path: '/api/returns', desc: 'Create a new return request' },
    { method: 'GET', path: '/api/returns/[id]', desc: 'Fetch return request by ID including notes' },
    { method: 'PATCH', path: '/api/returns/[id]', desc: 'Edit request (allowed when OPEN or IN_REVIEW)' },
    { method: 'PATCH', path: '/api/returns/[id]/status', desc: 'Update status with state-machine & resolution rules' },
    { method: 'POST', path: '/api/returns/[id]/notes', desc: 'Add audit note to a return request' },
    { method: 'DELETE', path: '/api/returns/[id]', desc: 'Soft-delete (allowed when OPEN or REJECTED)' },
  ];

  return (
    <main style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px', lineHeight: 1.6 }}>
      <header style={{ borderBottom: '1px solid #334155', paddingBottom: '20px', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1 style={{ fontSize: '28px', margin: 0, fontWeight: 700 }}>ReturnDesk API</h1>
          <span style={{ backgroundColor: '#10b981', color: '#022c22', fontSize: '12px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>
            ONLINE
          </span>
        </div>
        <p style={{ color: '#94a3b8', margin: '8px 0 0' }}>
          Production-grade return management backend built with Next.js, TypeScript & Prisma (PostgreSQL).
        </p>
      </header>

      <section style={{ marginBottom: '30px', backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
        <h2 style={{ fontSize: '18px', margin: '0 0 10px' }}>⚡ Quick Test</h2>
        <p style={{ color: '#cbd5e1', fontSize: '14px', margin: '0 0 15px' }}>
          Click below to test the live API endpoint fetching seeded return requests:
        </p>
        <a
          href="/api/returns"
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'inline-block',
            backgroundColor: '#3b82f6',
            color: '#ffffff',
            padding: '10px 16px',
            borderRadius: '6px',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '14px',
          }}
        >
          Explore /api/returns →
        </a>
      </section>

      <section>
        <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>Available Endpoints</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {endpoints.map((ep, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#1e293b',
                padding: '12px 16px',
                borderRadius: '6px',
                border: '1px solid #334155',
                gap: '12px',
                fontSize: '14px',
              }}
            >
              <span
                style={{
                  fontWeight: 700,
                  fontSize: '11px',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  backgroundColor: ep.method === 'GET' ? '#0284c7' : ep.method === 'POST' ? '#16a34a' : ep.method === 'PATCH' ? '#d97706' : '#dc2626',
                  color: '#ffffff',
                }}
              >
                {ep.method}
              </span>
              <code style={{ color: '#38bdf8', fontWeight: 600 }}>{ep.path}</code>
              <span style={{ color: '#94a3b8', marginLeft: 'auto', fontSize: '13px' }}>{ep.desc}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
