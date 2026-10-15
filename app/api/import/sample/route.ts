import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { guard, handleError } from '@/lib/api/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Generate a downloadable sample .xlsx workbook so users can see the expected
 * column layout before preparing their own import file. This is read-only: it
 * never touches the database.
 */

const INVENTORY_HEADERS = [
  'name',
  'category',
  'unit',
  'packageSize',
  'currentStock',
  'lowStockThreshold',
  'expiryDate',
  'currentSellingPrice',
  'lastSupplierCost',
];

const INVENTORY_ROWS = [
  ['Palm Oil 1L', 'Cooking Oil', 'bottle', '1 L', 120, 20, '2026-12-31', 5800, 5000],
  ['Rice 25kg', 'Staples', 'bag', '25 kg', 40, 10, '2027-06-30', 33000, 30000],
  ['Milk Powder 900g', 'Dairy', 'can', '900 g', 60, 15, '2026-09-30', 12500, 11000],
];

const PRICE_HEADERS = ['productName', 'newPrice', 'effectiveDate'];

const PRICE_ROWS = [
  ['Palm Oil 1L', 5800, '2026-01-01'],
  ['Rice 25kg', 33000, '2026-01-01'],
  ['Milk Powder 900g', 12500, '2026-01-01'],
];

export async function GET(req: NextRequest) {
  try {
    const g = guard(req, ['retailer', 'wholesaler']);
    if (g.response) return g.response;

    const mode = new URL(req.url).searchParams.get('mode') === 'prices' ? 'prices' : 'inventory';
    const headers = mode === 'prices' ? PRICE_HEADERS : INVENTORY_HEADERS;
    const rows = mode === 'prices' ? PRICE_ROWS : INVENTORY_ROWS;

    const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    sheet['!cols'] = headers.map((h) => ({ wch: Math.max(14, h.length + 4) }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, mode === 'prices' ? 'Prices' : 'Inventory');
    const buf = new Uint8Array(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));

    const filename = mode === 'prices' ? 'pricepulse-prices-sample.xlsx' : 'pricepulse-inventory-sample.xlsx';
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buf.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
