import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeftRight,
  Check,
  Heart,
  Minus,
  Plus,
  RotateCcw,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Truck,
} from 'lucide-react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { formatPrice, generateId, getDiscountPercent } from '../../lib/utils';
import { ResilientImage } from '../../components/ResilientImage';
import { ProductCard } from '../../components/ProductCard';
import type { Product, Review } from '../../types/ecommerce';

export function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, profile, getIdToken } = useAuth();
  const {
    products,
    addToCart,
    wishlistIds,
    toggleWishlist,
    compareIds,
    toggleCompare,
    recentlyViewedIds,
    recordRecentlyViewed,
    settings,
    pushToast,
  } = useStore();

  const product = products.find((p) => p.slug === slug);

  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [zoomActive, setZoomActive] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(undefined);
  const [quantity, setQuantity] = useState(1);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const [aiRecommendations, setAiRecommendations] = useState<{
    products: Product[];
    rationale: string;
    source: string;
  }>({ products: [], rationale: '', source: '' });

  useEffect(() => {
    if (!product) return;
    setSelectedImageIdx(0);
    setSelectedVariantId(product.variants?.[0]?.id);
    setQuantity(1);
    recordRecentlyViewed(product.id);
  }, [product?.id, recordRecentlyViewed]);

  // Real-time Firestore reviews for this product
  useEffect(() => {
    if (!product) return;
    const q = query(
      collection(db, 'reviews'),
      where('productId', '==', product.id),
      where('status', '==', 'approved')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Review);
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setReviews(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'reviews')
    );
    return () => unsub();
  }, [product?.id]);

  // Fetch AI / Similarity Recommendations from /api/ai/recommendations
  useEffect(() => {
    if (!product || products.length < 2) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getIdToken();
        const res = await fetch('/api/ai/recommendations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            currentProductId: product.id,
            recentlyViewedIds,
            catalog: products.map((p) => ({
              id: p.id,
              title: p.title,
              categoryName: p.categoryName,
              brandName: p.brandName,
              price: p.salePrice || p.price,
              ratingAvg: p.ratingAvg || 4.5,
            })),
          }),
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          recommendedIds: string[];
          rationale: string;
          source: string;
        };
        const matched = data.recommendedIds
          .map((id) => products.find((p) => p.id === id))
          .filter((p): p is Product => Boolean(p));
        if (!cancelled) {
          setAiRecommendations({
            products: matched,
            rationale: data.rationale,
            source: data.source,
          });
        }
      } catch {
        // Fallback handled silently
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [product?.id, products.length]);

  if (!product) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold mb-2">Product not found</h1>
        <p className="text-sm text-zinc-500 mb-6">
          This item may have been archived or moved.
        </p>
        <Link
          to="/shop"
          className="px-5 py-2.5 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm font-medium"
        >
          Return to Shop
        </Link>
      </div>
    );
  }

  const images = product.images?.length ? product.images : [''];
  const selectedVariant = product.variants?.find((v) => v.id === selectedVariantId) || product.variants?.[0];
  const basePrice = product.price + (selectedVariant?.priceDelta || 0);
  const effectivePrice =
    product.salePrice && product.salePrice < product.price
      ? product.salePrice + (selectedVariant?.priceDelta || 0)
      : basePrice;
  const discount = getDiscountPercent(basePrice, effectivePrice < basePrice ? effectivePrice : undefined);
  const availableStock = selectedVariant ? selectedVariant.stock : product.stock;
  const inWishlist = wishlistIds.includes(product.id);
  const inCompare = compareIds.includes(product.id);

  const handleAddToCart = (buyNow = false) => {
    if (availableStock <= 0) return;
    addToCart({
      productId: product.id,
      title: product.title,
      slug: product.slug,
      sku: selectedVariant?.sku || product.sku,
      image: images[0],
      price: basePrice,
      salePrice: effectivePrice < basePrice ? effectivePrice : undefined,
      quantity,
      variantId: selectedVariant?.id,
      variantName: selectedVariant?.name,
      maxStock: availableStock,
    });
    if (buyNow) {
      navigate('/checkout');
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      pushToast('Product link copied to clipboard');
    } catch {
      pushToast('Ready to share link', 'info');
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      pushToast('Sign in to publish a review', 'info');
      navigate('/login');
      return;
    }
    if (reviewComment.trim().length < 5) {
      pushToast('Please write at least 5 characters for your review', 'error');
      return;
    }
    setSubmittingReview(true);
    const reviewId = generateId('rev');
    const newReview: Review = {
      id: reviewId,
      productId: product.id,
      userId: user.uid,
      userName: profile?.displayName || user.displayName || 'Verified Customer',
      rating: reviewRating,
      title: reviewTitle.trim() || undefined,
      comment: reviewComment.trim(),
      verifiedPurchase: true,
      status: 'approved',
      createdAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'reviews', reviewId), newReview);
      const nextCount = (product.ratingCount || 0) + 1;
      const nextAvg =
        (((product.ratingAvg || 0) * (product.ratingCount || 0)) + reviewRating) / nextCount;
      updateDoc(doc(db, 'products', product.id), {
        ratingCount: nextCount,
        ratingAvg: Number(nextAvg.toFixed(2)),
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
      setReviewTitle('');
      setReviewComment('');
      setReviewRating(5);
      pushToast('Thank you! Your review has been published.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `reviews/${reviewId}`);
    } finally {
      setSubmittingReview(false);
    }
  };

  const recentProducts = recentlyViewedIds
    .filter((id) => id !== product.id)
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is Product => Boolean(p))
    .slice(0, 4);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-16">
      {/* Breadcrumb */}
      <div className="text-xs text-zinc-500 flex items-center gap-2">
        <Link to="/" className="hover:underline">Home</Link>
        <span>/</span>
        <Link to="/shop" className="hover:underline">Shop</Link>
        {product.categoryName && (
          <>
            <span>/</span>
            <span>{product.categoryName}</span>
          </>
        )}
        <span>/</span>
        <span className="text-zinc-900 dark:text-zinc-100 truncate">{product.title}</span>
      </div>

      {/* Main Split Gallery + Purchase Module */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left: Gallery with Interactive Zoom */}
        <div className="lg:col-span-7 space-y-4">
          <div
            className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 cursor-zoom-in"
            onMouseEnter={() => setZoomActive(true)}
            onMouseLeave={() => setZoomActive(false)}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = ((e.clientX - rect.left) / rect.width) * 100;
              const y = ((e.clientY - rect.top) / rect.height) * 100;
              setZoomOrigin({ x, y });
            }}
          >
            <div
              className="w-full h-full transition-transform duration-150"
              style={{
                transform: zoomActive ? 'scale(1.6)' : 'scale(1)',
                transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
              }}
            >
              <ResilientImage
                src={images[selectedImageIdx]}
                alt={product.title}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto">
              {images.map((img, i) => (
                <button
                  key={`${img}_${i}`}
                  type="button"
                  onClick={() => setSelectedImageIdx(i)}
                  className={`w-20 h-16 rounded-lg overflow-hidden border-2 shrink-0 ${
                    selectedImageIdx === i ? 'border-[#6D5BD0]' : 'border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  <ResilientImage src={img} alt={`${product.title} view ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Contiguous Purchase Module */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>
                {product.brandName} · SKU <span className="font-mono">{selectedVariant?.sku || product.sku}</span>
              </span>
              <button type="button" onClick={handleShare} className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-white">
                <Share2 className="w-3.5 h-3.5" />
                Share
              </button>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight [text-wrap:balance]">
              {product.title}
            </h1>
            <div className="flex items-center gap-3 pt-1">
              <div className="flex items-center gap-1 text-xs font-medium tabular-nums">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span>{(product.ratingAvg || 4.8).toFixed(1)}</span>
                <span className="text-zinc-500">({reviews.length || product.ratingCount || 0} reviews)</span>
              </div>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <span className={`text-xs font-medium ${availableStock > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600'}`}>
                {availableStock > 0 ? `In Stock (${availableStock} units)` : 'Out of Stock'}
              </span>
            </div>
          </div>

          {/* Pricing */}
          <div className="flex items-baseline gap-3 pb-4 border-b border-zinc-200 dark:border-zinc-800 tabular-nums">
            <span className="text-2xl font-bold font-mono">
              {formatPrice(effectivePrice, settings.currencySymbol)}
            </span>
            {discount > 0 && (
              <>
                <span className="text-base text-zinc-400 line-through font-mono">
                  {formatPrice(basePrice, settings.currencySymbol)}
                </span>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Save {discount}%
                </span>
              </>
            )}
          </div>

          <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
            {product.description || product.shortDescription}
          </p>

          {/* Variants Selector */}
          {product.variants && product.variants.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-xs font-medium text-zinc-500">
                Select Option: <span className="text-zinc-900 dark:text-zinc-100">{selectedVariant?.name}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => {
                  const active = v.id === selectedVariant?.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariantId(v.id)}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        active
                          ? 'border-[#6D5BD0] bg-[#6D5BD0]/10 text-[#6D5BD0] dark:text-[#A99AF7]'
                          : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-500'
                      }`}
                    >
                      {v.colorHex && (
                        <span
                          className="w-3 h-3 rounded-full border border-black/15"
                          style={{ backgroundColor: v.colorHex }}
                        />
                      )}
                      <span>{v.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity + Purchase Actions */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center border border-zinc-300 dark:border-zinc-700 rounded-lg">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-l-lg"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="px-4 text-sm font-medium font-mono tabular-nums">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(availableStock || 1, q + 1))}
                  className="p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-r-lg"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                disabled={availableStock <= 0}
                onClick={() => handleAddToCart(false)}
                className="flex-1 py-3 px-5 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-40"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>{availableStock > 0 ? 'Add to Bag' : 'Out of Stock'}</span>
              </button>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                disabled={availableStock <= 0}
                onClick={() => handleAddToCart(true)}
                className="flex-1 py-2.5 px-5 rounded-lg bg-[#6D5BD0] text-white text-sm font-medium hover:bg-[#5B49BF] disabled:opacity-40"
              >
                Buy Now
              </button>
              <button
                type="button"
                onClick={() => toggleWishlist(product.id)}
                className={`px-4 py-2.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 ${
                  inWishlist
                    ? 'border-[#6D5BD0] text-[#6D5BD0]'
                    : 'border-zinc-300 dark:border-zinc-700'
                }`}
              >
                <Heart className={`w-4 h-4 ${inWishlist ? 'fill-current' : ''}`} />
                <span>{inWishlist ? 'Saved' : 'Wishlist'}</span>
              </button>
              <button
                type="button"
                onClick={() => toggleCompare(product.id)}
                className={`px-3.5 py-2.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 ${
                  inCompare
                    ? 'border-zinc-900 dark:border-white bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                    : 'border-zinc-300 dark:border-zinc-700'
                }`}
              >
                <ArrowLeftRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Fulfillment & Policies */}
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 space-y-2.5 text-xs text-zinc-600 dark:text-zinc-400">
            <div className="flex items-center gap-2.5">
              <Truck className="w-4 h-4 text-[#6D5BD0]" />
              <span>Same-day dispatch before 4 PM PKT · Free over {formatPrice(settings.freeShippingThreshold, settings.currencySymbol)}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <RotateCcw className="w-4 h-4 text-[#6D5BD0]" />
              <span>14-day easy returns &amp; exchanges via Account Portal</span>
            </div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#6D5BD0]" />
              <span>100% authentic guarantee · Cash on Delivery &amp; IBFT supported</span>
            </div>
          </div>

          {/* Specifications */}
          {product.specifications && product.specifications.length > 0 && (
            <div className="pt-2">
              <h2 className="text-sm font-semibold mb-3">Technical Specifications</h2>
              <dl className="divide-y divide-zinc-200 dark:divide-zinc-800 border-y border-zinc-200 dark:border-zinc-800 text-xs">
                {product.specifications.map((spec) => (
                  <div key={spec.label} className="py-2.5 flex justify-between gap-4">
                    <dt className="text-zinc-500">{spec.label}</dt>
                    <dd className="font-medium text-right">{spec.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>

      {/* Customer Reviews & Submission */}
      <section className="pt-10 border-t border-zinc-200 dark:border-zinc-800 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7 space-y-6">
          <h2 className="font-display text-xl font-bold">
            Customer Reviews ({reviews.length})
          </h2>
          {reviews.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No written reviews yet. Be the first verified customer to review this product.
            </p>
          ) : (
            <div className="space-y-4">
              {reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#14161D] space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-amber-400">
                      {Array.from({ length: rev.rating }).map((_, idx) => (
                        <Star key={idx} className="w-3.5 h-3.5 fill-current" />
                      ))}
                    </div>
                    <span className="text-xs text-zinc-500">
                      {new Date(rev.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {rev.title && <h3 className="text-sm font-semibold">{rev.title}</h3>}
                  <p className="text-sm text-zinc-600 dark:text-zinc-300">{rev.comment}</p>
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500 pt-1">
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{rev.userName} · Verified Buyer</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5">
          <form
            onSubmit={handleReviewSubmit}
            className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#14161D] space-y-4"
          >
            <h3 className="text-base font-semibold">Write a Review</h3>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Rating</label>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className="p-1"
                    aria-label={`Rate ${star} stars`}
                  >
                    <Star
                      className={`w-5 h-5 ${
                        star <= reviewRating ? 'fill-amber-400 text-amber-400' : 'text-zinc-300 dark:text-zinc-700'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Headline (Optional)</label>
              <input
                type="text"
                value={reviewTitle}
                onChange={(e) => setReviewTitle(e.target.value)}
                placeholder="Exceptional build quality"
                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Review</label>
              <textarea
                rows={4}
                required
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share sizing, material texture, or delivery experience..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
              />
            </div>
            <button
              type="submit"
              disabled={submittingReview}
              className="w-full py-2.5 text-sm font-medium rounded-lg bg-[#6D5BD0] text-white hover:bg-[#5B49BF] disabled:opacity-50"
            >
              {submittingReview ? 'Submitting...' : user ? 'Publish Review' : 'Sign In to Review'}
            </button>
          </form>
        </div>
      </section>

      {/* AI Recommendations */}
      {aiRecommendations.products.length > 0 && (
        <section className="pt-10 border-t border-zinc-200 dark:border-zinc-800 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6D5BD0] mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Recommended Pairings</span>
              </div>
              <h2 className="font-display text-xl font-bold">Complete Your Selection</h2>
              {aiRecommendations.rationale && (
                <p className="text-xs text-zinc-500 mt-1">{aiRecommendations.rationale}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {aiRecommendations.products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Recently Viewed */}
      {recentProducts.length > 0 && (
        <section className="pt-10 border-t border-zinc-200 dark:border-zinc-800 space-y-6">
          <h2 className="font-display text-xl font-bold">Recently Viewed</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {recentProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
