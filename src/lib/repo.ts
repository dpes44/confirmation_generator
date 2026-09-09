import { query, one } from './db';
import type { Batch, Client, Company, LetterWithClient } from './types';

const COMPANY_COLS = `id, name, address, pan_number, logo_data, stamp_data, signature_data,
  signatory_name, signatory_phone, signatory_title, footer_lines, confirm_days,
  tpl_salutation, tpl_intro, tpl_confirm_note, tpl_contact, tpl_subject, tpl_table_rows,
  currency_label, number_grouping`;

export async function getCompany(): Promise<Company> {
  const row = await one<Company>(`select ${COMPANY_COLS} from company_profile where id = 1`);
  if (row) return row;
  // The schema seeds row 1, but stay resilient if it was deleted.
  await query(`insert into company_profile (id) values (1) on conflict (id) do nothing`);
  return (await one<Company>(`select ${COMPANY_COLS} from company_profile where id = 1`))!;
}

const COMPANY_TEXT_FIELDS = [
  'name', 'address', 'pan_number', 'signatory_name', 'signatory_phone', 'signatory_title',
  'footer_lines', 'tpl_salutation', 'tpl_intro', 'tpl_confirm_note', 'tpl_contact',
  'tpl_subject', 'tpl_table_rows', 'currency_label', 'number_grouping',
] as const;

const COMPANY_IMAGE_FIELDS = ['logo_data', 'stamp_data', 'signature_data'] as const;

export async function saveCompany(input: Record<string, unknown>): Promise<Company> {
  const sets: string[] = [];
  const vals: unknown[] = [];

  for (const f of COMPANY_TEXT_FIELDS) {
    if (f in input) { sets.push(`${f} = $${vals.push(String(input[f] ?? ''))}`); }
  }
  // Images are nullable: an explicit null clears the stored image.
  for (const f of COMPANY_IMAGE_FIELDS) {
    if (f in input) {
      const v = input[f];
      sets.push(`${f} = $${vals.push(v ? String(v) : null)}`);
    }
  }
  if ('confirm_days' in input) {
    const n = Math.max(0, Math.min(365, Math.trunc(Number(input.confirm_days) || 0)));
    sets.push(`confirm_days = $${vals.push(n)}`);
  }

  if (sets.length) {
    sets.push('updated_at = now()');
    await query(`update company_profile set ${sets.join(', ')} where id = 1`, vals);
  }
  return getCompany();
}

// ---------------------------------------------------------------- clients

export async function listClients(search = ''): Promise<Client[]> {
  const term = search.trim();
  if (!term) {
    return query<Client>(
      `select id, name, address, pan_number, phone, notes from clients order by name asc limit 2000`,
    );
  }
  return query<Client>(
    `select id, name, address, pan_number, phone, notes from clients
      where name ilike $1 or pan_number ilike $1 or address ilike $1
      order by name asc limit 2000`,
    [`%${term}%`],
  );
}

export async function createClient(c: Partial<Client>): Promise<Client> {
  const name = String(c.name ?? '').trim();
  if (!name) throw new Error('Client name is required.');
  return (await one<Client>(
    `insert into clients (name, address, pan_number, phone, notes)
     values ($1, $2, $3, $4, $5)
     returning id, name, address, pan_number, phone, notes`,
    [name, c.address ?? '', c.pan_number ?? '', c.phone ?? '', c.notes ?? ''],
  ))!;
}

export async function updateClient(id: number, c: Partial<Client>): Promise<Client> {
  const name = String(c.name ?? '').trim();
  if (!name) throw new Error('Client name is required.');
  const row = await one<Client>(
    `update clients set name = $2, address = $3, pan_number = $4, phone = $5, notes = $6,
            updated_at = now()
      where id = $1
      returning id, name, address, pan_number, phone, notes`,
    [id, name, c.address ?? '', c.pan_number ?? '', c.phone ?? '', c.notes ?? ''],
  );
  if (!row) throw new Error('That client no longer exists.');
  return row;
}

export async function deleteClient(id: number): Promise<void> {
  await query(`delete from clients where id = $1`, [id]);
}

/**
 * Finds a client by name (case-insensitive) or creates one. Used by the import
 * flow when the user opts to save. Existing address/PAN/phone are only filled
 * in when currently blank, so a spreadsheet without those columns can never
 * wipe details already entered by hand.
 */
export async function upsertClientByName(c: {
  name: string; address?: string; pan_number?: string; phone?: string;
}): Promise<Client> {
  const name = c.name.trim();
  if (!name) throw new Error('Client name is required.');

  return (await one<Client>(
    `insert into clients (name, address, pan_number, phone)
          values ($1, $2, $3, $4)
     on conflict (lower(btrim(name))) do update
        set address    = case when btrim(clients.address)    = '' then excluded.address    else clients.address    end,
            pan_number = case when btrim(clients.pan_number) = '' then excluded.pan_number else clients.pan_number end,
            phone      = case when btrim(clients.phone)      = '' then excluded.phone      else clients.phone      end,
            updated_at = now()
     returning id, name, address, pan_number, phone, notes`,
    [name, c.address ?? '', c.pan_number ?? '', c.phone ?? ''],
  ))!;
}

// ---------------------------------------------------------------- letters

