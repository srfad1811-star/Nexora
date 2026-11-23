import type { PermissionKey, StaffRole } from '../types/ecommerce';

export function formatPrice(amount: number, symbol = 'Rs.'): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `${symbol} ${Math.round(safe).toLocaleString('en-PK')}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function generateId(prefix = 'id'): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export function getDiscountPercent(price: number, salePrice?: number): number {
  if (!salePrice || salePrice >= price || price <= 0) return 0;
  return Math.round(((price - salePrice) / price) * 100);
}

export function exportToCsv(filename: string, rows: Record<string, unknown>[]): void {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (val: unknown) => {
    const str = val === null || val === undefined ? '' : String(val);
    return `"${str.replace(/"/g, '""')}"`;
  };
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(',')),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const ROLE_LABELS: Record<StaffRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  store_manager: 'Store Manager',
  product_manager: 'Product Manager',
  order_manager: 'Order Manager',
  support_agent: 'Support Agent',
};

export const ROLE_PERMISSIONS: Record<StaffRole, PermissionKey[]> = {
  super_admin: [
    'products.view',
    'products.create',
    'products.edit',
    'products.delete',
    'orders.view',
    'orders.manage',
    'orders.refund',
    'customers.view',
    'customers.manage',
    'inventory.manage',
    'marketing.manage',
    'cms.manage',
    'analytics.view',
    'staff.manage',
    'settings.manage',
  ],
  admin: [
    'products.view',
    'products.create',
    'products.edit',
    'products.delete',
    'orders.view',
    'orders.manage',
    'orders.refund',
    'customers.view',
    'customers.manage',
    'inventory.manage',
    'marketing.manage',
    'cms.manage',
    'analytics.view',
    'settings.manage',
  ],
  store_manager: [
    'products.view',
    'products.create',
    'products.edit',
    'orders.view',
    'orders.manage',
    'orders.refund',
    'customers.view',
    'inventory.manage',
    'marketing.manage',
    'cms.manage',
    'analytics.view',
  ],
  product_manager: [
    'products.view',
    'products.create',
    'products.edit',
    'products.delete',
    'inventory.manage',
  ],
  order_manager: ['orders.view', 'orders.manage', 'orders.refund', 'customers.view'],
  support_agent: ['orders.view', 'customers.view', 'orders.refund'],
};

export const PAKISTAN_CITIES = [
  'Lahore',
  'Karachi',
  'Islamabad',
  'Rawalpindi',
  'Faisalabad',
  'Multan',
  'Peshawar',
  'Quetta',
  'Sialkot',
  'Gujranwala',
  'Hyderabad',
  'Bahawalpur',
];
