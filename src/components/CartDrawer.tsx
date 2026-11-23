import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatPrice } from '../lib/utils';
import { ResilientImage } from './ResilientImage';

export function CartDrawer() {
  const {
    cart,
    cartDrawerOpen,
    setCartDrawerOpen,
    updateCartQty,
    removeFromCart,
    settings,
  } = useStore();
  const navigate = useNavigate();

  if (!cartDrawerOpen) return null;

  const subtotal = cart.reduce((sum, item) => {
    const unit = item.salePrice && item.salePrice < item.price ? item.salePrice : item.price;
    return sum + unit * item.quantity;
  }, 0);

  const threshold = settings.freeShippingThreshold || 15000;
  const remaining = Math.max(0, threshold - subtotal);
  const progress = Math.min(100, Math.round((subtotal / threshold) * 100));

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={() => setCartDrawerOpen(false)}
      />
      <aside
        className="relative w-full max-w-md bg-white dark:bg-[#14161D] h-full flex flex-col border-l border-zinc-200 dark:border-zinc-800 shadow-2xl z-10"
        aria-label="Shopping Bag"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Shopping Bag ({cart.reduce((s, i) => s + i.quantity, 0)})
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setCartDrawerOpen(false)}
            aria-label="Close bag"
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-3 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
          <p className="text-xs text-zinc-600 dark:text-zinc-300 mb-2 tabular-nums">
            {remaining > 0
              ? `Add ${formatPrice(remaining, settings.currencySymbol)} more for complimentary standard shipping.`
              : 'You qualify for complimentary standard shipping.'}
          </p>
          <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#6D5BD0] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 divide-y divide-zinc-100 dark:divide-zinc-800">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <ShoppingBag className="w-10 h-10 text-zinc-300 dark:text-zinc-700 mb-3" />
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
                Your bag is empty
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-5">
                Explore curated essentials across apparel, audio, and horology.
              </p>
              <button
                type="button"
                onClick={() => {
                  setCartDrawerOpen(false);
                  navigate('/shop');
                }}
                className="px-5 py-2.5 text-xs font-medium rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              >
                Browse Catalog
              </button>
            </div>
          ) : (
            cart.map((item) => {
              const unit = item.salePrice && item.salePrice < item.price ? item.salePrice : item.price;
              return (
                <div key={`${item.productId}_${item.variantId || 'default'}`} className="py-4 flex gap-4">
                  <Link
                    to={`/products/${item.slug}`}
                    onClick={() => setCartDrawerOpen(false)}
                    className="w-20 h-20 rounded-lg bg-zinc-100 dark:bg-zinc-900 overflow-hidden shrink-0 border border-zinc-200/70 dark:border-zinc-800"
                  >
                    <ResilientImage
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to={`/products/${item.slug}`}
                        onClick={() => setCartDrawerOpen(false)}
                        className="text-sm font-medium text-zinc-900 dark:text-zinc-100 line-clamp-1 hover:text-[#6D5BD0]"
                      >
                        {item.title}
                      </Link>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.productId, item.variantId)}
                        aria-label={`Remove ${item.title}`}
                        className="text-zinc-400 hover:text-red-600 transition-colors p-0.5"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {item.variantName && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{item.variantName}</p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      <div className="inline-flex items-center border border-zinc-200 dark:border-zinc-700 rounded-lg">
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.productId, item.variantId, item.quantity - 1)}
                          aria-label="Decrease quantity"
                          className="p-1.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-l-lg"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-3 text-xs font-medium tabular-nums font-mono">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.productId, item.variantId, item.quantity + 1)}
                          aria-label="Increase quantity"
                          className="p-1.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-r-lg"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums font-mono">
                        {formatPrice(unit * item.quantity, settings.currencySymbol)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {cart.length > 0 && (
          <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">Subtotal</span>
              <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums font-mono">
                {formatPrice(subtotal, settings.currencySymbol)}
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Shipping, taxes, and coupon codes calculated at checkout.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setCartDrawerOpen(false);
                  navigate('/cart');
                }}
                className="py-2.5 px-4 text-xs font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                View Bag
              </button>
              <button
                type="button"
                onClick={() => {
                  setCartDrawerOpen(false);
                  navigate('/checkout');
                }}
                className="py-2.5 px-4 text-xs font-medium rounded-lg bg-[#6D5BD0] text-white hover:bg-[#5B49BF] transition-colors"
              >
                Checkout
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
