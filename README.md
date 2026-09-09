# Confirmation Letter Generator

Generates audit balance-confirmation letters as PDFs. Import a spreadsheet or
type the figures in, and get one PDF per client (or a single file for printing).

Built as a Next.js app deployed on Vercel's free Hobby plan, with an Aiven
Postgres database. PDFs are rendered **in the browser**, so no server does any
document work and nothing is uploaded.

## How it fits together

| Screen | What it holds |
| --- | --- |
| **Company settings** | Everything constant: logo, signature, stamp, footer, letter wording, number formatting |
| **Clients** | Address book. Supplies the address and PAN number that spreadsheets usually leave out |
| **Generate letters** | Import a file or enter figures manually, then preview and download |
| **Saved letters** | Optional record, so you can reprint later without re-importing |

Nothing is written to the database unless you press **Save to database** —
generating and downloading PDFs is read-only.

## Local setup

```bash
npm install
cp .env.example .env.local     # then fill it in (see below)
npm run db:push                # creates the tables; safe to re-run
npm run dev                    # http://localhost:3000
```

## Environment variables

All four are required (`DATABASE_CA_CERT` is strongly recommended, not strictly
required).

| Variable | What it is |
| --- | --- |
| `DATABASE_URL` | Aiven's Service URI, e.g. `postgres://avnadmin:…@…aivencloud.com:PORT/defaultdb?sslmode=require` |
| `DATABASE_CA_CERT` | Aiven's CA certificate as **one line**, with literal `\n` between lines. Without it the connection is still encrypted but the server certificate is not verified |
| `APP_PASSWORD` | The single shared password used to sign in |
| `AUTH_SECRET` | Signs the login cookie. Generate with `openssl rand -hex 32` |

To get `DATABASE_CA_CERT` onto one line:

```bash
awk '{printf "%s\\n", $0}' ca.pem
```

## Deploying to Vercel

1. Push this repo to GitHub.
2. In Vercel, **Add New → Project** and import the repo. Framework detection
   picks up Next.js; no build settings need changing.
3. Add all four environment variables under **Settings → Environment
   Variables**, ticking Production, Preview and Development.
4. Deploy.

Run `npm run db:push` once from your machine against the same `DATABASE_URL`
before the first visit — the app reports a clear error if the tables are missing
rather than crashing.

Both Vercel Hobby and Aiven's free tier are free and need no credit card.

## Notes on the design

**Why there is a backend.** A browser cannot open a raw TCP connection, so a
purely client-side app cannot reach Aiven Postgres at all. Putting a connection
string in client-side code would also publish it to anyone who opens devtools.
The API routes exist so credentials stay server-side.

**Nepali dates are stored as text.** Ashadh has either 31 or 32 days depending
on the year, so the BS opening and closing dates are stored and printed as the
literal strings you enter (`2082/03/32`). No Bikram Sambat conversion runs
anywhere, which means no calendar table can silently put a wrong date on an
audit document. The dates are suggested from the fiscal year, and the app then
reuses whatever you used for that year previously.

**Spreadsheet reading is self-contained.** `src/lib/spreadsheet.ts` unzips the
`.xlsx` with `fflate` and reads the sheet XML directly, rather than depending on
a large spreadsheet library. Column headers are matched to fields
automatically; the mapping is always shown and can be corrected.

**Connection pooling.** Aiven's free tier allows few connections and each
serverless instance opens its own pool, so the pool is capped small with a short
idle timeout (`src/lib/db.ts`).

## Layout of the code

```
db/schema.sql            tables + seed row; idempotent
scripts/db-push.mjs      applies schema.sql to DATABASE_URL
src/lib/
  db.ts                  pg pool
  pg-ssl.mjs             TLS options, shared with db-push.mjs
  auth.ts, session.ts    HMAC-signed cookie
  guard.ts               requirePage() / requireApi()
  repo.ts                all SQL
  spreadsheet.ts         xlsx + csv reader
  mapping.ts             header -> field matching
  fiscal.ts, format.ts   fiscal year, number and date formatting
  pdf-output.tsx         single / merged / zip downloads
src/components/
  LetterPdf.tsx          the letter layout
  PdfPreview.tsx, Shell.tsx
src/app/                 pages and API routes
src/proxy.ts             redirects signed-out visitors to /login
```

Authentication is layered: `src/proxy.ts` handles the redirect for humans, and
`requirePage()` / `requireApi()` verify the cookie signature on every page and
route. The proxy runs on the Edge runtime and cannot use `node:crypto`, so it
only checks that a cookie is present — the guards are the security boundary.
