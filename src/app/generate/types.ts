import { EMPTY_AMOUNTS, type Amounts } from '@/lib/types';
import { todayIso } from '@/lib/format';

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

export const BLANK_META: Meta = {
  fiscal_year: '',
  subject: '',
  letter_date: todayIso(),
  opening_date_bs: '',
  closing_date_bs: '',
};

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
