import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Sparkles, Truck, RotateCcw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { ProductCard } from '../../components/ProductCard';
import { ResilientImage } from '../../components/ResilientImage';
import { seedStorefrontIfEmpty } from '../../lib/seed';

export function HomePage() {
  const { user, isBootstrappedAdmin, signInWithGoogle } = useAuth();
  const { products, categories, brands, cms, catalogLoading, pushToast } = useStore();
  const [activeTab, setActiveTab] = useState<'featured' | 'trending' | 'new' | 'sale'>('featured');
  const [seeding, setSeeding] = useState(false);

  const filteredProducts = products
    .filter((p) => {
      if (activeTab === 'featured') return p.featured;
      if (activeTab === 'trending') return p.trending;
      if (activeTab === 'new') return p.newArrival;
      if (activeTab === 'sale') return Boolean(p.salePrice && p.salePrice < p.price);
      return true;
    })
    .slice(0, 6);

  const displayProducts = filteredProducts.length > 0 ? filteredProducts : products.slice(0, 6);

  const handleInitializeCatalog = async () => {
    setSeeding(true);
    try {
      await seedStorefrontIfEmpty(true);
      pushToast('Nexora catalog initialized in Firestore');
    } catch {
      pushToast('Please sign in with the admin account to initialize', 'error');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-20 pb-8">
      {/* 1. Storefront Split Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch bg-zinc-50 dark:bg-[#14161D] border border-zinc-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden">
          <div className="lg:col-span-5 p-8 sm:p-12 flex flex-col justify-between gap-8">
            <div className="space-y-5">
              <p className="text-xs font-medium tracking-wider uppercase text-[#6D5BD0] dark:text-[#9D8DF1]">
                {cms.heroEyebrow}
              </p>
              <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-zinc-900 dark:text-white leading-[1.08] [text-wrap:balance]">
                {cms.heroTitle}
              </h1>
              <p className="text-base text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-md">
                {cms.heroSubtitle}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                to={cms.heroCtaLink || '/shop'}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-opacity whitespace-nowrap"
              >
                <span>{cms.heroCtaLabel || 'Explore Collection'}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/categories"
                className="inline-flex items-center px-5 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
              >
                Browse Categories
              </Link>
            </div>
          </div>

          <div className="lg:col-span-7 min-h-[320px] lg:min-h-[480px] relative">
            <ResilientImage
              src={cms.heroImage}
              alt="Nexora curated collection on travertine plinth"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Service Commitments Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-6 py-5 px-6 bg-white dark:bg-[#14161D] border border-zinc-200/80 dark:border-zinc-800 rounded-xl">
          <div className="flex items-center gap-3.5">
            <Truck className="w-5 h-5 text-[#6D5BD0] shrink-0" />
            <div>
              <p className="text-sm font-semibold">Express Nationwide Delivery</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Free standard shipping over Rs. 15,000</p>
            </div>
          </div>
          <div className="flex items-center gap-3.5">
            <RotateCcw className="w-5 h-5 text-[#6D5BD0] shrink-0" />
            <div>
              <p className="text-sm font-semibold">14-Day Straightforward Returns</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Instant portal return &amp; refund tracking</p>
            </div>
          </div>
          <div className="flex items-center gap-3.5">
            <ShieldCheck className="w-5 h-5 text-[#6D5BD0] shrink-0" />
            <div>
              <p className="text-sm font-semibold">Verified PKR &amp; Card Checkout</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">COD, Bank IBFT, Stripe, JazzCash &amp; Easypaisa</p>
            </div>
          </div>
        </div>
      </section>

      {/* Initial Setup Banner if Firestore Catalog is Empty */}
      {!catalogLoading && products.length === 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#14161D] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                <Sparkles className="w-4 h-4 text-[#6D5BD0]" />
                <span>Storefront Catalog Ready for Initialization</span>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-xl">
                Connect with the store administrator account to populate the live Firestore catalog, categories, brands, and shipping zones.
              </p>
            </div>
            {isBootstrappedAdmin ? (
              <button
                type="button"
                onClick={handleInitializeCatalog}
                disabled={seeding}
                className="px-5 py-2.5 rounded-lg bg-[#6D5BD0] text-white text-sm font-medium hover:bg-[#5B49BF] whitespace-nowrap"
              >
                {seeding ? 'Initializing Catalog...' : 'Initialize Store Catalog'}
              </button>
            ) : (
              <button
                type="button"
                onClick={signInWithGoogle}
                className="px-5 py-2.5 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm font-medium whitespace-nowrap"
              >
                {user ? 'Switch to Admin Account' : 'Sign In as Store Admin'}
              </button>
            )}
          </div>
        </section>
      )}

      {/* 2. Curated Categories */}
      {categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight">Shop by Department</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Six focused departments built around longevity and daily utility.
              </p>
            </div>
            <Link to="/categories" className="text-sm font-medium text-[#6D5BD0] hover:underline whitespace-nowrap">
              All Categories
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {categories.filter((c) => c.active).slice(0, 6).map((cat) => (
              <Link
                key={cat.id}
                to={`/categories/${cat.slug}`}
                className="group bg-white dark:bg-[#14161D] border border-zinc-200/80 dark:border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
              >
                <div className="aspect-[4/3] bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
                  <ResilientImage
                    src={cat.image}
                    alt={cat.name}
                    fallbackLabel={cat.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {cat.name}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 3. Featured Collection Grid with Interactive Filter Tabs */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight">Curated Essentials</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Real-time stock and verified customer ratings across our active catalog.
            </p>
          </div>
          <div className="inline-flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg self-start">
            {(
              [
                { id: 'featured', label: 'Featured' },
                { id: 'trending', label: 'Trending' },
                { id: 'new', label: 'New Arrivals' },
                { id: 'sale', label: 'On Sale' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-[#1E202B] text-zinc-900 dark:text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {catalogLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-80 rounded-xl bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
          >
            View Complete Catalog ({products.length})
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* 4. Featured Brands & Proof Testimonials */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
        <div className="bg-zinc-950 text-white dark:bg-[#14161D] border border-zinc-800 rounded-2xl p-8 sm:p-12 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div className="space-y-4">
            <h2 className="font-display text-2xl sm:text-3xl font-bold [text-wrap:balance]">
              {cms.promoTitle}
            </h2>
            <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
              {cms.promoDescription}
            </p>
            <Link
              to={cms.promoCtaLink || '/shop'}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#6D5BD0] text-white text-sm font-medium hover:bg-[#5B49BF] transition-colors"
            >
              <span>{cms.promoCtaLabel || 'Browse Featured Brands'}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {brands.filter((b) => b.featured).slice(0, 4).map((b) => (
              <Link
                key={b.id}
                to={`/brands/${b.slug}`}
                className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              >
                <p className="font-display font-semibold text-sm">{b.name}</p>
                <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{b.description}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Customer Testimonials */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cms.testimonials.map((t) => (
            <div
              key={t.name}
              className="p-6 rounded-xl bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between gap-4"
            >
              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                “{t.quote}”
              </p>
              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <p className="text-sm font-semibold">{t.name}</p>
                <p className="text-xs text-zinc-500">
                  {t.role} · {t.city} · {t.outcome}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
