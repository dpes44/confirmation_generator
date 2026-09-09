'use client';

import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { formatAmount, formatLetterDate, renderTemplate } from '@/lib/format';
import { AMOUNT_FIELDS, type Amounts, type Company } from '@/lib/types';

export type LetterData = Amounts & {
  client_name: string;
  client_address: string;
  client_pan: string;
  fiscal_year: string;
  subject: string;
  letter_date: string;
  opening_date_bs: string;
  closing_date_bs: string;
};

const s = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 40, paddingHorizontal: 54, fontSize: 10.5, fontFamily: 'Helvetica', color: '#000', lineHeight: 1.45 },
  logo: { maxWidth: 130, maxHeight: 46, marginBottom: 16, objectFit: 'contain', alignSelf: 'flex-start' },
  date: { marginBottom: 14 },
  addrLine: { marginBottom: 2 },
  bold: { fontFamily: 'Helvetica-Bold' },
  subject: { marginTop: 12, marginBottom: 12, paddingLeft: 62 },
  para: { marginBottom: 10, textAlign: 'justify' },

  table: { borderWidth: 0.9, borderColor: '#000', marginTop: 4, marginBottom: 12 },
  tr: { flexDirection: 'row', borderBottomWidth: 0.9, borderBottomColor: '#000' },
  trLast: { flexDirection: 'row' },
  cSno: { width: 46, paddingVertical: 3.5, paddingHorizontal: 5, borderRightWidth: 0.9, borderRightColor: '#000', textAlign: 'center' },
  cPart: { flex: 1, paddingVertical: 3.5, paddingHorizontal: 6, borderRightWidth: 0.9, borderRightColor: '#000' },
  cAmt: { width: 128, paddingVertical: 3.5, paddingHorizontal: 6, textAlign: 'right' },
  thText: { fontFamily: 'Helvetica-Bold', textAlign: 'center' },

  signBlock: { flexDirection: 'row', marginTop: 22 },
  signLeft: { flex: 1, paddingRight: 14 },
  signRight: { flex: 1, paddingLeft: 16, borderLeftWidth: 0.9, borderLeftColor: '#000' },
  signHead: { marginBottom: 4 },
  // Signature and stamp sit side by side in a fixed-height strip so the text
  // below always lands in the same place, image present or not.
  markRow: { flexDirection: 'row', alignItems: 'flex-end', height: 62, marginBottom: 2 },
  signature: { maxWidth: 108, maxHeight: 58, objectFit: 'contain' },
  stamp: { maxWidth: 82, maxHeight: 62, objectFit: 'contain', marginLeft: -12 },
  blankLine: { marginBottom: 3 },

  footer: { position: 'absolute', bottom: 34, left: 54, right: 54, textAlign: 'center' },
  footerLine: { fontSize: 10 },
});

/** Parses the "key|Label" lines from company settings into table rows. */
function tableRows(company: Company) {
  const known = new Set<string>(AMOUNT_FIELDS);
  return (company.tpl_table_rows ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf('|');
      const key = (i === -1 ? line : line.slice(0, i)).trim();
      const label = (i === -1 ? line : line.slice(i + 1)).trim();
      return { key, label };
    })
    .filter((r) => known.has(r.key));
}

export function LetterBody({ company, letter }: { company: Company; letter: LetterData }) {
  const vars: Record<string, string> = {
    opening_date: letter.opening_date_bs,
    closing_date: letter.closing_date_bs,
    fiscal_year: letter.fiscal_year,
    days: String(company.confirm_days),
    phone: company.signatory_phone,
    signatory: company.signatory_name,
    company: company.name,
    client: letter.client_name,
    currency: company.currency_label,
  };
  const fill = (tpl: string) => renderTemplate(tpl, vars);
  const amount = (key: string) => formatAmount((letter as any)[key], company.number_grouping);

  const rows = tableRows(company);
  const subject = letter.subject?.trim() || fill(company.tpl_subject);
  const footer = (company.footer_lines ?? '').split('\n').map((l) => l.trim()).filter(Boolean);

  return (
    <Page size="A4" style={s.page} wrap>
      {company.logo_data ? <Image src={company.logo_data} style={s.logo} /> : null}

      <Text style={s.date}>{formatLetterDate(letter.letter_date)}</Text>

      <Text style={s.addrLine}>M/S {letter.client_name}</Text>
      {letter.client_address ? <Text style={s.addrLine}>{letter.client_address}</Text> : null}
      {letter.client_pan ? (
        <Text style={s.addrLine}>PAN Number: <Text style={s.bold}>{letter.client_pan}</Text></Text>
      ) : null}

      <Text style={s.subject}>
        <Text style={s.bold}>Subject: </Text>
        <Text style={s.bold}>{subject}</Text>
      </Text>

      <Text style={s.para}>{fill(company.tpl_salutation)}</Text>
      <Text style={s.para}>{fill(company.tpl_intro)}</Text>

      <View style={s.table}>
        <View style={s.tr}>
          <View style={s.cSno}><Text style={s.thText}>S. No.</Text></View>
          <View style={s.cPart}><Text style={s.thText}>Particulars</Text></View>
          <View style={s.cAmt}><Text style={s.thText}>Total Amount ({company.currency_label})</Text></View>
        </View>
        {rows.map((r, i) => (
          <View key={r.key} style={i === rows.length - 1 ? s.trLast : s.tr}>
            <View style={s.cSno}><Text>{i + 1}</Text></View>
            <View style={s.cPart}><Text>{fill(r.label)}</Text></View>
            <View style={s.cAmt}><Text>{amount(r.key)}</Text></View>
          </View>
        ))}
      </View>

      <Text style={s.para}>{fill(company.tpl_confirm_note)}</Text>
      <Text style={s.para}>{fill(company.tpl_contact)}</Text>

      <View style={s.signBlock} wrap={false}>
        <View style={s.signLeft}>
          <Text style={s.signHead}>Signatories &amp; Stamp:</Text>
          <View style={s.markRow}>
            {company.signature_data ? <Image src={company.signature_data} style={s.signature} /> : null}
            {company.stamp_data ? <Image src={company.stamp_data} style={s.stamp} /> : null}
          </View>
          <Text>{company.signatory_name}</Text>
          <Text>{company.signatory_phone}</Text>
          <Text style={s.bold}>{company.signatory_title}</Text>
        </View>
        <View style={s.signRight}>
          <Text style={s.signHead}>Confirmation By:</Text>
          <View style={s.markRow} />
          <Text style={s.blankLine}>Name:</Text>
          <Text style={s.blankLine}>Designation:</Text>
          <Text style={s.blankLine}>Accounting Firm (If Any):</Text>
        </View>
      </View>

      <View style={s.footer} fixed>
        {footer.map((line, i) => (
          <Text key={i} style={[s.footerLine, i === footer.length - 1 ? s.bold : {}]}>{line}</Text>
        ))}
      </View>
    </Page>
  );
}

/** One PDF holding every letter passed in, one page each. */
export default function LetterPdf({ company, letters }: { company: Company; letters: LetterData[] }) {
  return (
    <Document title="Confirmation Letters" author={company.name}>
      {letters.map((l, i) => (
        <LetterBody key={i} company={company} letter={l} />
      ))}
    </Document>
  );
}
