// Indian state codes for GST place-of-supply
export const INDIA_STATES: { code: string; name: string }[] = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra & Nagar Haveli and Daman & Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
  { code: '97', name: 'Other Territory' },
  { code: '99', name: 'Other Country' },
];

export const STATE_NAME: Record<string, string> = Object.fromEntries(INDIA_STATES.map((s) => [s.code, s.name]));

export const TDS_SECTIONS = [
  { code: '194C', label: '194C — Contractor (1-2%)' },
  { code: '194H', label: '194H — Commission (5%)' },
  { code: '194J', label: '194J — Professional / Technical (10%)' },
  { code: '194I', label: '194I — Rent (10%)' },
  { code: '194Q', label: '194Q — Purchase of goods (0.1%)' },
  { code: '194O', label: '194O — E-commerce (1%)' },
  { code: '192', label: '192 — Salary (slab)' },
];

export const GST_RATES = [0, 5, 12, 18, 28];

export function stateCodeFromGstin(gstin?: string | null): string | null {
  if (!gstin) return null;
  const c = gstin.trim().slice(0, 2);
  return /^[0-9]{2}$/.test(c) ? c : null;
}

export function rupeesToWordsIN(n: number): string {
  if (!isFinite(n)) return '';
  const sign = n < 0 ? 'Minus ' : '';
  const abs = Math.abs(n);
  const rupees = Math.floor(abs);
  const paise = Math.round((abs - rupees) * 100);
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const under1000 = (x: number): string => {
    let r = '';
    if (x >= 100) { r += `${ones[Math.floor(x / 100)]} Hundred `; x %= 100; }
    if (x >= 20) { r += `${tens[Math.floor(x / 10)]} `; if (x % 10) r += `${ones[x % 10]} `; }
    else if (x > 0) r += `${ones[x]} `;
    return r.trim();
  };
  const toWords = (x: number): string => {
    if (x === 0) return 'Zero';
    const cr = Math.floor(x / 10000000); x %= 10000000;
    const lk = Math.floor(x / 100000); x %= 100000;
    const th = Math.floor(x / 1000); x %= 1000;
    const parts: string[] = [];
    if (cr) parts.push(`${under1000(cr)} Crore`);
    if (lk) parts.push(`${under1000(lk)} Lakh`);
    if (th) parts.push(`${under1000(th)} Thousand`);
    if (x) parts.push(under1000(x));
    return parts.join(' ');
  };
  const rs = rupees === 0 ? 'Zero' : toWords(rupees);
  const ps = paise > 0 ? ` and ${toWords(paise)} Paise` : '';
  return `${sign}${rs} Rupees${ps} Only`;
}
