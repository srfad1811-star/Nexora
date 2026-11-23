import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Lock,
  Printer,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { formatPrice, generateId, PAKISTAN_CITIES } from '../../lib/utils';
import type { Order, PaymentMethod, Product } from '../../types/ecommerce';

const CheckoutFormSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Valid email address is required'),
  phone: z.string().min(7, 'Valid phone number is required'),
  street: z.string().min(5, 'Street address is required'),
  city: z.string().min(2, 'City is required'),
  province: z.string().min(2, 'Province is required'),
  postalCode: z.string().min(3, 'Postal code is required'),
});

interface TotalsBreakdown {
  subtotal: number;
  discountAmount: number;
  shippingFee: number;
  codFee: number;
  taxAmount: number;
  total: number;
}

export function CheckoutPage() {
  const { user, profile, signInWithGoogle } = useAuth();
  const { cart, coupons, cartCouponCode, setCartCouponCode, clearCart, settings, pushToast } = useStore();

  const defaultAddr = profile?.addresses?.[0];

  const [fullName, setFullName] = useState(defaultAddr?.fullName || profile?.displayName || user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(defaultAddr?.phone || profile?.phone || '');
  const [street, setStreet] = useState(defaultAddr?.street || '');
  const [city, setCity] = useState(defaultAddr?.city || 'Lahore');
  const [province, setProvince] = useState(defaultAddr?.province || 'Punjab');
  const [postalCode, setPostalCode] = useState(defaultAddr?.postalCode || '54000');
  const [sameBilling, setSameBilling] = useState(true);
  const [deliveryMethod, setDeliveryMethod] = useState<'standard' | 'express'>('standard');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [couponInput, setCouponInput] = useState(cartCouponCode);
  const [notes, setNotes] = useState('');

  const [totals, setTotals] = useState<TotalsBreakdown>({
    subtotal: 0,
    discountAmount: 0,
    shippingFee: 0,
    codFee: 0,
    taxAmount: 0,
    total: 0,
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [paymentNotice, setPaymentNotice] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [guestReceiptCode, setGuestReceiptCode] = useState<string>('');
  const [idempotencyKey] = useState(() => generateId('idem'));

  useEffect(() => {
    if (user?.email && !email) setEmail(user.email);
    if (profile?.displayName && !fullName) setFullName(profile.displayName);
  }, [user, profile]);

  const appliedCoupon = coupons.find(
    (c) => c.active && c.code.toUpperCase() === cartCouponCode.toUpperCase()
  );

  // Authoritative Server Calculation
  useEffect(() => {
    if (cart.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/checkout/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: cart.map((i) => ({
              productId: i.productId,
              unitPrice: i.salePrice && i.salePrice < i.price ? i.salePrice : i.price,
              quantity: i.quantity,
            })),
            city,
            deliveryMethod,
            paymentMethod,
            coupon: appliedCoupon
              ? {
                  code: appliedCoupon.code,
                  type: appliedCoupon.type,
                  value: appliedCoupon.value,
                  minOrderAmount: appliedCoupon.minOrderAmount || 0,
                }
              : null,
            settings: {
              taxRatePercent: settings.taxRatePercent,
              freeShippingThreshold: settings.freeShippingThreshold,
              codFee: settings.codFee,
            },
          }),
        });
        if (res.ok && !cancelled) {
          const data = (await res.json()) as TotalsBreakdown;
          setTotals(data);
        }
      } catch {
        // ignore network hiccup
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cart, city, deliveryMethod, paymentMethod, appliedCoupon?.code, settings]);

  const handleApplyCoupon = () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      setCartCouponCode('');
      return;
    }
    const found = coupons.find((c) => c.active && c.code.toUpperCase() === code);
    if (!found) {
      pushToast('Coupon code not found or requires account sign-in', 'error');
      return;
    }
    setCartCouponCode(found.code);
    pushToast(`Applied ${found.code}`);
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentNotice('');
    setFormErrors({});

    const parsed = CheckoutFormSchema.safeParse({
      fullName,
      email,
      phone,
      street,
      city,
      province,
      postalCode,
    });

    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        if (issue.path[0]) errs[String(issue.path[0])] = issue.message;
      }
      setFormErrors(errs);
      pushToast('Please check required shipping fields', 'error');
      return;
    }

    if (cart.length === 0) {
      pushToast('Your shopping bag is empty', 'error');
      return;
    }

    setSubmitting(true);
    const orderNumber = `NX-${Math.floor(100000 + Math.random() * 900000)}`;
    const orderId = generateId('ord');
    const now = new Date().toISOString();

    try {
      // Step 1: Payment Provider Adapter Verification (Idempotent)
      const payRes = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber,
          amountPkr: totals.total,
          paymentMethod,
          customerEmail: parsed.data.email,
          idempotencyKey,
        }),
      });
      const payData = (await payRes.json()) as {
        id?: string | null;
        status?: string;
        configured?: boolean;
        message?: string;
        error?: string;
      };

      if (!payRes.ok) {
        throw new Error(payData.error || 'Payment initialization failed');
      }

      if (payData.configured === false) {
        setPaymentNotice(
          payData.message ||
            'Selected payment provider requires API credentials in environment secrets. Please select Cash on Delivery or Bank Transfer.'
        );
        setSubmitting(false);
        return;
      }

      const orderItems = cart.map((c) => {
        const unit = c.salePrice && c.salePrice < c.price ? c.salePrice : c.price;
        return {
          productId: c.productId,
          title: c.title,
          sku: c.sku,
          image: c.image,
          unitPrice: unit,
          quantity: c.quantity,
          lineTotal: unit * c.quantity,
          variantName: c.variantName || '',
        };
      });

      const orderPayload: Order = {
        id: orderId,
        orderNumber,
        userId: user ? user.uid : 'guest',
        customerEmail: parsed.data.email,
        customerName: parsed.data.fullName,
        customerPhone: parsed.data.phone,
        items: orderItems,
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        couponCode: appliedCoupon?.code || '',
        shippingFee: totals.shippingFee,
        codFee: totals.codFee,
        taxAmount: totals.taxAmount,
        total: totals.total,
        currency: settings.currencyCode,
        paymentMethod,
        paymentStatus: paymentMethod === 'bank_transfer' ? 'awaiting_verification' : 'pending',
        paymentReference: payData.id || orderNumber,
        status: 'pending',
        shippingAddress: {
          id: 'ship_1',
          label: 'Primary',
          fullName: parsed.data.fullName,
          phone: parsed.data.phone,
          street: parsed.data.street,
          city: parsed.data.city,
          province: parsed.data.province,
          postalCode: parsed.data.postalCode,
          country: 'Pakistan',
        },
        deliveryMethod,
        deliveryPartner: settings.deliveryPartners[0] || 'TCS Express',
        notes: notes.trim(),
        statusHistory: [
          {
            status: 'pending',
            note: `Order placed via ${paymentMethod.toUpperCase()}`,
            actorEmail: parsed.data.email,
            timestamp: now,
          },
        ],
        createdAt: now,
        updatedAt: now,
      };

      if (user) {
        // Step 2: Atomic Firestore Transaction (Stock check + Deduction + Order Create + Movement Ledger)
        await runTransaction(db, async (tx) => {
          const prodSnaps = await Promise.all(
            cart.map((item) => tx.get(doc(db, 'products', item.productId)))
          );

          for (let i = 0; i < cart.length; i++) {
            const snap = prodSnaps[i];
            if (!snap.exists()) {
              throw new Error(`Product ${cart[i].title} is no longer available`);
            }
            const prod = snap.data() as Product;
            if (prod.stock < cart[i].quantity) {
              throw new Error(`Insufficient stock for ${prod.title} (${prod.stock} left)`);
            }
          }

          for (let i = 0; i < cart.length; i++) {
            const prod = prodSnaps[i].data() as Product;
            const nextStock = prod.stock - cart[i].quantity;
            tx.update(doc(db, 'products', prod.id), {
              stock: nextStock,
              salesCount: (prod.salesCount || 0) + cart[i].quantity,
              updatedAt: now,
            });
            const movId = generateId('mov');
            tx.set(doc(db, 'inventoryMovements', movId), {
              id: movId,
              productId: prod.id,
              productTitle: prod.title,
              sku: prod.sku,
              delta: -cart[i].quantity,
              previousStock: prod.stock,
              newStock: nextStock,
              reason: `Order ${orderNumber}`,
              actorEmail: parsed.data.email,
              createdAt: now,
            });
          }

          if (appliedCoupon) {
            tx.update(doc(db, 'coupons', appliedCoupon.id), {
              usedCount: (appliedCoupon.usedCount || 0) + 1,
            });
          }

          tx.set(doc(db, 'orders', orderId), orderPayload);
        });

        await clearCart();
        setConfirmedOrder(orderPayload);
        pushToast(`Order ${orderNumber} confirmed!`);
      } else {
        // Guest Checkout Receipt Flow
        const guestRes = await fetch('/api/checkout/guest-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderNumber,
            customerName: parsed.data.fullName,
            customerEmail: parsed.data.email,
            customerPhone: parsed.data.phone,
            total: totals.total,
          }),
        });
        const guestData = (await guestRes.json()) as { receiptCode?: string };
        setGuestReceiptCode(guestData.receiptCode || orderNumber);
        await clearCart();
        setConfirmedOrder(orderPayload);
        pushToast(`Guest Order ${orderNumber} confirmed!`);
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('Missing or insufficient permissions')) {
        handleFirestoreError(err, OperationType.WRITE, `orders/${orderId}`);
      }
      pushToast(err instanceof Error ? err.message : 'Checkout failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmedOrder) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
        <div className="p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#14161D] space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 shrink-0" />
              <div>
                <h1 className="font-display text-2xl font-bold">
                  Order #{confirmedOrder.orderNumber} Confirmed
                </h1>
                <p className="text-sm text-zinc-500">
                  Confirmation prepared for {confirmedOrder.customerEmail}
                  {guestReceiptCode ? ` · Receipt ${guestReceiptCode}` : ''}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="no-print inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Invoice
            </button>
          </div>

          {confirmedOrder.paymentMethod === 'bank_transfer' && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs space-y-1">
              <p className="font-semibold text-amber-900 dark:text-amber-200">
                Bank Transfer Instructions
              </p>
              <p className="text-amber-800 dark:text-amber-300">{settings.bankDetails}</p>
              <p className="text-amber-700 dark:text-amber-400">
                Include Order #{confirmedOrder.orderNumber} in your IBFT / Raast reference.
              </p>
            </div>
          )}

          <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border-y border-zinc-200 dark:border-zinc-800">
            {confirmedOrder.items.map((item) => (
              <div key={`${item.productId}_${item.sku}`} className="py-3 flex justify-between text-sm">
                <div>
                  <p className="font-medium">
                    {item.title} × {item.quantity}
                  </p>
                  <p className="text-xs text-zinc-500 font-mono">
                    {item.sku} {item.variantName ? `· ${item.variantName}` : ''}
                  </p>
                </div>
                <span className="font-mono tabular-nums font-medium">
                  {formatPrice(item.lineTotal, settings.currencySymbol)}
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-zinc-500">
              <span>Subtotal</span>
              <span className="font-mono tabular-nums">{formatPrice(confirmedOrder.subtotal, settings.currencySymbol)}</span>
            </div>
            {(confirmedOrder.discountAmount || 0) > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount</span>
                <span className="font-mono tabular-nums">-{formatPrice(confirmedOrder.discountAmount || 0, settings.currencySymbol)}</span>
              </div>
            )}
            <div className="flex justify-between text-zinc-500">
              <span>Shipping ({confirmedOrder.deliveryMethod})</span>
              <span className="font-mono tabular-nums">{formatPrice(confirmedOrder.shippingFee || 0, settings.currencySymbol)}</span>
            </div>
            {(confirmedOrder.codFee || 0) > 0 && (
              <div className="flex justify-between text-zinc-500">
                <span>COD Handling Fee</span>
                <span className="font-mono tabular-nums">{formatPrice(confirmedOrder.codFee || 0, settings.currencySymbol)}</span>
              </div>
            )}
            <div className="flex justify-between text-zinc-500">
              <span>Tax</span>
              <span className="font-mono tabular-nums">{formatPrice(confirmedOrder.taxAmount || 0, settings.currencySymbol)}</span>
            </div>
            <div className="flex justify-between text-base font-bold pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <span>Total Paid / Due</span>
              <span className="font-mono tabular-nums">{formatPrice(confirmedOrder.total, settings.currencySymbol)}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2 no-print">
            {user ? (
              <Link
                to="/account/orders"
                className="px-5 py-2.5 rounded-lg bg-[#6D5BD0] text-white text-xs font-medium hover:bg-[#5B49BF]"
              >
                Track in My Orders
              </Link>
            ) : (
              <button
                type="button"
                onClick={signInWithGoogle}
                className="px-5 py-2.5 rounded-lg bg-[#6D5BD0] text-white text-xs font-medium hover:bg-[#5B49BF]"
              >
                Sign In with Google to Save Account
              </button>
            )}
            <Link
              to="/shop"
              className="px-5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-medium"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold">No items in checkout</h1>
        <p className="text-sm text-zinc-500">Add products to your bag before checking out.</p>
        <Link
          to="/shop"
          className="inline-block px-6 py-2.5 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm font-medium"
        >
          Browse Catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800 mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Secure Checkout</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {user ? `Signed in as ${user.email}` : 'Checking out as Guest · Real-time inventory verified'}
          </p>
        </div>
        {!user && (
          <button
            type="button"
            onClick={signInWithGoogle}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 self-start"
          >
            Sign in with Google for Saved Addresses
          </button>
        )}
      </div>

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left: Customer, Shipping & Payment */}
        <div className="lg:col-span-7 space-y-8">
          {/* Contact & Shipping */}
          <section className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#14161D] space-y-4">
            <h2 className="text-base font-semibold">1. Contact &amp; Shipping Address</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                />
                {formErrors.fullName && <p className="text-xs text-red-600 mt-1">{formErrors.fullName}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                />
                {formErrors.email && <p className="text-xs text-red-600 mt-1">{formErrors.email}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Mobile / Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+92 300 1234567"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                />
                {formErrors.phone && <p className="text-xs text-red-600 mt-1">{formErrors.phone}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">City</label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                >
                  {PAKISTAN_CITIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Street Address</label>
              <input
                type="text"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="House 14, Street 6, Gulberg III"
                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
              />
              {formErrors.street && <p className="text-xs text-red-600 mt-1">{formErrors.street}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Province</label>
                <input
                  type="text"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Postal Code</label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 pt-1">
              <input
                type="checkbox"
                checked={sameBilling}
                onChange={(e) => setSameBilling(e.target.checked)}
                className="rounded accent-[#6D5BD0]"
              />
              <span>Billing address matches shipping address</span>
            </label>
          </section>

          {/* Delivery Method */}
          <section className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#14161D] space-y-4">
            <h2 className="text-base font-semibold">2. Delivery Speed</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDeliveryMethod('standard')}
                className={`p-4 rounded-xl border text-left transition-colors ${
                  deliveryMethod === 'standard'
                    ? 'border-[#6D5BD0] bg-[#6D5BD0]/5'
                    : 'border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>Standard Courier</span>
                  <Truck className="w-4 h-4 text-[#6D5BD0]" />
                </div>
                <p className="text-xs text-zinc-500 mt-1">1–3 business days · Free over {formatPrice(settings.freeShippingThreshold, settings.currencySymbol)}</p>
              </button>
              <button
                type="button"
                onClick={() => setDeliveryMethod('express')}
                className={`p-4 rounded-xl border text-left transition-colors ${
                  deliveryMethod === 'express'
                    ? 'border-[#6D5BD0] bg-[#6D5BD0]/5'
                    : 'border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>Priority Air Express</span>
                  <Truck className="w-4 h-4 text-[#6D5BD0]" />
                </div>
                <p className="text-xs text-zinc-500 mt-1">Next-day priority dispatch across major hubs</p>
              </button>
            </div>
          </section>

          {/* Payment Method */}
          <section className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#14161D] space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">3. Payment Selection</h2>
              <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                <Lock className="w-3.5 h-3.5" />
                Encrypted
              </span>
            </div>

            {paymentNotice && (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{paymentNotice}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(
                [
                  { id: 'cod', label: 'Cash on Delivery (COD)', sub: `Handling fee ${formatPrice(settings.codFee, settings.currencySymbol)}`, enabled: settings.codEnabled },
                  { id: 'bank_transfer', label: 'Direct Bank Transfer (IBFT)', sub: 'Instant IBAN / Raast settlement', enabled: settings.bankTransferEnabled },
                  { id: 'stripe', label: 'Credit / Debit Card (Stripe)', sub: 'Visa, Mastercard & Apple Pay adapter', enabled: settings.stripeEnabled },
                  { id: 'jazzcash', label: 'JazzCash Mobile Wallet', sub: 'Pakistan mobile account gateway', enabled: settings.jazzcashEnabled },
                  { id: 'easypaisa', label: 'Easypaisa Wallet', sub: 'Telenor mobile payment adapter', enabled: settings.easypaisaEnabled },
                ] as const
              )
                .filter((m) => m.enabled)
                .map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(m.id);
                      setPaymentNotice('');
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-colors ${
                      paymentMethod === m.id
                        ? 'border-[#6D5BD0] bg-[#6D5BD0]/5'
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <CreditCard className="w-4 h-4 text-[#6D5BD0]" />
                      <span>{m.label}</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">{m.sub}</p>
                  </button>
                ))}
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Order Notes (Optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Call upon arrival or gate instructions..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
              />
            </div>
          </section>
        </div>

        {/* Right: Order Summary */}
        <aside className="lg:col-span-5">
          <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#14161D] space-y-5 lg:sticky lg:top-24">
            <h2 className="text-base font-semibold">Order Summary</h2>

            <div className="divide-y divide-zinc-200 dark:divide-zinc-800 max-h-72 overflow-y-auto pr-1">
              {cart.map((item) => {
                const unit = item.salePrice && item.salePrice < item.price ? item.salePrice : item.price;
                return (
                  <div key={`${item.productId}_${item.variantId || 'def'}`} className="py-3 flex justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {item.title} <span className="text-zinc-500">×{item.quantity}</span>
                      </p>
                      {item.variantName && <p className="text-xs text-zinc-500">{item.variantName}</p>}
                    </div>
                    <span className="font-mono tabular-nums shrink-0">
                      {formatPrice(unit * item.quantity, settings.currencySymbol)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder="Coupon code"
                className="flex-1 px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 uppercase"
              />
              <button
                type="button"
                onClick={handleApplyCoupon}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Apply
              </button>
            </div>

            <div className="space-y-2 text-sm pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <div className="flex justify-between">
                <span className="text-zinc-500">Subtotal</span>
                <span className="font-mono tabular-nums">{formatPrice(totals.subtotal, settings.currencySymbol)}</span>
              </div>
              {totals.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount</span>
                  <span className="font-mono tabular-nums">-{formatPrice(totals.discountAmount, settings.currencySymbol)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-zinc-500">Shipping ({city})</span>
                <span className="font-mono tabular-nums">{formatPrice(totals.shippingFee, settings.currencySymbol)}</span>
              </div>
              {totals.codFee > 0 && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">COD Handling Fee</span>
                  <span className="font-mono tabular-nums">{formatPrice(totals.codFee, settings.currencySymbol)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-zinc-500">Estimated Tax ({settings.taxRatePercent}%)</span>
                <span className="font-mono tabular-nums">{formatPrice(totals.taxAmount, settings.currencySymbol)}</span>
              </div>
            </div>

            <div className="flex justify-between items-baseline pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold font-mono tabular-nums">
                {formatPrice(totals.total, settings.currencySymbol)}
              </span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-5 rounded-lg bg-[#6D5BD0] text-white text-sm font-medium hover:bg-[#5B49BF] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{submitting ? 'Validating & Placing Order...' : 'Complete Order'}</span>
            </button>
          </div>
        </aside>
      </form>
    </div>
  );
}
