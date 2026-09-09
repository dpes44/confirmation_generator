import Link from 'next/link';
import { requirePage } from '@/lib/guard';
import Shell from '@/components/Shell';
import { counts, getCompany } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  await requirePage();

  // A fresh deployment may not have had the schema applied yet; say so plainly
  // rather than showing a stack trace.
  let stats = { clients: 0, letters: 0, batches: 0 };
  let companyName = '';
  let dbError = '';
  try {
    const [c, s] = await Promise.all([getCompany(), counts()]);
    companyName = c.name;
    stats = s;
  } catch (err: any) {
    dbError = err?.message ?? 'Could not reach the database.';
  }

  return (
    <Shell>
      <div className="page-head">
        <h1>Dashboard</h1>
        {companyName && <span className="sub">{companyName}</span>}
      </div>

      {dbError && (
        <div className="msg err">
          <strong>Database not reachable.</strong> {dbError}
          <div style={{ marginTop: 6 }}>
            Check <code>DATABASE_URL</code>, then apply the schema with <code>npm run db:push</code>.
          </div>
        </div>
      )}

      <div className="grid3">
        {([['Clients', stats.clients, '/clients'], ['Saved letters', stats.letters, '/letters'], ['Import batches', stats.batches, '/letters']] as const).map(
          ([label, value, href]) => (
            <Link key={label} href={href} className="panel" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
              <div className="stat">{value}</div>
              <div className="sub" style={{ fontSize: 12 }}>{label}</div>
            </Link>
          ),
        )}
      </div>

      <div className="panel">
        <h2>Make some letters</h2>
        <p className="sub" style={{ marginTop: 0 }}>
          Drop in a spreadsheet or type the figures by hand, then download one PDF per client or a single
          file for printing.
        </p>
        <div className="row">
          <Link href="/generate"><button className="primary">Generate letters</button></Link>
          <Link href="/settings"><button>Company settings</button></Link>
        </div>
      </div>

      <div className="panel">
        <h2>How it fits together</h2>
        <ol className="sub" style={{ paddingLeft: 20, margin: 0, lineHeight: 1.8 }}>
          <li><strong>Company settings</strong> holds everything constant — logo, signature, stamp, footer, and the letter wording.</li>
          <li><strong>Clients</strong> is your address book. It supplies the address and PAN number that a spreadsheet often leaves out.</li>
          <li><strong>Generate letters</strong> builds the PDFs in your browser. Nothing is stored unless you ask it to be.</li>
          <li><strong>Saved letters</strong> keeps a record so you can reprint later without re-importing.</li>
        </ol>
      </div>
    </Shell>
  );
}
