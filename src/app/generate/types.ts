import { EMPTY_AMOUNTS, type Amounts } from '@/lib/types';
import { todayIso } from '@/lib/format';
import { currentFiscalYear, defaultClosingDate, defaultOpeningDate } from '@/lib/fiscal';

/** One prospective letter, before letter-level details are applied. */
export type RowDraft = {
  key: string;
  name: string;
  address: string;
  pan_number: string;
  phone: string;
  amounts: Amounts;
  selected: boolean;
  /** Row number in the source file, for import rows only. */
  sourceRow?: number;
};

export type Meta = {
  fiscal_year: string;
  subject: string;
  letter_date: string;
  opening_date_bs: string;
  closing_date_bs: string;
};

/**
 * Opens on the current Nepali fiscal year with its Shrawan 1 and Ashadh dates
 * already filled in, so the common case needs no typing. Every field stays
 * editable, and the server may replace the dates with whatever was used for
 * this year previously (see /api/letters/defaults).
 */
export function initialMeta(): Meta {
  const fy = currentFiscalYear();
  return {
    fiscal_year: fy.label,
    subject: '',
    letter_date: todayIso(),
    opening_date_bs: defaultOpeningDate(fy),
    closing_date_bs: defaultClosingDate(fy),
  };
}

export function blankRow(key: string): RowDraft {
  return {
    key,
    name: '',
    address: '',
    pan_number: '',
    phone: '',
    amounts: { ...EMPTY_AMOUNTS },
    selected: true,
  };
}
