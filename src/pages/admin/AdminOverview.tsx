import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, Download, Printer } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useAdmin } from '../../context/AdminContext';
import { exportToCsv, formatPrice } from '../../lib/utils';

type RangeKey = '7d' | '30d' | '90d' | 'all';

export function AdminOverview() {
  const { allProducts, categories, settings } = useStore();
  const { orders, customers, returns } = useAdmin();
  const [range, setRange] = useState<RangeKey>('30d');

  const filteredOrders = useMemo(() => {
    if (range === 'all') return orders;
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const cutoff = Date.now() - days * 86_400_000;
    return orders.filter((o) => new Date(o.createdAt).getTime() >= cutoff);
  }, [orders, range]);

  const activeOrders = filteredOrders.filter((o) => o.status !== 'cancelled' && o.status !== 'refunded');
  const totalRevenue = activeOrders.reduce((s, o) => s + o.total, 0);
  const avgOrderValue = activeOrders.length > 0 ? Math.round(totalRevenue / activeOrders.length) : 0;
  const pendingOrders = filteredOrders.filter((o) => o.status === 'pending').length;
  const completedOrders = filteredOrders.filter((o) => o.status === 'delivered').length;
  const cancelledOrders = filteredOrders.filter((o) => o.status === 'cancelled').length;
  const refundTotal = returns
    .filter((r) => r.status === 'refunded' || r.status === 'approved')
    .reduce((s, r) => s + r.amount, 0);

  const lowStockProducts = allProducts.filter(
    (p) => p.stock <= (p.lowStockThreshold ?? 8)
  );

  // Build daily revenue chart directly from database orders
  const revenueSeries = useMemo(() => {
    const map = new Map<string, { date: string; revenue: number; orders: number }>();
    for (const o of activeOrders) {
      const day = o.createdAt.slice(0, 10);
      const cur = map.get(day) || { date: day, revenue: 0, orders: 0 };
      cur.revenue += o.total;
      cur.orders += 1;
      map.set(day, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [activeOrders]);

  // Category revenue breakdown
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of activeOrders) {
      for (const item of o.items) {
        const prod = allProducts.find((p) => p.id === item.productId);
        const catName = prod?.categoryName || 'General';
        map.set(catName, (map.get(catName) || 0) + item.lineTotal);
      }
    }
    if (map.size === 0) {
      return categories.map((c) => ({
        name: c.name,
        revenue: allProducts
          .filter((p) => p.categoryId === c.id)
          .reduce((s, p) => s + (p.salesCount || 0) * (p.salePrice || p.price), 0),
      }));
    }
    return Array.from(map.entries()).map(([name, revenue]) => ({ name, revenue }));
  }, [activeOrders, allProducts, categories]);

  const topSelling = [...allProducts]
    .sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0))
    .slice(0, 5);

  const handleExportReport = () => {
    exportToCsv(
      `nexora-overview-${range}.csv`,
      filteredOrders.map((o) => ({
        orderNumber: o.orderNumber,
        customer: o.customerName,
        email: o.customerEmail,
        status: o.status,
        paymentMethod: o.paymentMethod,
        total: o.total,
        createdAt: o.createdAt,
      }))
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Dashboard Overview</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Live metrics aggregated directly from Firestore orders, inventory, and customer records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          <div className="inline-flex p-1 rounded-lg bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800">
            {(['7d', '30d', '90d', 'all'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`px-3 py-1 text-xs font-medium rounded-md uppercase ${
                  range === r ? 'bg-[#6D5BD0] text-white' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleExportReport}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#14161D] hover:bg-zinc-50"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
          >
            <Printer className="w-3.5 h-3.5" />
            Print PDF
          </button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-white dark:bg-[#14161D] border border-zinc-200/80 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">Total Revenue</p>
          <p className="text-2xl font-bold font-mono tabular-nums mt-1">
            {formatPrice(totalRevenue, settings.currencySymbol)}
          </p>
          <p className="text-xs text-zinc-500 mt-1 tabular-nums">{activeOrders.length} active orders</p>
        </div>
        <div className="p-5 rounded-xl bg-white dark:bg-[#14161D] border border-zinc-200/80 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">Average Order Value</p>
          <p className="text-2xl font-bold font-mono tabular-nums mt-1">
            {formatPrice(avgOrderValue, settings.currencySymbol)}
          </p>
          <p className="text-xs text-zinc-500 mt-1 tabular-nums">
            {completedOrders} delivered · {pendingOrders} pending
          </p>
        </div>
        <div className="p-5 rounded-xl bg-white dark:bg-[#14161D] border border-zinc-200/80 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">Customers &amp; Products</p>
          <p className="text-2xl font-bold font-mono tabular-nums mt-1">
            {customers.length} <span className="text-sm font-normal text-zinc-400">/ {allProducts.length} SKUs</span>
          </p>
          <p className="text-xs text-zinc-500 mt-1 tabular-nums">{lowStockProducts.length} low-stock alerts</p>
        </div>
        <div className="p-5 rounded-xl bg-white dark:bg-[#14161D] border border-zinc-200/80 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">Refunds &amp; Cancellations</p>
          <p className="text-2xl font-bold font-mono tabular-nums mt-1">
            {formatPrice(refundTotal, settings.currencySymbol)}
          </p>
          <p className="text-xs text-zinc-500 mt-1 tabular-nums">{cancelledOrders} cancelled orders</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 p-6 rounded-xl bg-white dark:bg-[#14161D] border border-zinc-200/80 dark:border-zinc-800">
          <h2 className="text-sm font-semibold mb-4">Revenue Trend ({settings.currencyCode})</h2>
          {revenueSeries.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-zinc-500">
              Place orders in the storefront to populate daily revenue analytics.
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="revenue" stroke="#6D5BD0" fill="#6D5BD0" fillOpacity={0.16} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 p-6 rounded-xl bg-white dark:bg-[#14161D] border border-zinc-200/80 dark:border-zinc-800">
          <h2 className="text-sm font-semibold mb-4">Category Performance</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="revenue" fill="#6D5BD0" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Lower Tables: Top Products, Low Stock & Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 p-6 rounded-xl bg-white dark:bg-[#14161D] border border-zinc-200/80 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Top-Selling Products</h2>
            <Link to="/admin/products" className="text-xs text-[#6D5BD0] hover:underline">Manage</Link>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
            {topSelling.map((p) => (
              <div key={p.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{p.title}</p>
                  <p className="text-zinc-500 font-mono">{p.sku}</p>
                </div>
                <div className="text-right tabular-nums shrink-0">
                  <p className="font-mono font-semibold">{p.salesCount || 0} sold</p>
                  <p className="text-zinc-500">{p.stock} in stock</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-6 p-6 rounded-xl bg-white dark:bg-[#14161D] border border-zinc-200/80 dark:border-zinc-800 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Low-Stock Alerts ({lowStockProducts.length})
              </h2>
              <Link to="/admin/inventory" className="text-xs text-[#6D5BD0] hover:underline">Replenish</Link>
            </div>
            {lowStockProducts.length === 0 ? (
              <p className="text-xs text-zinc-500">All SKUs are above safety thresholds.</p>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                {lowStockProducts.slice(0, 4).map((p) => (
                  <div key={p.id} className="py-2 flex justify-between">
                    <span className="truncate pr-3">{p.title}</span>
                    <span className="font-mono font-semibold text-amber-600 tabular-nums shrink-0">
                      {p.stock} left
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Recent Orders</h2>
              <Link to="/admin/orders" className="text-xs text-[#6D5BD0] hover:underline">All Orders</Link>
            </div>
            {filteredOrders.length === 0 ? (
              <p className="text-xs text-zinc-500">No orders recorded yet.</p>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                {filteredOrders.slice(0, 4).map((o) => (
                  <div key={o.id} className="py-2 flex justify-between items-center">
                    <div>
                      <span className="font-mono font-semibold">{o.orderNumber}</span>
                      <span className="text-zinc-500 ml-2">{o.customerName}</span>
                    </div>
                    <span className="font-mono font-semibold tabular-nums">
                      {formatPrice(o.total, settings.currencySymbol)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
