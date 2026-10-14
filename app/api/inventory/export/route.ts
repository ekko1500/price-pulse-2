import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import { dbStore } from '@/lib/db/store';
import { guard, handleError } from '@/lib/api/http';
import { recordAudit } from '@/lib/services/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COLUMNS = [
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

function slug(input: string): string {
  const s = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return s || 'inventory';
}

/**
 * Export the retailer's inventory as CSV. Reference thumbnails are centralised
 * (Firebase Storage) and intentionally not part of the export.
 */
export async function GET(req: NextRequest) {
  try {
    await dbStore.ready();
    const g = guard(req, ['retailer']);
    if (g.response) return g.response;
    const ctx = g.ctx!;

    const items = Object.values(dbStore.getData().inventory).filter((i) => i.retailerId === ctx.business.id);
    const rows = items.map((i) => ({
      name: i.name,
      category: i.category,
      unit: i.unit,
      packageSize: i.packageSize ?? '',
      currentStock: i.currentStock,
      lowStockThreshold: i.lowStockThreshold,
      expiryDate: i.expiryDate ?? '',
      currentSellingPrice: i.currentSellingPrice,
      lastSupplierCost: i.lastSupplierCost,
    }));
    const csv = Papa.unparse(rows, { columns: COLUMNS });

    await dbStore.exclusive(async () => {
      recordAudit(dbStore.getData(), {
        actorId: ctx.user.id,
        actorName: ctx.business.name,
        actorRole: ctx.user.role,
        action: 'INVENTORY_EXPORTED',
        targetType: 'INVENTORY',
        targetId: 'csv',
        details: { itemCount: items.length },
        isDemo: ctx.isDemo,
      });
    });

    const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `${slug(ctx.business.name)}-${day}.csv`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
