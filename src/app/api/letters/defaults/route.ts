import { guarded } from '@/lib/guard';
import { lastDatesForYear } from '@/lib/repo';
import { parseFiscalYear, defaultOpeningDate, defaultClosingDate } from '@/lib/fiscal';

export const runtime = 'nodejs';

/**
 * Suggests the BS opening/closing dates and subject for a fiscal year, reusing
 * whatever was saved for that year before so the dates are typed only once.
 */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('fy') ?? '';
  return guarded(async () => {
    const fy = parseFiscalYear(raw);
    if (!fy) return { fiscal_year: raw, opening_date_bs: '', closing_date_bs: '', source: 'invalid' };

    const prior = await lastDatesForYear(fy.label);
    if (prior?.closing_date_bs) {
      return {
        fiscal_year: fy.label,
        opening_date_bs: prior.opening_date_bs,
        closing_date_bs: prior.closing_date_bs,
        source: 'previous',
      };
    }
    return {
      fiscal_year: fy.label,
      opening_date_bs: defaultOpeningDate(fy),
      closing_date_bs: defaultClosingDate(fy),
      source: 'computed',
    };
  });
}
