import ExcelJS from 'exceljs';

export interface ColumnSpec {
  key: string;
  header: string;
  width?: number;
  required?: boolean;
  enumValues?: string[];
  /**
   * Name of a lookup sheet (created via `lookupSheets`) — used when the value
   * list is too long for inline (>255 chars) or when callers want a
   * reusable shared list. Resolves to data-validation against the sheet's
   * column A range.
   */
  lookupSheet?: string;
  example?: string | number | boolean;
  note?: string;
}

export interface LookupSheet {
  name: string;
  values: string[];
}

const HEADER_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF0F172A' },
};
const REQUIRED_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFEE2E2' },
};

/** Build an Excel buffer with a header row + (optional) example row + instructions sheet. */
export async function buildTemplate(opts: {
  sheetName: string;
  columns: ColumnSpec[];
  instructions?: string[];
  /** Optional hidden lookup sheets referenced by ColumnSpec.lookupSheet. */
  lookupSheets?: LookupSheet[];
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'DeskHub';
  wb.created = new Date();

  // ── Hidden lookup sheets (created FIRST so column refs resolve) ──────
  const lookupRefs = new Map<string, { sheetName: string; rangeRef: string }>();
  if (opts.lookupSheets?.length) {
    for (const lookup of opts.lookupSheets) {
      const safe = lookup.name.replace(/[^A-Za-z0-9]/g, '_').slice(0, 24);
      const sheetName = `_lk_${safe}`;
      const lk = wb.addWorksheet(sheetName, { state: 'veryHidden' });
      lookup.values.forEach((v, i) => lk.getCell(i + 1, 1).value = v);
      const lastRow = Math.max(1, lookup.values.length);
      // Cross-sheet refs need quoting if sheet name has odd chars; ours is safe.
      lookupRefs.set(lookup.name, {
        sheetName,
        rangeRef: `${sheetName}!$A$1:$A$${lastRow}`,
      });
    }
  }

  const ws = wb.addWorksheet(opts.sheetName);

  // Header row
  ws.columns = opts.columns.map((c) => ({
    header: c.header + (c.required ? ' *' : ''),
    key: c.key,
    width: c.width ?? 22,
  }));
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  ws.getRow(1).fill = HEADER_FILL;
  ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(1).height = 22;

  // Mark required columns in red on the header
  opts.columns.forEach((c, i) => {
    if (c.required) {
      const cell = ws.getRow(1).getCell(i + 1);
      cell.font = { bold: true, color: { argb: 'FFFEE2E2' }, size: 11 };
    }
  });

  // Example row (row 2)
  const exampleRow: Record<string, unknown> = {};
  opts.columns.forEach((c) => {
    if (c.example !== undefined) exampleRow[c.key] = c.example;
  });
  if (Object.keys(exampleRow).length > 0) {
    ws.addRow(exampleRow);
    ws.getRow(2).font = { italic: true, color: { argb: 'FF94A3B8' } };
    ws.getRow(2).fill = REQUIRED_FILL;
  }

  // Data validation for enum / lookup columns
  opts.columns.forEach((c, i) => {
    let formula: string | null = null;
    let errorMsg: string | null = null;
    if (c.lookupSheet) {
      const ref = lookupRefs.get(c.lookupSheet);
      if (ref) {
        formula = `=${ref.rangeRef}`;
        errorMsg = `Pick a value from the ${c.lookupSheet} list`;
      }
    } else if (c.enumValues?.length) {
      // Inline list — Excel hard-limits this to 255 chars including commas + quotes.
      // Escape double-quotes inside values (Excel formula uses "" to escape ").
      const safe = c.enumValues.map((v) => String(v).replace(/"/g, '""'));
      const inline = safe.join(',');
      if (inline.length <= 250) {
        formula = `"${inline}"`;
        errorMsg = `Allowed: ${c.enumValues.join(', ')}`;
      } else {
        // Fall back to an ad-hoc hidden sheet for large enums.
        const safe = c.key.replace(/[^A-Za-z0-9]/g, '_').slice(0, 24);
        const sheetName = `_lk_${safe}`;
        const lk = wb.addWorksheet(sheetName, { state: 'veryHidden' });
        c.enumValues.forEach((v, idx) => lk.getCell(idx + 1, 1).value = v);
        formula = `=${sheetName}!$A$1:$A$${c.enumValues.length}`;
        errorMsg = `Pick a value from the ${c.key} list`;
      }
    }
    if (!formula) return;
    // Apply list validation to rows 2..2000
    for (let r = 2; r <= 2000; r += 1) {
      ws.getCell(r, i + 1).dataValidation = {
        type: 'list',
        allowBlank: !c.required,
        formulae: [formula],
        showErrorMessage: true,
        errorTitle: 'Invalid value',
        error: errorMsg ?? 'Invalid value',
      };
    }
  });

  // Freeze header
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  // Instructions sheet
  if (opts.instructions?.length) {
    const instr = wb.addWorksheet('Instructions');
    instr.getColumn(1).width = 100;
    instr.getRow(1).values = ['Bulk import instructions'];
    instr.getRow(1).font = { bold: true, size: 14 };
    opts.instructions.forEach((line, i) => {
      const r = instr.getRow(i + 3);
      r.values = [line];
      r.alignment = { wrapText: true, vertical: 'top' };
      r.height = 18;
    });
    const colSheet = wb.addWorksheet('Columns');
    colSheet.columns = [
      { header: 'Column', key: 'header', width: 28 },
      { header: 'Required?', key: 'req', width: 12 },
      { header: 'Allowed values / Notes', key: 'note', width: 80 },
    ];
    colSheet.getRow(1).font = { bold: true };
    opts.columns.forEach((c) => {
      colSheet.addRow({
        header: c.header,
        req: c.required ? 'Yes' : 'No',
        note: c.enumValues?.length
          ? `One of: ${c.enumValues.join(', ')}${c.note ? ` — ${c.note}` : ''}`
          : c.note ?? '',
      });
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** Read an uploaded .xlsx buffer and return rows keyed by column.key. */
export async function parseUpload<T extends Record<string, unknown>>(opts: {
  buffer: Buffer;
  columns: ColumnSpec[];
  /** Preferred data-sheet name; falls back to the first visible non-helper sheet. */
  sheetName?: string;
}): Promise<T[]> {
  const wb = new ExcelJS.Workbook();
  // exceljs typings predate Buffer/ArrayBuffer narrowing; cast through unknown.
  await (wb.xlsx.load as unknown as (b: Uint8Array) => Promise<unknown>)(opts.buffer);
  // Templates built by buildTemplate() put hidden lookup sheets (_lk_*) FIRST,
  // so worksheets[0] is NOT the data sheet. Pick by name, else first visible
  // sheet that isn't a lookup/Instructions/Columns helper.
  const helperNames = new Set(['instructions', 'columns']);
  const isHelper = (s: ExcelJS.Worksheet): boolean =>
    s.name.startsWith('_lk_') || helperNames.has(s.name.trim().toLowerCase());
  const candidates = wb.worksheets.filter((s) => !isHelper(s));
  const ws =
    (opts.sheetName
      ? wb.worksheets.find(
          (s) => s.name.trim().toLowerCase() === opts.sheetName!.trim().toLowerCase(),
        )
      : undefined) ??
    candidates.find((s) => s.state === 'visible') ??
    candidates[0] ??
    wb.worksheets[0];
  if (!ws) return [];

  // Map header text -> column key
  const headerRow = ws.getRow(1);
  const headerMap = new Map<number, string>();
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const text = String(cell.value ?? '').replace(/\s*\*$/, '').trim();
    const match = opts.columns.find(
      (c) => c.header.toLowerCase() === text.toLowerCase() || c.key.toLowerCase() === text.toLowerCase(),
    );
    if (match) headerMap.set(colNumber, match.key);
  });

  // Detect the template's example row (row 2) when the user forgot to delete
  // it: every required column that ships an example still holds that example.
  const exampleChecks = opts.columns.filter((c) => c.required && c.example !== undefined);
  const isExampleRow = (obj: Record<string, unknown>): boolean =>
    exampleChecks.length > 0 &&
    exampleChecks.every(
      (c) => String(obj[c.key] ?? '').trim().toLowerCase() === String(c.example).trim().toLowerCase(),
    );

  const out: T[] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const obj: Record<string, unknown> = {};
    let nonEmpty = false;
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const key = headerMap.get(colNumber);
      if (!key) return;
      let value: unknown = cell.value;
      // Normalise common cell shapes
      if (typeof value === 'object' && value !== null) {
        const obj2 = value as { text?: string; result?: unknown; richText?: unknown[] };
        if ('text' in obj2 && typeof obj2.text === 'string') value = obj2.text;
        else if ('result' in obj2) value = obj2.result;
        else if (Array.isArray(obj2.richText)) {
          value = (obj2.richText as Array<{ text?: string }>).map((r) => r.text ?? '').join('');
        }
      }
      if (value === null || value === undefined) return;
      const trimmed = typeof value === 'string' ? value.trim() : value;
      if (trimmed === '') return;
      obj[key] = trimmed;
      nonEmpty = true;
    });
    if (nonEmpty && !isExampleRow(obj)) out.push(obj as T);
  });
  return out;
}

/** Build a data-export workbook for the given rows. */
export async function buildExport(opts: {
  sheetName: string;
  columns: ColumnSpec[];
  rows: Record<string, unknown>[];
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'DeskHub';
  wb.created = new Date();
  const ws = wb.addWorksheet(opts.sheetName);
  ws.columns = opts.columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 22 }));
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = HEADER_FILL;
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  opts.rows.forEach((row) => ws.addRow(row));
  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