const LETTER_SELECT = `
  select l.id, l.client_id, l.batch_id, l.fiscal_year, l.subject,
         to_char(l.letter_date, 'YYYY-MM-DD') as letter_date,
         l.opening_date_bs, l.closing_date_bs,
         l.opening_balance::float8  as opening_balance,
         l.sales::float8            as sales,
         l.purchases::float8        as purchases,
         l.sales_return::float8     as sales_return,
         l.purchases_return::float8 as purchases_return,
         l.annex13::float8          as annex13,
         l.closing_balance::float8  as closing_balance,
         c.name as client_name, c.address as client_address,
         c.pan_number as client_pan, c.phone as client_phone
    from letters l join clients c on c.id = l.client_id`;

export async function listLetters(opts: { batchId?: number; fiscalYear?: string; search?: string } = {}) {
  const where: string[] = [];
  const vals: unknown[] = [];
  if (opts.batchId) where.push(`l.batch_id = $${vals.push(opts.batchId)}`);
  if (opts.fiscalYear) where.push(`l.fiscal_year = $${vals.push(opts.fiscalYear)}`);
  if (opts.search?.trim()) where.push(`c.name ilike $${vals.push(`%${opts.search.trim()}%`)}`);

  return query<LetterWithClient>(
    `${LETTER_SELECT} ${where.length ? 'where ' + where.join(' and ') : ''}
      order by l.created_at desc, c.name asc limit 2000`,
    vals,
  );
}

export async function getLetters(ids: number[]): Promise<LetterWithClient[]> {
  if (!ids.length) return [];
  return query<LetterWithClient>(`${LETTER_SELECT} where l.id = any($1::bigint[]) order by c.name asc`, [ids]);
}

export type LetterInput = {
  client_id: number;
  batch_id?: number | null;
  fiscal_year: string;
  subject?: string;
  letter_date: string;
  opening_date_bs?: string;
  closing_date_bs?: string;
  opening_balance?: number; sales?: number; purchases?: number;
  sales_return?: number; purchases_return?: number; annex13?: number; closing_balance?: number;
};

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export async function insertLetters(rows: LetterInput[]): Promise<number[]> {
  if (!rows.length) return [];

  // One multi-row INSERT keeps a 300-letter import to a single round trip,
  // which matters on a small Aiven instance.
  const cols = ['client_id', 'batch_id', 'fiscal_year', 'subject', 'letter_date',
    'opening_date_bs', 'closing_date_bs', 'opening_balance', 'sales', 'purchases',
    'sales_return', 'purchases_return', 'annex13', 'closing_balance'];

  const vals: unknown[] = [];
  const tuples = rows.map((r) => {
    const t = [
      r.client_id, r.batch_id ?? null, r.fiscal_year, r.subject ?? '', r.letter_date,
      r.opening_date_bs ?? '', r.closing_date_bs ?? '',
      num(r.opening_balance), num(r.sales), num(r.purchases),
      num(r.sales_return), num(r.purchases_return), num(r.annex13), num(r.closing_balance),
    ];
    return `(${t.map((v) => `$${vals.push(v)}`).join(',')})`;
  });

  const out = await query<{ id: number }>(
    `insert into letters (${cols.join(',')}) values ${tuples.join(',')} returning id`,
    vals,
  );
  return out.map((r) => Number(r.id));
}

export async function updateLetter(id: number, r: Partial<LetterInput>): Promise<void> {
  await query(
    `update letters set fiscal_year = $2, subject = $3, letter_date = $4,
            opening_date_bs = $5, closing_date_bs = $6,
            opening_balance = $7, sales = $8, purchases = $9, sales_return = $10,
            purchases_return = $11, annex13 = $12, closing_balance = $13, updated_at = now()
      where id = $1`,
    [id, r.fiscal_year ?? '', r.subject ?? '', r.letter_date, r.opening_date_bs ?? '', r.closing_date_bs ?? '',
      num(r.opening_balance), num(r.sales), num(r.purchases), num(r.sales_return),
      num(r.purchases_return), num(r.annex13), num(r.closing_balance)],
  );
}

export async function deleteLetters(ids: number[]): Promise<void> {
  if (!ids.length) return;
  await query(`delete from letters where id = any($1::bigint[])`, [ids]);
}

// ---------------------------------------------------------------- batches

export async function createBatch(b: { label?: string; fiscal_year: string; source_file?: string }) {
  return (await one<Batch>(
    `insert into batches (label, fiscal_year, source_file) values ($1, $2, $3)
     returning id, label, fiscal_year, source_file, created_at`,
    [b.label ?? '', b.fiscal_year, b.source_file ?? ''],
  ))!;
}

export async function listBatches(): Promise<Batch[]> {
  return query<Batch>(
    `select b.id, b.label, b.fiscal_year, b.source_file, b.created_at,
            count(l.id)::int as letter_count
       from batches b left join letters l on l.batch_id = b.id
      group by b.id order by b.created_at desc limit 200`,
  );
}

/**
 * Last dates used for a fiscal year, so the BS opening/closing dates only ever
 * need to be typed once per year rather than looked up in a BS calendar.
 */
export async function lastDatesForYear(fiscalYear: string) {
  return one<{ opening_date_bs: string; closing_date_bs: string; subject: string }>(
    `select opening_date_bs, closing_date_bs, subject from letters
      where fiscal_year = $1 and btrim(closing_date_bs) <> ''
      order by created_at desc limit 1`,
    [fiscalYear],
  );
}

export async function counts() {
  const row = await one<{ clients: number; letters: number; batches: number }>(
    `select (select count(*) from clients)::int  as clients,
            (select count(*) from letters)::int  as letters,
            (select count(*) from batches)::int  as batches`,
  );
  return row ?? { clients: 0, letters: 0, batches: 0 };
}
