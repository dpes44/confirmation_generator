-- Confirmation Letter Generator :: schema
-- Safe to run repeatedly.

create table if not exists company_profile (
  id                integer primary key default 1,
  name              text not null default '',
  address           text not null default '',
  pan_number        text not null default '',
  -- images stored inline as data URIs; they are a few KB each and this avoids
  -- needing any blob-storage service.
  logo_data         text,
  stamp_data        text,
  signature_data    text,
  signatory_name    text not null default '',
  signatory_phone   text not null default '',
  signatory_title   text not null default '',
  footer_lines      text not null default '',
  confirm_days      integer not null default 7,
  tpl_salutation    text not null default '',
  tpl_intro         text not null default '',
  tpl_confirm_note  text not null default '',
  tpl_contact       text not null default '',
  tpl_subject       text not null default '',
  currency_label    text not null default 'NPR',
  updated_at        timestamptz not null default now(),
  constraint company_profile_singleton check (id = 1)
);

create table if not exists clients (
  id          bigserial primary key,
  name        text not null,
  address     text not null default '',
  pan_number  text not null default '',
  phone       text not null default '',
  notes       text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Case-insensitive uniqueness so an import cannot create "ABC Traders" twice.
create unique index if not exists clients_name_key on clients (lower(btrim(name)));

create table if not exists batches (
  id           bigserial primary key,
  label        text not null default '',
  fiscal_year  text not null,
  source_file  text not null default '',
  created_at   timestamptz not null default now()
);

create table if not exists letters (
  id                bigserial primary key,
  client_id         bigint not null references clients(id) on delete cascade,
  batch_id          bigint references batches(id) on delete set null,
  fiscal_year       text not null,
  subject           text not null default '',
  -- AD date printed at the top of the letter
  letter_date       date not null default current_date,
  -- Nepali (BS) dates are stored as the literal text that gets printed,
  -- e.g. '2081/04/01', so no BS<->AD conversion can ever corrupt them.
  opening_date_bs   text not null default '',
  closing_date_bs   text not null default '',
  opening_balance   numeric(18,2) not null default 0,
  sales             numeric(18,2) not null default 0,
  purchases         numeric(18,2) not null default 0,
  sales_return      numeric(18,2) not null default 0,
  purchases_return  numeric(18,2) not null default 0,
  annex13           numeric(18,2) not null default 0,
  closing_balance   numeric(18,2) not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists letters_client_idx on letters (client_id);
create index if not exists letters_batch_idx  on letters (batch_id);
create index if not exists letters_fy_idx     on letters (fiscal_year);

-- Seed the single company row with the wording from the reference letter.
insert into company_profile (id, name, address, pan_number,
  signatory_name, signatory_phone, signatory_title, footer_lines, confirm_days,
  tpl_salutation, tpl_intro, tpl_confirm_note, tpl_contact, tpl_subject)
values (1,
  'Kavreli Agro Industries Private Limited',
  'Nijgadh, Bara, Nepal',
  '609883954',
  'Shiva Prasad Acharya',
  '+977 9855010946',
  'Kavreli Agro Industries Private Limited',
  E'KAVRELI AGRO INDUSTRIES PRIVATE LIMITED\nNIJGADH, BARA, NEPAL\nPAN NUMBER: 609883954',
  7,
  'Dear Sir/Ma''am,',
  'In connection with the audit of our financial statements, we are writing to you requesting that you confirm the following balance(s) as of date {{closing_date}}.',
  'Please add your confirmation or send us the received copy with signed and official stamp within {{days}} days of this letter. Otherwise, we shall assume this balance as your acceptance.',
  'For any query, please contact at {{phone}} - {{signatory}}',
  'Confirmation of Sales Transactions for the year {{fiscal_year}}')
on conflict (id) do nothing;

-- Additive migrations (idempotent) ------------------------------------------
alter table company_profile add column if not exists number_grouping text not null default 'none';
alter table company_profile add column if not exists tpl_table_rows text not null default '';

-- Default row labels for the balance table, one per line as "key|label".
update company_profile
   set tpl_table_rows = E'opening_balance|Opening Balance (As of {{opening_date}})\nsales|Sales\npurchases|Purchases\nsales_return|Sales Return\npurchases_return|Purchases Return\nannex13|Annex 13 Balance\nclosing_balance|Closing Balance (As of {{closing_date}})'
 where id = 1 and btrim(tpl_table_rows) = '';
