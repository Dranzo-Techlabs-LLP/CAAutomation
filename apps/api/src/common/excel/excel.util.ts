import ExcelJS from 'exceljs';

export interface ColumnSpec {
  key: string;
  header: string;
  width?: number;
  required?: boolean;
  enumValues?: string[];
  example?: string | number | boolean;
  note?: string;
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
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'DeskHub';
  wb.created = new Date();

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

  // Data validation for enum columns
  opts.columns.forEach((c, i) => {
    if (c.enumValues?.length) {
      ws.getColumn(i + 1).eachCell({ includeEmpty: false }, () => {});
      // Apply list validation to rows 2..1000
      for (let r = 2; r <= 1000; r += 1) {
        ws.getCell(r, i + 1).dataValidation = {
          type: 'list',
          allowBlank: !c.required,
          formulae: [`"${c.enumValues.join(',')}"`],
          showErrorMessage: true,
          errorTitle: 'Invalid value',
          error: `Allowed: ${c.enumValues.join(', ')}`,
        };
      }
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
}): Promise<T[]> {
  const wb = new ExcelJS.Workbook();
  // exceljs typings predate Buffer/ArrayBuffer narrowing; cast through unknown.
  await (wb.xlsx.load as unknown as (b: Uint8Array) => Promise<unknown>)(opts.buffer);
  const ws = wb.worksheets[0];
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
    if (nonEmpty) out.push(obj as T);
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
