import { NextRequest } from 'next/server';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { guard, json, fail, handleError } from '@/lib/api/http';

export const runtime = 'nodejs';

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_ROWS = 2000;

/**
 * Parse an uploaded CSV/Excel file into headers + rows for column mapping.
 * Validates by content signature (not just extension), and enforces size and
 * row limits. Nothing is written to the database here.
 */
export async function POST(req: NextRequest) {
  try {
    const g = guard(req, ['retailer', 'wholesaler']);
    if (g.response) return g.response;

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return fail('VALIDATION', 'Attach a CSV or Excel file.', 422);
    if (file.size === 0) return fail('VALIDATION', 'The uploaded file is empty.', 422);
    if (file.size > MAX_BYTES) return fail('TOO_LARGE', 'File exceeds the 2 MB limit.', 413);

    const buf = Buffer.from(await file.arrayBuffer());
    const isZip = buf.length > 3 && buf[0] === 0x50 && buf[1] === 0x4b; // .xlsx is a zip

    let records: Record<string, unknown>[] = [];
    if (isZip) {
      try {
        const wb = XLSX.read(buf, { type: 'buffer' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      } catch {
        return fail('PARSE_ERROR', 'Could not read the Excel file. Use a valid .xlsx file.', 422);
      }
    } else {
      const text = buf.toString('utf8');
      const parsed = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true });
      if (parsed.errors.length > 0 && parsed.data.length === 0) {
        return fail('PARSE_ERROR', 'Could not read the CSV file.', 422);
      }
      records = parsed.data;
    }

    if (records.length === 0) return fail('EMPTY', 'No data rows were found in the file.', 422);
    if (records.length > MAX_ROWS) return fail('TOO_MANY_ROWS', `Too many rows (${records.length}). Limit is ${MAX_ROWS}.`, 413);

    const headers = Object.keys(records[0]);
    return json({ headers, rows: records.slice(0, 50), totalRows: records.length, allRows: records });
  } catch (e) {
    return handleError(e);
  }
}
