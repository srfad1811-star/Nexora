import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Minus, Plus, ShoppingBag, Tag, Trash2 } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { formatPrice } from '../../lib/utils';
import { ResilientImage } from '../../components/ResilientImage';

export function CartPage() {
  const {
    cart,
    coupons,
    cartCouponCode,
    setCartCouponCode,
    updateCartQty,
    removeFromCart,
    settings,
    pushToast,
  } = useStore();
  const navigate = useNavigate();
  const [couponInput, setCouponInput] = useState(cartCouponCode);

  const subtotal = cart.reduce((s, i) => {
    const unit = i.salePrice && i.salePrice < i.price ? i.salePrice : i.price;
    return s + unit * i.quantity;
  }, 0);

  const appliedCoupon = coupons.find(
    (c) => c.active && c.code.toUpperCase() === cartCouponCode.toUpperCase()
  );

  let discount = 0;
  if (appliedCoupon && subtotal >= (appliedCoupon.minOrderAmount || 0)) {
    if (appliedCoupon.type === 'percentage') {
      discount = Math.round((subtotal * appliedCoupon.value) / 100);
    } else if (appliedCoupon.type === 'fixed') {
      discount = Math.min(subtotal, appliedCoupon.value);
    }
  }

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      setCartCouponCode('');
      return;
    }
    const found = coupons.find((c) => c.active && c.code.toUpperCase() === code);
    if (!found) {
      pushToast('Invalid or inactive coupon code (sign in to validate member codes)', 'error');
      return;
    }
    if (subtotal < (found.minOrderAmount || 0)) {
      pushToast(
        `Minimum order of ${formatPrice(found.minOrderAmount || 0, settings.currencySymbol)} required`,
        'error'
      );
      return;
    }
    setCartCouponCode(found.code);
    pushToast(`Coupon ${found.code} applied`);
  };

  if (cart.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center space-y-4">
        <ShoppingBag className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-700" />
        <h1 className="font-display text-2xl font-bold">Your shopping bag is empty</h1>
        <p className="text-sm text-zinc-500">Explore our active catalog to add items to your bag.</p>
        <Link
          to="/shop"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm font-medium"
        >
          Browse Catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display text-3xl font-bold tracking-tight mb-8">Shopping Bag</h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 divide-y divide-zinc-200 dark:divide-zinc-800 border-y border-zinc-200 dark:border-zinc-800">
          {cart.map((item) => {
            const unit = item.salePrice && item.salePrice < item.price ? item.salePrice : item.price;
            return (
              <div key={`${item.productId}_${item.variantId || 'def'}`} className="py-6 flex gap-5">
                <Link
                  to={`/products/${item.slug}`}
                  className="w-24 h-24 rounded-xl bg-zinc-100 dark:bg-zinc-900 overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-800"
                >
                  <ResilientImage src={item.image} alt={item.title} className="w-full h-full object-cover" />
                </Link>
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Link to={`/products/${item.slug}`} className="text-base font-semibold hover:text-[#6D5BD0]">
                        {item.title}
                      </Link>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        SKU: <span className="font-mono">{item.sku}</span>
                        {item.variantName ? ` · ${item.variantName}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.productId, item.variantId)}
                      className="text-zinc-400 hover:text-red-600 p-1"
                      aria-label={`Remove ${item.title}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-3">
                    <div className="inline-flex items-center border border-zinc-300 dark:border-zinc-700 rounded-lg">
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.productId, item.variantId, item.quantity - 1)}
                        className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-l-lg"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-4 text-xs font-mono font-medium tabular-nums">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.productId, item.variantId, item.quantity + 1)}
                        className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-r-lg"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="text-base font-semibold font-mono tabular-nums">
                      {formatPrice(unit * item.quantity, settings.currencySymbol)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <aside className="lg:col-span-4">
          <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#14161D] space-y-5">
            <h2 className="text-base font-semibold">Order Summary</h2>

            <form onSubmit={handleApplyCoupon} className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="Promo code (e.g. NEXORA10)"
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 uppercase"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Apply
              </button>
            </form>

            <div className="space-y-2.5 text-sm pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <div className="flex justify-between">
                <span className="text-zinc-500">Subtotal</span>
                <span className="font-mono tabular-nums">{formatPrice(subtotal, settings.currencySymbol)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Discount ({appliedCoupon?.code})</span>
                  <span className="font-mono tabular-nums">-{formatPrice(discount, settings.currencySymbol)}</span>
                </div>
              )}
              <div className="flex justify-between text-zinc-500 text-xs">
                <span>Shipping &amp; Tax</span>
                <span>Calculated at checkout</span>
              </div>
            </div>

            <div className="flex justify-between items-baseline pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <span className="font-semibold">Estimated Total</span>
              <span className="text-lg font-bold font-mono tabular-nums">
                {formatPrice(Math.max(0, subtotal - discount), settings.currencySymbol)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => navigate('/checkout')}
              className="w-full py-3 px-5 rounded-lg bg-[#6D5BD0] text-white text-sm font-medium hover:bg-[#5B49BF] flex items-center justify-center gap-2"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
