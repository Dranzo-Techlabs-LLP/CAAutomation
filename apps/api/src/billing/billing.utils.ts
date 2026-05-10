/**
 * Convert number (rupees) to Indian-numbering words.
 * Example: 123456.78 -> "One Lakh Twenty Three Thousand Four Hundred Fifty Six Rupees and Seventy Eight Paise Only"
 */
export function rupeesToWords(n: number): string {
  if (!isFinite(n)) return '';
  const sign = n < 0 ? 'Minus ' : '';
  const abs = Math.abs(n);
  const rupees = Math.floor(abs);
  const paise = Math.round((abs - rupees) * 100);
  const rs = rupees === 0 ? 'Zero' : numberToIndianWords(rupees);
  const ps = paise > 0 ? ` and ${numberToIndianWords(paise)} Paise` : '';
  return `${sign}${rs} Rupees${ps} Only`;
}

const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function under1000(n: number): string {
  let result = '';
  if (n >= 100) {
    result += `${ones[Math.floor(n / 100)]} Hundred `;
    n %= 100;
  }
  if (n >= 20) {
    result += `${tens[Math.floor(n / 10)]} `;
    if (n % 10) result += `${ones[n % 10]} `;
  } else if (n > 0) {
    result += `${ones[n]} `;
  }
  return result.trim();
}

function numberToIndianWords(n: number): string {
  if (n === 0) return 'Zero';
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hundred = n;

  const parts: string[] = [];
  if (crore) parts.push(`${under1000(crore)} Crore`);
  if (lakh) parts.push(`${under1000(lakh)} Lakh`);
  if (thousand) parts.push(`${under1000(thousand)} Thousand`);
  if (hundred) parts.push(under1000(hundred));
  return parts.join(' ');
}

/**
 * Extract 2-digit Indian state code from GSTIN (first 2 chars).
 * Returns null if invalid format.
 */
export function stateCodeFromGstin(gstin?: string | null): string | null {
  if (!gstin) return null;
  const code = gstin.trim().slice(0, 2);
  if (!/^[0-9]{2}$/.test(code)) return null;
  return code;
}

/**
 * Compute per-line GST split given taxable value (paise), gst rate %, supplier state, place of supply.
 * Returns { cgst, sgst, igst } in paise.
 */
export function splitGstForLine(
  taxableValuePaise: number,
  gstRatePct: number,
  supplierStateCode: string | null,
  placeOfSupply: string | null,
  forceIgst = false,
): { cgst: number; sgst: number; igst: number } {
  if (gstRatePct <= 0) return { cgst: 0, sgst: 0, igst: 0 };
  const totalTax = Math.round((taxableValuePaise * gstRatePct) / 100);
  const intraState = !forceIgst && supplierStateCode && placeOfSupply && supplierStateCode === placeOfSupply;
  if (intraState) {
    const half = Math.round(totalTax / 2);
    return { cgst: half, sgst: totalTax - half, igst: 0 };
  }
  return { cgst: 0, sgst: 0, igst: totalTax };
}

/**
 * Round value to nearest rupee. Returns { rounded, roundOff } in paise.
 */
export function applyRoundOff(totalPaise: number): { rounded: number; roundOff: number } {
  const rounded = Math.round(totalPaise / 100) * 100;
  return { rounded, roundOff: rounded - totalPaise };
}
