import client, { multipartConfig, toFormData } from './client';

// The agency's cars, clients and rentals from spreadsheets (API: App\Support\AgencyImport), owner only.
export type ImportKind = 'cars'|'clients'|'rentals';
export const IMPORT_KINDS: ImportKind[] = [ 'cars', 'clients', 'rentals' ]; // in this order: rentals name cars and clients

// How a cell is read.
export type ColumnType = 'text'|'plate'|'vin'|'int'|'year'|'money'|'date'|'datetime'|'phone'|'choice';

export interface ImportColumn {
  name: string,
  type: ColumnType,
  required: boolean,
  label: string, // translation key
  example: string|null,
  options: { value: number, label: string, words: string[] }[]|null, // a choice: the words read as each value, the first one the templates write
}

export type ImportGuide = Record<ImportKind, { columns: ImportColumn[], template_url: string }>;

// What columns mean beyond their label and format, by `kind.column`.
export const COLUMN_HINTS: Record<string, string> = {
  'rentals.daily_price': 'import:hint:daily_price',
  'rentals.paid': 'import:hint:paid',
  'rentals.method': 'import:hint:method',
  'rentals.starts_at': 'import:hint:times',
  'rentals.ends_at': 'import:hint:times',
  'clients.flag': 'import:hint:flag',
};

// A change made reading a cell: `sure` when only the format changed (22 123 456 → +21622123456),
// a guess otherwise (Gazoil → diesel), for the user to confirm or correct. `to` reads again as is.
export interface ImportFix {
  column: string,
  from: string|null,
  to: string,
  sure: boolean,
}

// `code` is a translation key (import:error:*, contract:overlap, car:sold) taking `params` and the column's label.
export interface ImportError {
  column: string,
  code: string,
  params: Record<string, string|number>,
}

export type Cells = Record<string, string|null>; // by column name

export interface ImportRow {
  line: number, // the spreadsheet's row number (the column names are row 1)
  cells: Cells, // as typed
  fixes: ImportFix[],
  errors: ImportError[],
  result: 'new'|'updated'|'unchanged'|'rejected',
}

export interface ImportDataset {
  rows: ImportRow[],
  counts: { new: number, updated: number, unchanged: number, rejected: number },
  // An uploaded file's first row: names read as columns (a guess when only close), names not used, required columns missing.
  header?: { fixes: { from: string, to: string, sure: boolean }[], ignored: string[], missing: string[] },
}

export type ImportReport = Partial<Record<ImportKind, ImportDataset>>;

export function guide(): Promise<ImportGuide> {
  return client.get('import').then(response => response.data.data);
}

// Reads and checks uploaded files (the phone: { uri, name, type }; the web: a File). Nothing is saved.
// A 422 on `files.cars`... is the file itself: import:error:xlsx, import:error:empty, import:error:too_many.
export function checkFiles(files: Partial<Record<ImportKind, any>>): Promise<ImportReport> {
  return client.post('import', toFormData({ files }), multipartConfig).then(response => response.data.data);
}

// Checks the rows again with the user's corrections, or with `apply` saves them.
export function checkRows(rows: Partial<Record<ImportKind, { line: number, cells: Cells }[]>>, apply = false): Promise<ImportReport> {
  return client.post('import', { rows, apply }).then(response => response.data.data);
}

// The user's review of a check: the cells they changed, the guesses they confirmed, the rows left out.
export interface ImportReview {
  edits: Record<string, Cells>, // rowKey → column → as typed
  confirmed: string[], // fixKey, or headerKey
  skipped: string[], // rowKey
}

export const emptyReview: ImportReview = { edits: {}, confirmed: [], skipped: [] };
export const rowKey = (kind: ImportKind, row: ImportRow) => kind + ':' + row.line;
export const fixKey = (kind: ImportKind, row: ImportRow, fix: ImportFix) => rowKey(kind, row) + ':' + fix.column;
export const headerKey = (kind: ImportKind, from: string) => kind + ':header:' + from;

export interface PendingGuess {
  kind: ImportKind,
  key: string,
  row?: ImportRow,
}

// Guesses nobody confirmed or corrected yet, in rows not left out: they hold the import back.
export function pendingGuesses(report: ImportReport, review: ImportReview): PendingGuess[] {
  return IMPORT_KINDS.flatMap(kind => {
    const dataset = report[kind];
    if (! dataset) {
      return [];
    }
    const header = (dataset.header?.fixes ?? []).filter(fix => ! fix.sure).map(fix => ({ kind, key: headerKey(kind, fix.from) }));
    const rows = dataset.rows.filter(row => ! review.skipped.includes(rowKey(kind, row))).flatMap(row => row.fixes
      .filter(fix => ! fix.sure && review.edits[rowKey(kind, row)]?.[fix.column] === undefined)
      .map(fix => ({ kind, key: fixKey(kind, row, fix), row })));
    return [ ...header, ...rows ].filter(guess => ! review.confirmed.includes(guess.key));
  });
}

// The rows to send back: rows left out dropped, the format fixes and confirmed guesses written into
// the cells (so they read again without a fix), then what the user typed.
export function rowsToSend(report: ImportReport, review: ImportReview): Partial<Record<ImportKind, { line: number, cells: Cells }[]>> {
  const rows: Partial<Record<ImportKind, { line: number, cells: Cells }[]>> = {};
  for (const kind of IMPORT_KINDS) {
    const dataset = report[kind];
    if (dataset) {
      rows[kind] = dataset.rows.filter(row => ! review.skipped.includes(rowKey(kind, row))).map(row => {
        const fixed = row.fixes.filter(fix => fix.sure || review.confirmed.includes(fixKey(kind, row, fix)));
        return { line: row.line, cells: { ...row.cells, ...Object.fromEntries(fixed.map(fix => [ fix.column, fix.to ])), ...review.edits[rowKey(kind, row)] } };
      });
    }
  }
  return rows;
}

// Rows the import would save as they are (new or updated), rows left out aside.
export function importableCount(report: ImportReport, review: ImportReview): number {
  return IMPORT_KINDS.reduce((sum, kind) => sum + (report[kind]?.rows ?? [])
    .filter(row => (row.result === 'new' || row.result === 'updated') && ! review.skipped.includes(rowKey(kind, row))).length, 0);
}
