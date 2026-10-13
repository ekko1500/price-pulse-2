import { DatabaseSchema } from '../seed/demo';
import { SupplierConnection, SupplierProduct, UserRole } from '../types';
import { AuthContext } from './session';

/**
 * Central authorization predicates. Every API route must call these BEFORE
 * returning data or performing writes. UI hiding is not security.
 */

export function hasRole(ctx: AuthContext, ...roles: UserRole[]): boolean {
  return roles.includes(ctx.user.role);
}

/** True when there is an active connection between the given retailer and wholesaler. */
export function hasActiveConnection(
  data: DatabaseSchema,
  retailerId: string,
  wholesalerId: string
): boolean {
  return Object.values(data.connections).some(
    (c) =>
      c.retailerId === retailerId &&
      c.wholesalerId === wholesalerId &&
      c.status === 'active'
  );
}

export function activeConnection(
  data: DatabaseSchema,
  retailerId: string,
  wholesalerId: string
): SupplierConnection | undefined {
  return Object.values(data.connections).find(
    (c) => c.retailerId === retailerId && c.wholesalerId === wholesalerId && c.status === 'active'
  );
}

/** A wholesaler may only act on products they own. */
export function ownsProduct(ctx: AuthContext, product: SupplierProduct | undefined): boolean {
  return !!product && product.wholesalerId === ctx.business.id;
}

/** Visible supplier products for a caller. */
export function visibleProducts(data: DatabaseSchema, ctx: AuthContext): SupplierProduct[] {
  const all = Object.values(data.products);
  if (ctx.user.role === 'admin') return all;
  if (ctx.user.role === 'wholesaler') {
    return all.filter((p) => p.wholesalerId === ctx.business.id);
  }
  // retailer: only products from actively connected wholesalers
  const connected = new Set(
    Object.values(data.connections)
      .filter((c) => c.retailerId === ctx.business.id && c.status === 'active')
      .map((c) => c.wholesalerId)
  );
  return all.filter((p) => connected.has(p.wholesalerId) && p.isActive);
}
