import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CreditCard,
  Download,
  Eye,
  Printer,
  RotateCcw,
  Search,
  ShieldAlert,
  Truck,
  X,
} from 'lucide-react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { useAdmin } from '../../context/AdminContext';
import { exportToCsv, formatPrice, generateId } from '../../lib/utils';
import type { Order, OrderStatus, PaymentStatus, ReturnRequest, UserProfile } from '../../types/ecommerce';

const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'processing',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
];

const STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  confirmed: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900',
  processing: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900',
  packed: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900',
  shipped: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900',
  delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  cancelled: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900',
  refunded: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
};

const PAYMENT_STATUS_CLASS: Record<PaymentStatus, string> = {
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  pending: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  awaiting_verification: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900',
  failed: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900',
  refunded: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
};

// ============================================================================
// 1. Orders Management
// ============================================================================
export function AdminOrdersPage() {
  const { user } = useAuth();
  const { settings, pushToast } = useStore();
  const { orders, logActivity } = useAdmin();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [printMode, setPrintMode] = useState<'invoice' | 'packing_slip'>('invoice');

  // Fulfillment form state for selectedOrder
  const [nextStatus, setNextStatus] = useState<OrderStatus>('pending');
  const [nextPaymentStatus, setNextPaymentStatus] = useState<PaymentStatus>('pending');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [deliveryPartner, setDeliveryPartner] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...orders]
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .filter((o) => {
        if (statusFilter !== 'all' && o.status !== statusFilter) return false;
        if (q) {
          const hay = `${o.orderNumber} ${o.customerName} ${o.customerEmail} ${o.trackingNumber || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
  }, [orders, search, statusFilter]);

  const openOrder = (order: Order) => {
    setSelectedOrder(order);
    setNextStatus(order.status);
    setNextPaymentStatus(order.paymentStatus);
    setTrackingNumber(order.trackingNumber || '');
    setDeliveryPartner(order.deliveryPartner || settings.deliveryPartners[0] || 'TCS Express');
    setInternalNotes(order.internalNotes || '');
    setStatusNote('');
  };

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setSaving(true);
    const now = new Date().toISOString();
    const history = [...(selectedOrder.statusHistory || [])];
    if (nextStatus !== selectedOrder.status || statusNote.trim()) {
      history.push({
        status: nextStatus,
        note: statusNote.trim() || `Status updated to ${nextStatus}`,
        actorEmail: user?.email || 'staff',
        timestamp: now,
      });
    }

    try {
      await updateDoc(doc(db, 'orders', selectedOrder.id), {
        status: nextStatus,
        paymentStatus: nextPaymentStatus,
        trackingNumber: trackingNumber.trim(),
        deliveryPartner: deliveryPartner.trim(),
        internalNotes: internalNotes.trim(),
        statusHistory: history,
        updatedAt: now,
      });

      // Notify customer on status change
      if (nextStatus !== selectedOrder.status && selectedOrder.userId) {
        const notifId = generateId('ntf');
        await setDoc(doc(db, 'notifications', notifId), {
          id: notifId,
          recipientUid: selectedOrder.userId,
          title: `Order ${selectedOrder.orderNumber} ${nextStatus}`,
          message: trackingNumber.trim()
            ? `Your order is now ${nextStatus}. Tracking: ${trackingNumber.trim()} (${deliveryPartner}).`
            : `Your order status was updated to ${nextStatus}.`,
          read: false,
          link: '/account/orders',
          createdAt: now,
        }).catch(() => {});
      }

      await logActivity(
        'update_order',
        'order',
        selectedOrder.id,
        `${selectedOrder.orderNumber}: status=${nextStatus}, payment=${nextPaymentStatus}`
      );
      pushToast(`Order ${selectedOrder.orderNumber} updated`);
      setSelectedOrder({
        ...selectedOrder,
        status: nextStatus,
        paymentStatus: nextPaymentStatus,
        trackingNumber: trackingNumber.trim(),
        deliveryPartner: deliveryPartner.trim(),
        internalNotes: internalNotes.trim(),
        statusHistory: history,
        updatedAt: now,
      });
      setStatusNote('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${selectedOrder.id}`);
    } finally {
      setSaving(false);
    }
  };

  const triggerPrint = (mode: 'invoice' | 'packing_slip') => {
    setPrintMode(mode);
    setTimeout(() => window.print(), 60);
  };

  const handleExportCsv = () => {
    exportToCsv(
      `nexora-orders-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((o) => ({
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        customerEmail: o.customerEmail,
        city: o.shippingAddress?.city || '',
        itemsCount: o.items.reduce((s, i) => s + i.quantity, 0),
        total: o.total,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
        status: o.status,
        trackingNumber: o.trackingNumber || '',
        createdAt: o.createdAt,
      }))
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Orders</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Track fulfillment stages, assign courier tracking, and print customer invoices or packing slips.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#14161D] text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      {/* Main Orders Table Card */}
      <div className="bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden no-print">
        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">All Orders ({filtered.length})</h2>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Order #, customer, tracking..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 capitalize"
            >
              <option value="all">All Statuses</option>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50/70 dark:bg-zinc-900/50 text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
              <tr>
                <th className="py-3 px-4 font-medium">Order</th>
                <th className="py-3 px-4 font-medium">Customer</th>
                <th className="py-3 px-4 font-medium">Items</th>
                <th className="py-3 px-4 font-medium">Total</th>
                <th className="py-3 px-4 font-medium">Payment</th>
                <th className="py-3 px-4 font-medium">Fulfillment</th>
                <th className="py-3 px-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500">
                    No matching orders found.
                  </td>
                </tr>
              ) : (
                filtered.map((order) => (
                  <tr key={order.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/40">
                    <td className="py-3.5 px-4">
                      <p className="font-mono font-semibold">{order.orderNumber}</p>
                      <p className="text-[11px] text-zinc-500">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-medium">{order.customerName}</p>
                      <p className="text-[11px] text-zinc-500">
                        {order.shippingAddress?.city || order.customerEmail}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums">
                      {order.items.reduce((s, i) => s + i.quantity, 0)}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold tabular-nums">
                      {formatPrice(order.total, settings.currencySymbol)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <span className="block uppercase text-[10px] font-mono text-zinc-500">
                          {order.paymentMethod.replace('_', ' ')}
                        </span>
                        <span
                          className={`inline-block px-2 py-0.5 rounded border text-[11px] capitalize ${
                            PAYMENT_STATUS_CLASS[order.paymentStatus]
                          }`}
                        >
                          {order.paymentStatus.replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded border text-[11px] capitalize ${
                          STATUS_BADGE_CLASS[order.status]
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => openOrder(order)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Manage
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail & Fulfillment Modal / Printable View */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">
                  {printMode === 'packing_slip' ? 'Warehouse Packing Slip' : 'Official Order Invoice'}
                </p>
                <h2 className="font-display text-xl font-bold font-mono">{selectedOrder.orderNumber}</h2>
                <p className="text-xs text-zinc-500">
                  Placed {new Date(selectedOrder.createdAt).toLocaleString()} · {selectedOrder.customerName} ({selectedOrder.customerEmail})
                </p>
              </div>
              <div className="flex items-center gap-2 no-print">
                <button
                  type="button"
                  onClick={() => triggerPrint('invoice')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Invoice
                </button>
                <button
                  type="button"
                  onClick={() => triggerPrint('packing_slip')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium"
                >
                  <Truck className="w-3.5 h-3.5" />
                  Packing Slip
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 space-y-1.5">
                <p className="font-semibold text-zinc-700 dark:text-zinc-200">Shipping Destination</p>
                <p>{selectedOrder.shippingAddress?.fullName || selectedOrder.customerName}</p>
                <p>{selectedOrder.shippingAddress?.street}</p>
                <p>
                  {selectedOrder.shippingAddress?.city}, {selectedOrder.shippingAddress?.province}{' '}
                  {selectedOrder.shippingAddress?.postalCode}
                </p>
                <p>Phone: {selectedOrder.shippingAddress?.phone || selectedOrder.customerPhone || 'N/A'}</p>
                {selectedOrder.notes && (
                  <p className="pt-2 text-amber-600">Customer Note: {selectedOrder.notes}</p>
                )}
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 space-y-1.5">
                <p className="font-semibold text-zinc-700 dark:text-zinc-200">Payment &amp; Totals</p>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Method</span>
                  <span className="uppercase font-mono">{selectedOrder.paymentMethod.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Subtotal</span>
                  <span className="font-mono">{formatPrice(selectedOrder.subtotal, settings.currencySymbol)}</span>
                </div>
                {Boolean(selectedOrder.discountAmount) && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount ({selectedOrder.couponCode})</span>
                    <span className="font-mono">-{formatPrice(selectedOrder.discountAmount || 0, settings.currencySymbol)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-zinc-500">Shipping &amp; Tax</span>
                  <span className="font-mono">
                    {formatPrice((selectedOrder.shippingFee || 0) + (selectedOrder.taxAmount || 0) + (selectedOrder.codFee || 0), settings.currencySymbol)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-zinc-200 dark:border-zinc-800 font-semibold text-sm">
                  <span>Total</span>
                  <span className="font-mono">{formatPrice(selectedOrder.total, settings.currencySymbol)}</span>
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-900 text-zinc-500">
                  <tr>
                    <th className="py-2.5 px-4 font-medium">Item</th>
                    <th className="py-2.5 px-4 font-medium">SKU</th>
                    <th className="py-2.5 px-4 font-medium">Qty</th>
                    {printMode === 'invoice' && <th className="py-2.5 px-4 font-medium text-right">Line Total</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {selectedOrder.items.map((item, i) => (
                    <tr key={`${item.productId}-${i}`}>
                      <td className="py-2.5 px-4 font-medium">
                        {item.title}
                        {item.variantName && <span className="text-zinc-500 ml-1">({item.variantName})</span>}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-zinc-500">{item.sku}</td>
                      <td className="py-2.5 px-4 font-mono">{item.quantity}</td>
                      {printMode === 'invoice' && (
                        <td className="py-2.5 px-4 font-mono text-right">
                          {formatPrice(item.lineTotal, settings.currencySymbol)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Fulfillment Form (Hidden on print) */}
            <form onSubmit={handleSaveOrder} className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-4 no-print text-xs">
              <h3 className="text-sm font-semibold">Fulfillment &amp; Status Transition</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-zinc-500 mb-1">Order Status</label>
                  <select
                    value={nextStatus}
                    onChange={(e) => setNextStatus(e.target.value as OrderStatus)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 capitalize"
                  >
                    {ORDER_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-500 mb-1">Payment Status</label>
                  <select
                    value={nextPaymentStatus}
                    onChange={(e) => setNextPaymentStatus(e.target.value as PaymentStatus)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 capitalize"
                  >
                    {(['pending', 'awaiting_verification', 'paid', 'failed', 'refunded'] as PaymentStatus[]).map((p) => (
                      <option key={p} value={p}>
                        {p.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-500 mb-1">Courier Partner</label>
                  <select
                    value={deliveryPartner}
                    onChange={(e) => setDeliveryPartner(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                  >
                    {settings.deliveryPartners.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-500 mb-1">Tracking Number</label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="TCS-7891023"
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-500 mb-1">Timeline Update Note (Customer Visible)</label>
                  <input
                    type="text"
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    placeholder="Dispatched from Lahore hub"
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-zinc-500 mb-1">Internal Staff Notes</label>
                  <input
                    type="text"
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    placeholder="Verified phone call prior to COD dispatch"
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-[#6D5BD0] text-white font-medium hover:bg-[#5B49BF]"
                >
                  {saving ? 'Updating...' : 'Save Fulfillment Update'}
                </button>
              </div>
            </form>

            {/* Status History */}
            {(selectedOrder.statusHistory || []).length > 0 && (
              <div className="space-y-2 text-xs no-print">
                <p className="font-semibold text-zinc-500 uppercase tracking-wider text-[11px]">Status Audit Timeline</p>
                <div className="space-y-1.5">
                  {selectedOrder.statusHistory?.map((evt, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-zinc-50 dark:bg-zinc-900">
                      <span>
                        <strong className="capitalize">{evt.status}</strong> — {evt.note}
                      </span>
                      <span className="text-zinc-500 font-mono text-[11px]">
                        {new Date(evt.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 2. Customers Management
// ============================================================================
export function AdminCustomersPage() {
  const { isBootstrappedAdmin, staffRole } = useAuth();
  const { settings, pushToast } = useStore();
  const { customers, orders, logActivity } = useAdmin();

  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<UserProfile | null>(null);

  const canManageUsers = isBootstrappedAdmin || staffRole === 'super_admin' || staffRole === 'admin';

  const enriched = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers
      .map((c) => {
        const custOrders = orders.filter((o) => o.userId === c.uid && o.status !== 'cancelled');
        const computedSpent = custOrders.reduce((s, o) => s + (o.total || 0), 0);
        return {
          ...c,
          computedOrderCount: custOrders.length || c.orderCount || 0,
          computedSpent: computedSpent || c.totalSpent || 0,
        };
      })
      .filter((c) => {
        if (!q) return true;
        return `${c.displayName} ${c.email} ${c.phone || ''}`.toLowerCase().includes(q);
      });
  }, [customers, orders, search]);

  const handleGroupChange = async (cust: UserProfile, group: 'standard' | 'vip' | 'wholesale') => {
    if (!canManageUsers) {
      pushToast('Only Admin or Super Admin can modify customer groups', 'error');
      return;
    }
    try {
      await updateDoc(doc(db, 'users', cust.uid), {
        customerGroup: group,
        updatedAt: new Date().toISOString(),
      });
      await logActivity('update_customer_group', 'user', cust.uid, `${cust.email} -> ${group}`);
      pushToast(`Updated ${cust.displayName} to ${group.toUpperCase()}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${cust.uid}`);
    }
  };

  const handleToggleBlock = async (cust: UserProfile) => {
    if (!canManageUsers) {
      pushToast('Only Admin or Super Admin can block/unblock accounts', 'error');
      return;
    }
    const next = !cust.isBlocked;
    try {
      await updateDoc(doc(db, 'users', cust.uid), {
        isBlocked: next,
        updatedAt: new Date().toISOString(),
      });
      await logActivity(next ? 'block_customer' : 'unblock_customer', 'user', cust.uid, cust.email);
      pushToast(next ? `${cust.displayName} blocked` : `${cust.displayName} unblocked`, 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${cust.uid}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Customer directory, lifetime value, VIP segmentation, and order history.
          </p>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone..."
            className="pl-8 pr-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#14161D]"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50/70 dark:bg-zinc-900/50 text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
              <tr>
                <th className="py-3 px-4 font-medium">Customer</th>
                <th className="py-3 px-4 font-medium">Group</th>
                <th className="py-3 px-4 font-medium">Orders</th>
                <th className="py-3 px-4 font-medium">Lifetime Spent</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {enriched.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-zinc-500">
                    No customer accounts recorded yet.
                  </td>
                </tr>
              ) : (
                enriched.map((c) => (
                  <tr key={c.uid} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40">
                    <td className="py-3.5 px-4">
                      <p className="font-medium">{c.displayName}</p>
                      <p className="text-[11px] text-zinc-500">{c.email}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <select
                        value={c.customerGroup || 'standard'}
                        onChange={(e) => handleGroupChange(c, e.target.value as 'standard' | 'vip' | 'wholesale')}
                        className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-xs capitalize"
                      >
                        <option value="standard">Standard</option>
                        <option value="vip">VIP</option>
                        <option value="wholesale">Wholesale</option>
                      </select>
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums">{c.computedOrderCount}</td>
                    <td className="py-3.5 px-4 font-mono font-semibold tabular-nums">
                      {formatPrice(c.computedSpent, settings.currencySymbol)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded border text-[11px] ${
                          c.isBlocked
                            ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                        }`}
                      >
                        {c.isBlocked ? 'Blocked' : 'Active'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => setSelectedCustomer(c)}
                        className="px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        Orders
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleBlock(c)}
                        className="px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-700 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        {c.isBlocked ? 'Unblock' : 'Block'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <h2 className="font-display text-lg font-bold">{selectedCustomer.displayName}</h2>
                <p className="text-xs text-zinc-500">{selectedCustomer.email}</p>
              </div>
              <button type="button" onClick={() => setSelectedCustomer(null)} className="p-1.5">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <p className="font-semibold text-zinc-500 uppercase tracking-wider">Order History</p>
              {orders.filter((o) => o.userId === selectedCustomer.uid).length === 0 ? (
                <p className="text-zinc-500 py-4">No orders placed by this customer yet.</p>
              ) : (
                orders
                  .filter((o) => o.userId === selectedCustomer.uid)
                  .map((o) => (
                    <div key={o.id} className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                      <div>
                        <p className="font-mono font-semibold">{o.orderNumber}</p>
                        <p className="text-zinc-500">{new Date(o.createdAt).toLocaleDateString()} · {o.items.length} items</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-semibold">{formatPrice(o.total, settings.currencySymbol)}</p>
                        <p className="capitalize text-zinc-500">{o.status}</p>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 3. Returns & Refunds Management
// ============================================================================
export function AdminReturnsPage() {
  const { settings, pushToast } = useStore();
  const { returns, logActivity } = useAdmin();

  const updateReturnStatus = async (ret: ReturnRequest, status: ReturnRequest['status']) => {
    const now = new Date().toISOString();
    try {
      await updateDoc(doc(db, 'returnRequests', ret.id), {
        status,
        updatedAt: now,
      });

      if (status === 'refunded') {
        await updateDoc(doc(db, 'orders', ret.orderId), {
          status: 'refunded',
          paymentStatus: 'refunded',
          updatedAt: now,
        }).catch(() => {});
      }

      if (ret.userId) {
        const nid = generateId('ntf');
        await setDoc(doc(db, 'notifications', nid), {
          id: nid,
          recipientUid: ret.userId,
          title: `Return ${ret.orderNumber} ${status}`,
          message: `Your return request for order ${ret.orderNumber} was marked ${status}.`,
          read: false,
          link: '/account/returns',
          createdAt: now,
        }).catch(() => {});
      }

      await logActivity('update_return', 'returnRequest', ret.id, `${ret.orderNumber} -> ${status}`);
      pushToast(`Return ${ret.orderNumber} marked ${status}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `returnRequests/${ret.id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Returns &amp; Refunds</h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          Inspect customer return claims, approve authorizations, and mark completed refunds.
        </p>
      </div>

      <div className="bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50/70 dark:bg-zinc-900/50 text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
              <tr>
                <th className="py-3 px-4 font-medium">Order</th>
                <th className="py-3 px-4 font-medium">Reason</th>
                <th className="py-3 px-4 font-medium">Amount</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {returns.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-zinc-500">
                    No return requests submitted yet.
                  </td>
                </tr>
              ) : (
                [...returns]
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .map((r) => (
                    <tr key={r.id}>
                      <td className="py-3.5 px-4">
                        <p className="font-mono font-semibold">{r.orderNumber}</p>
                        <p className="text-[11px] text-zinc-500">{new Date(r.createdAt).toLocaleDateString()}</p>
                      </td>
                      <td className="py-3.5 px-4 max-w-sm">{r.reason}</td>
                      <td className="py-3.5 px-4 font-mono tabular-nums">
                        {formatPrice(r.amount, settings.currencySymbol)}
                      </td>
                      <td className="py-3.5 px-4 capitalize font-medium">{r.status}</td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        {r.status === 'requested' && (
                          <>
                            <button
                              type="button"
                              onClick={() => updateReturnStatus(r, 'approved')}
                              className="px-2.5 py-1 rounded bg-sky-600 text-white font-medium"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => updateReturnStatus(r, 'rejected')}
                              className="px-2.5 py-1 rounded border border-red-300 text-red-600"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {(r.status === 'requested' || r.status === 'approved') && (
                          <button
                            type="button"
                            onClick={() => updateReturnStatus(r, 'refunded')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 text-white font-medium"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Mark Refunded
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 4. Payments & Gateway Status
// ============================================================================
export function AdminPaymentsPage() {
  const { settings, pushToast } = useStore();
  const { orders, logActivity } = useAdmin();
  const [gatewayHealth, setGatewayHealth] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setGatewayHealth(d.integrations || {}))
      .catch(() => {});
  }, []);

  const markPaid = async (order: Order) => {
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        paymentStatus: 'paid',
        updatedAt: new Date().toISOString(),
      });
      await logActivity('verify_payment', 'order', order.id, `Verified ${order.paymentMethod} for ${order.orderNumber}`);
      pushToast(`Marked ${order.orderNumber} as Paid`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${order.id}`);
    }
  };

  const totalCollected = orders
    .filter((o) => o.paymentStatus === 'paid')
    .reduce((s, o) => s + o.total, 0);
  const awaitingVerification = orders.filter(
    (o) => o.paymentStatus === 'awaiting_verification' || o.paymentStatus === 'pending'
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Payments &amp; Gateways</h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          Reconcile Cash on Delivery, IBFT bank transfers, and inspect live gateway configuration status.
        </p>
      </div>

      {/* Live Integration Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 space-y-1">
          <p className="text-xs text-zinc-500">Collected Revenue</p>
          <p className="font-mono text-lg font-bold tabular-nums">{formatPrice(totalCollected, settings.currencySymbol)}</p>
        </div>
        {[
          { label: 'Cash on Delivery', ready: settings.codEnabled },
          { label: 'Bank Transfer (IBFT)', ready: settings.bankTransferEnabled },
          { label: 'Stripe Cards', ready: Boolean(gatewayHealth.stripe) },
          { label: 'JazzCash / Easypaisa', ready: Boolean(gatewayHealth.jazzcash || gatewayHealth.easypaisa) },
        ].map((g) => (
          <div key={g.label} className="p-4 rounded-2xl bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <CreditCard className="w-4 h-4 text-[#6D5BD0]" />
              {g.ready ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-amber-500" />
              )}
            </div>
            <p className="text-xs font-semibold">{g.label}</p>
            <p className="text-[11px] text-zinc-500">
              {g.ready ? 'Ready / Active' : 'Env secrets not set'}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Transactions Ledger ({orders.length})</h2>
          <span className="text-xs text-zinc-500">
            {awaitingVerification.length} awaiting confirmation
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50/70 dark:bg-zinc-900/50 text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
              <tr>
                <th className="py-3 px-4 font-medium">Order</th>
                <th className="py-3 px-4 font-medium">Reference</th>
                <th className="py-3 px-4 font-medium">Method</th>
                <th className="py-3 px-4 font-medium">Amount</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Verify</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {[...orders]
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .map((o) => (
                  <tr key={o.id}>
                    <td className="py-3 px-4 font-mono font-semibold">{o.orderNumber}</td>
                    <td className="py-3 px-4 font-mono text-zinc-500">{o.paymentReference || '—'}</td>
                    <td className="py-3 px-4 uppercase font-mono">{o.paymentMethod.replace('_', ' ')}</td>
                    <td className="py-3 px-4 font-mono font-semibold tabular-nums">
                      {formatPrice(o.total, settings.currencySymbol)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded border text-[11px] capitalize ${
                          PAYMENT_STATUS_CLASS[o.paymentStatus]
                        }`}
                      >
                        {o.paymentStatus.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {o.paymentStatus === 'pending' || o.paymentStatus === 'awaiting_verification' ? (
                        <button
                          type="button"
                          onClick={() => markPaid(o)}
                          className="px-2.5 py-1 rounded bg-emerald-600 text-white font-medium"
                        >
                          Mark Paid
                        </button>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
