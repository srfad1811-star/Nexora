import React, { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { ProductCard } from '../../components/ProductCard';
import { formatPrice } from '../../lib/utils';

type SortOption = 'featured' | 'newest' | 'price_asc' | 'price_desc' | 'best_selling' | 'highest_rated';

export function CatalogPage({ mode = 'all' }: { mode?: 'all' | 'category' | 'brand' | 'search' }) {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const { products, categories, brands, settings, catalogLoading } = useStore();

  const initialQuery = searchParams.get('q') || '';
  const initialSale = searchParams.get('sale') === 'true';

  const [queryText, setQueryText] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [maxPrice, setMaxPrice] = useState<number>(100000);
  const [minRating, setMinRating] = useState<number>(0);
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [onSaleOnly, setOnSaleOnly] = useState<boolean>(initialSale);
  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const [page, setPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const pageSize = 9;

  const activeCategory = useMemo(
    () => (mode === 'category' && slug ? categories.find((c) => c.slug === slug) : undefined),
    [mode, slug, categories]
  );

  const activeBrand = useMemo(
    () => (mode === 'brand' && slug ? brands.find((b) => b.slug === slug) : undefined),
    [mode, slug, brands]
  );

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    return products
      .filter((p) => {
        if (activeCategory && p.categoryId !== activeCategory.id) return false;
        if (activeBrand && p.brandId !== activeBrand.id) return false;
        if (selectedCategory !== 'all' && p.categoryId !== selectedCategory) return false;
        if (selectedBrand !== 'all' && p.brandId !== selectedBrand) return false;
        const effective = p.salePrice && p.salePrice < p.price ? p.salePrice : p.price;
        if (effective > maxPrice) return false;
        if (minRating > 0 && (p.ratingAvg || 0) < minRating) return false;
        if (inStockOnly && p.stock <= 0) return false;
        if (onSaleOnly && !(p.salePrice && p.salePrice < p.price)) return false;
        if (q) {
          const hay = `${p.title} ${p.sku} ${p.brandName || ''} ${p.categoryName || ''} ${p.shortDescription || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const priceA = a.salePrice || a.price;
        const priceB = b.salePrice || b.price;
        switch (sortBy) {
          case 'newest':
            return (b.createdAt || '').localeCompare(a.createdAt || '');
          case 'price_asc':
            return priceA - priceB;
          case 'price_desc':
            return priceB - priceA;
          case 'best_selling':
            return (b.salesCount || 0) - (a.salesCount || 0);
          case 'highest_rated':
            return (b.ratingAvg || 0) - (a.ratingAvg || 0);
          default:
            return Number(Boolean(b.featured)) - Number(Boolean(a.featured));
        }
      });
  }, [
    products,
    activeCategory,
    activeBrand,
    selectedCategory,
    selectedBrand,
    maxPrice,
    minRating,
    inStockOnly,
    onSaleOnly,
    queryText,
    sortBy,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const resetFilters = () => {
    setQueryText('');
    setSelectedCategory('all');
    setSelectedBrand('all');
    setMaxPrice(100000);
    setMinRating(0);
    setInStockOnly(false);
    setOnSaleOnly(false);
    setPage(1);
  };

  const pageTitle = activeCategory
    ? activeCategory.name
    : activeBrand
    ? activeBrand.name
    : mode === 'search'
    ? 'Search Results'
    : 'All Products';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800 mb-8">
        <div>
          <div className="text-xs text-zinc-500 flex items-center gap-1.5 mb-2">
            <Link to="/" className="hover:underline">Home</Link>
            <span>/</span>
            <span>{pageTitle}</span>
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight">{pageTitle}</h1>
          {(activeCategory?.description || activeBrand?.description) && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl">
              {activeCategory?.description || activeBrand?.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileFiltersOpen((v) => !v)}
            className="lg:hidden inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg border border-zinc-300 dark:border-zinc-700"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
          </button>
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as SortOption);
              setPage(1);
            }}
            aria-label="Sort products"
            className="px-3.5 py-2 text-xs font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#14161D] focus:outline-none focus:ring-2 focus:ring-[#6D5BD0]"
          >
            <option value="featured">Sort: Featured</option>
            <option value="newest">Sort: Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="best_selling">Best Selling</option>
            <option value="highest_rated">Highest Rated</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar Filters */}
        <aside className={`lg:col-span-3 space-y-6 ${mobileFiltersOpen ? 'block' : 'hidden lg:block'}`}>
          <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#14161D] space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Refine Catalog</h2>
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs text-[#6D5BD0] hover:underline"
              >
                Reset
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-2">Keyword</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={queryText}
                  onChange={(e) => {
                    setQueryText(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Title, SKU, brand..."
                  className="w-full pl-8 pr-8 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                />
                {queryText && (
                  <button
                    type="button"
                    onClick={() => setQueryText('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {!activeCategory && (
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-2">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                >
                  <option value="all">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {!activeBrand && (
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-2">Brand</label>
                <select
                  value={selectedBrand}
                  onChange={(e) => {
                    setSelectedBrand(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                >
                  <option value="all">All Brands</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="font-medium text-zinc-500">Max Price</span>
                <span className="font-mono tabular-nums">{formatPrice(maxPrice, settings.currencySymbol)}</span>
              </div>
              <input
                type="range"
                min={2000}
                max={100000}
                step={1000}
                value={maxPrice}
                onChange={(e) => {
                  setMaxPrice(Number(e.target.value));
                  setPage(1);
                }}
                className="w-full accent-[#6D5BD0]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-2">Minimum Rating</label>
              <select
                value={minRating}
                onChange={(e) => {
                  setMinRating(Number(e.target.value));
                  setPage(1);
                }}
                className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
              >
                <option value={0}>Any rating</option>
                <option value={4}>4.0+ stars</option>
                <option value={4.5}>4.5+ stars</option>
              </select>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <label className="flex items-center gap-2.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => {
                    setInStockOnly(e.target.checked);
                    setPage(1);
                  }}
                  className="rounded accent-[#6D5BD0]"
                />
                <span>In stock only</span>
              </label>
              <label className="flex items-center gap-2.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={onSaleOnly}
                  onChange={(e) => {
                    setOnSaleOnly(e.target.checked);
                    setPage(1);
                  }}
                  className="rounded accent-[#6D5BD0]"
                />
                <span>On sale / discounted</span>
              </label>
            </div>
          </div>
        </aside>

        {/* Product Grid */}
        <div className="lg:col-span-9 space-y-8">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span className="tabular-nums">
              Showing {paged.length} of {filtered.length} products
            </span>
          </div>

          {catalogLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-80 rounded-xl bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
              ))}
            </div>
          ) : paged.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#14161D]">
              <p className="text-base font-semibold mb-1">No matching products found</p>
              <p className="text-sm text-zinc-500 mb-5">
                Try clearing one of your active filters or widening your price range.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="px-5 py-2.5 text-xs font-medium rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {paged.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 disabled:opacity-40"
              >
                Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={`w-8 h-8 text-xs font-medium rounded-lg tabular-nums ${
                    page === n
                      ? 'bg-[#6D5BD0] text-white'
                      : 'border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
