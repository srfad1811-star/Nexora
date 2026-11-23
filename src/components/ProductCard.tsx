import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, Heart, ShoppingBag, Star } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatPrice, getDiscountPercent } from '../lib/utils';
import { ResilientImage } from './ResilientImage';
import type { Product } from '../types/ecommerce';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addToCart, wishlistIds, toggleWishlist, compareIds, toggleCompare, settings } = useStore();
  const inWishlist = wishlistIds.includes(product.id);
  const inCompare = compareIds.includes(product.id);
  const effectivePrice = product.salePrice && product.salePrice < product.price ? product.salePrice : product.price;
  const discount = getDiscountPercent(product.price, product.salePrice);
  const primaryImage = product.images?.[0] || '';
  const defaultVariant = product.variants?.[0];

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (product.stock <= 0) return;
    addToCart({
      productId: product.id,
      title: product.title,
      slug: product.slug,
      sku: defaultVariant?.sku || product.sku,
      image: primaryImage,
      price: product.price,
      salePrice: product.salePrice,
      quantity: 1,
      variantId: defaultVariant?.id,
      variantName: defaultVariant?.name,
      maxStock: defaultVariant ? defaultVariant.stock : product.stock,
    });
  };

  return (
    <article className="group flex flex-col bg-white dark:bg-[#14161D] border border-zinc-200/80 dark:border-zinc-800 rounded-xl overflow-hidden transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md dark:hover:shadow-black/30">
      <Link to={`/products/${product.slug}`} className="relative block aspect-[4/3] bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
        <ResilientImage
          src={primaryImage}
          alt={product.title}
          fallbackLabel={product.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />

        {discount > 0 && (
          <span className="absolute top-3 left-3 text-[11px] font-medium tracking-wide px-2 py-0.5 rounded bg-zinc-900/90 text-white dark:bg-white dark:text-zinc-900 tabular-nums">
            -{discount}%
          </span>
        )}

        <div className="absolute top-3 right-3 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleWishlist(product.id);
            }}
            aria-label={inWishlist ? 'Remove from wishlist' : 'Save to wishlist'}
            className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors ${
              inWishlist
                ? 'bg-[#6D5BD0] text-white'
                : 'bg-white/90 dark:bg-zinc-900/85 text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800'
            }`}
          >
            <Heart className={`w-4 h-4 ${inWishlist ? 'fill-current' : ''}`} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleCompare(product.id);
            }}
            aria-label="Compare product"
            className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors ${
              inCompare
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                : 'bg-white/90 dark:bg-zinc-900/85 text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleQuickAdd}
          disabled={product.stock <= 0}
          className="absolute bottom-3 left-3 right-3 py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 bg-zinc-900/95 text-white dark:bg-white/95 dark:text-zinc-900 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          {product.stock > 0 ? 'Quick Add' : 'Out of Stock'}
        </button>
      </Link>

      <div className="p-4 flex-1 flex flex-col justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 mb-1 truncate">
            <span>{product.brandName || 'Nexora'}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{product.categoryName || 'Catalog'}</span>
          </div>
          <Link
            to={`/products/${product.slug}`}
            className="block text-[15px] font-semibold text-zinc-900 dark:text-zinc-100 leading-snug line-clamp-2 hover:text-[#6D5BD0] dark:hover:text-[#9D8DF1] transition-colors"
          >
            {product.title}
          </Link>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-zinc-100 dark:border-zinc-800/80">
          <div className="flex items-baseline gap-2 tabular-nums">
            <span className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100 font-mono">
              {formatPrice(effectivePrice, settings.currencySymbol)}
            </span>
            {discount > 0 && (
              <span className="text-xs text-zinc-400 line-through font-mono">
                {formatPrice(product.price, settings.currencySymbol)}
              </span>
            )}
          </div>
          {typeof product.ratingAvg === 'number' && product.ratingAvg > 0 && (
            <div className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400 tabular-nums">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>{product.ratingAvg.toFixed(1)}</span>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
