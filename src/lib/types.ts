import type { Grouping } from './format';

export type Company = {
  id: number;
  name: string;
  address: string;
  pan_number: string;
  logo_data: string | null;
  stamp_data: string | null;
  signature_data: string | null;
  signatory_name: string;
  signatory_phone: string;
  signatory_title: string;
  footer_lines: string;
  confirm_days: number;
  tpl_salutation: string;
  tpl_intro: string;
  tpl_confirm_note: string;
  tpl_contact: string;
  tpl_subject: string;
  tpl_table_rows: string;
  currency_label: string;
  number_grouping: Grouping;
};

export type Client = {
  id: number;
  name: string;
  address: string;
  pan_number: string;
  phone: string;
  notes: string;
};

/** The seven amount fields that make up the balance table. */
export const AMOUNT_FIELDS = [
  'opening_balance',
  'sales',
  'purchases',
  'sales_return',
  'purchases_return',
  'purchase_annex13',
  'sales_annex13',
  // Kept for letters saved before Annex 13 was split into purchase and sales
  // columns, and for spreadsheets that still use a single combined column.
  'annex13',
  'closing_balance',
] as const;

export type AmountField = (typeof AMOUNT_FIELDS)[number];

export type Amounts = Record<AmountField, number>;

export type Letter = Amounts & {
  id: number;
  client_id: number;
  batch_id: number | null;
  fiscal_year: string;
  subject: string;
  letter_date: string;
  opening_date_bs: string;
  closing_date_bs: string;
};

/** A letter joined with its client, which is everything the PDF needs. */
export type LetterWithClient = Letter & {
  client_name: string;
  client_address: string;
  client_pan: string;
  client_phone: string;
};

export type Batch = {
  id: number;
  label: string;
  fiscal_year: string;
  source_file: string;
  created_at: string;
  letter_count?: number;
};

export const EMPTY_AMOUNTS: Amounts = {
  opening_balance: 0,
  sales: 0,
  purchases: 0,
  sales_return: 0,
  purchases_return: 0,
  purchase_annex13: 0,
  sales_annex13: 0,
  annex13: 0,
  closing_balance: 0,
};
