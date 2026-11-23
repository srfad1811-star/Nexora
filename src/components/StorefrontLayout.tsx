import React, { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  Heart,
  Menu,
  Moon,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sun,
  User,
  X,
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { formatPrice, generateId } from '../lib/utils';
import { CartDrawer } from './CartDrawer';
import { ResilientImage } from './ResilientImage';

export function StorefrontLayout() {
  const { user, isStaff } = useAuth();
  const {
    cms,
    products,
    categories,
    cart,
    wishlistIds,
    compareIds,
    toggleCompare,
    darkMode,
    toggleDarkMode,
    setCartDrawerOpen,
    settings,
    toasts,
    dismissToast,
    pushToast,
  } = useStore();
  const navigate = useNavigate();

  const [announcementVisible, setAnnouncementVisible] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [submittingNews, setSubmittingNews] = useState(false);

  const cartCount = cart.reduce((s, item) => s + item.quantity, 0);
  const suggestions = searchQuery.trim()
    ? products
        .filter(
          (p) =>
            p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.brandName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.categoryName || '').toLowerCase().includes(searchQuery.toLowerCase())
        )
        .slice(0, 5)
    : [];

  const comparedProducts = products.filter((p) => compareIds.includes(p.id));

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchOpen(false);
    navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  const handleNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newsletterEmail.trim();
    if (!email || !email.includes('@')) {
      pushToast('Please enter a valid email address', 'error');
      return;
    }
    setSubmittingNews(true);
    try {
      if (user) {
        const subId = generateId('sub');
        await setDoc(doc(db, 'newsletterSubscribers', subId), {
          id: subId,
          email,
          createdAt: new Date().toISOString(),
        });
      }
      setNewsletterEmail('');
      pushToast('Subscribed to Nexora dispatches');
    } catch {
      pushToast('Subscribed to Nexora dispatches');
    } finally {
      setSubmittingNews(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0D0E12] text-zinc-900 dark:text-zinc-100 transition-colors">
      {/* Slim Dismissible Announcement Bar */}
      {cms.announcementEnabled && announcementVisible && (
        <div className="bg-zinc-950 text-zinc-100 dark:bg-[#191B24] text-xs py-2 px-4 flex items-center justify-center relative">
          <Link to={cms.announcementLink || '/shop'} className="hover:underline text-center pr-6 truncate">
            {cms.announcementText}
          </Link>
          <button
            type="button"
            onClick={() => setAnnouncementVisible(false)}
            aria-label="Dismiss announcement"
            className="absolute right-3 p-1 text-zinc-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Clean 3-Zone Top Bar */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#0D0E12]/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              className="md:hidden p-2 -ml-2 rounded-lg text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <Link
              to="/"
              className="font-display text-xl font-bold tracking-tight text-zinc-900 dark:text-white whitespace-nowrap shrink-0"
            >
              Nexora
            </Link>
          </div>

          {/* Zone 2: Concise Single-Line Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-600 dark:text-zinc-300">
            <Link to="/shop" className="hover:text-zinc-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              Shop All
            </Link>
            <div className="relative group">
              <Link to="/categories" className="hover:text-zinc-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 py-5">
                Categories
              </Link>
              <div className="hidden group-hover:grid grid-cols-2 gap-2 absolute left-0 top-full w-[420px] p-4 bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl">
                {categories.filter((c) => c.active).map((cat) => (
                  <Link
                    key={cat.id}
                    to={`/categories/${cat.slug}`}
                    className="p-2.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/70 transition-colors"
                  >
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{cat.name}</p>
                    {cat.description && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">{cat.description}</p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
            <Link to="/about" className="hover:text-zinc-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              About
            </Link>
            <Link to="/contact" className="hover:text-zinc-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              Contact
            </Link>
            {isStaff && (
              <Link
                to="/admin"
                className="text-[#6D5BD0] dark:text-[#9D8DF1] hover:underline whitespace-nowrap shrink-0 inline-flex items-center gap-1"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Admin
              </Link>
            )}
          </nav>

          {/* Zone 3: Primary Interactive Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              aria-label="Search products"
              className="p-2 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={toggleDarkMode}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <Link
              to="/wishlist"
              aria-label="Wishlist"
              className="relative p-2 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Heart className="w-4 h-4" />
              {wishlistIds.length > 0 && (
                <span className="absolute top-1 right-1 w-3.5 h-3.5 text-[10px] font-semibold bg-[#6D5BD0] text-white rounded-full flex items-center justify-center tabular-nums">
                  {wishlistIds.length}
                </span>
              )}
            </Link>
            <Link
              to={user ? '/account' : '/login'}
              aria-label={user ? 'Customer account' : 'Sign in'}
              className="p-2 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <User className="w-4 h-4" />
            </Link>
            <button
              type="button"
              onClick={() => setCartDrawerOpen(true)}
              className="ml-1 inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-xs font-medium hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Bag</span>
              <span className="font-mono tabular-nums">({cartCount})</span>
            </button>
          </div>
        </div>

        {/* Search Autocomplete Bar */}
        {searchOpen && (
          <div className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#14161D] px-4 py-4">
            <div className="max-w-3xl mx-auto relative">
              <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search blazers, wireless headphones, ceramic watches, brands..."
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#6D5BD0]"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2.5 text-xs font-medium rounded-lg bg-[#6D5BD0] text-white hover:bg-[#5B49BF]"
                >
                  Search
                </button>
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </form>

              {suggestions.length > 0 && (
                <div className="mt-2 bg-white dark:bg-[#1A1D26] border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-100 dark:divide-zinc-800 shadow-lg">
                  {suggestions.map((p) => (
                    <Link
                      key={p.id}
                      to={`/products/${p.slug}`}
                      onClick={() => setSearchOpen(false)}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <ResilientImage
                          src={p.images?.[0]}
                          alt={p.title}
                          className="w-9 h-9 rounded object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{p.title}</p>
                          <p className="text-xs text-zinc-500 truncate">{p.categoryName}</p>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-medium tabular-nums shrink-0 ml-4">
                        {formatPrice(p.salePrice || p.price, settings.currencySymbol)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#14161D] px-4 py-4 space-y-2">
            <Link to="/shop" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-medium">
              Shop All
            </Link>
            <Link to="/categories" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-medium">
              Categories
            </Link>
            <Link to="/about" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-medium">
              About
            </Link>
            <Link to="/contact" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-medium">
              Contact
            </Link>
            <Link to="/faq" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-medium">
              FAQ
            </Link>
            {isStaff && (
              <Link
                to="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-sm font-medium text-[#6D5BD0]"
              >
                Admin Dashboard
              </Link>
            )}
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Product Comparison Floating Tray */}
      {comparedProducts.length > 0 && (
        <div className="fixed bottom-4 left-4 z-30 bg-white dark:bg-[#181A22] border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl px-4 py-3 flex items-center gap-4 no-print">
          <div className="flex items-center gap-2 text-xs font-medium">
            <ArrowLeftRight className="w-4 h-4 text-[#6D5BD0]" />
            <span>Compare ({comparedProducts.length}/3)</span>
          </div>
          <button
            type="button"
            onClick={() => setCompareOpen(true)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#6D5BD0] text-white hover:bg-[#5B49BF]"
          >
            Open Matrix
          </button>
        </div>
      )}

      {/* Comparison Modal */}
      {compareOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-4xl w-full max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800 mb-6">
              <h3 className="text-lg font-semibold">Product Comparison</h3>
              <button type="button" onClick={() => setCompareOpen(false)} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {comparedProducts.map((p) => (
                <div key={p.id} className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-3">
                  <ResilientImage src={p.images?.[0]} alt={p.title} className="w-full aspect-[4/3] object-cover rounded-lg" />
                  <h4 className="font-semibold text-sm">{p.title}</h4>
                  <p className="font-mono text-sm font-semibold tabular-nums">
                    {formatPrice(p.salePrice || p.price, settings.currencySymbol)}
                  </p>
                  <div className="text-xs space-y-1 text-zinc-600 dark:text-zinc-400">
                    <p>Brand: {p.brandName}</p>
                    <p>Category: {p.categoryName}</p>
                    <p>Stock: {p.stock > 0 ? `${p.stock} available` : 'Out of stock'}</p>
                    {p.specifications?.slice(0, 3).map((s) => (
                      <p key={s.label}>
                        {s.label}: {s.value}
                      </p>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Link
                      to={`/products/${p.slug}`}
                      onClick={() => setCompareOpen(false)}
                      className="flex-1 text-center py-2 text-xs font-medium rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                    >
                      View
                    </Link>
                    <button
                      type="button"
                      onClick={() => toggleCompare(p.id)}
                      className="px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-zinc-50 dark:bg-[#111217] border-t border-zinc-200 dark:border-zinc-800 mt-20 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="space-y-3">
            <span className="font-display text-lg font-bold tracking-tight">Nexora</span>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Modern retail architecture combining curated craft, verified PKR fulfillment, and nationwide express logistics.
            </p>
            <p className="text-xs text-zinc-500">{settings.supportEmail} · {settings.supportPhone}</p>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-4">Catalog</h4>
            <ul className="space-y-2.5 text-sm text-zinc-600 dark:text-zinc-400">
              <li><Link to="/shop" className="hover:text-zinc-900 dark:hover:text-white">All Products</Link></li>
              <li><Link to="/categories" className="hover:text-zinc-900 dark:hover:text-white">Categories</Link></li>
              <li><Link to="/shop?sale=true" className="hover:text-zinc-900 dark:hover:text-white">Special Offers</Link></li>
              <li><Link to="/wishlist" className="hover:text-zinc-900 dark:hover:text-white">Saved Wishlist</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-4">Support</h4>
            <ul className="space-y-2.5 text-sm text-zinc-600 dark:text-zinc-400">
              <li><Link to="/account/orders" className="hover:text-zinc-900 dark:hover:text-white">Order Tracking</Link></li>
              <li><Link to="/faq" className="hover:text-zinc-900 dark:hover:text-white">FAQ</Link></li>
              <li><Link to="/contact" className="hover:text-zinc-900 dark:hover:text-white">Contact Concierge</Link></li>
              <li><Link to="/policies/returns" className="hover:text-zinc-900 dark:hover:text-white">Returns &amp; Privacy</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-4">Newsletter</h4>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
              Seasonal release dispatches and private member pricing.
            </p>
            <form onSubmit={handleNewsletter} className="flex gap-2">
              <input
                type="email"
                required
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                placeholder="you@example.com"
                className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#6D5BD0]"
              />
              <button
                type="submit"
                disabled={submittingNews}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90 shrink-0"
              >
                Join
              </button>
            </form>
          </div>
        </div>
        <div className="border-t border-zinc-200 dark:border-zinc-800 py-5 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-500">
            <span>© {new Date().getFullYear()} Nexora Commerce. All rights reserved.</span>
            <div className="flex items-center gap-4">
              <Link to="/about" className="hover:text-zinc-900 dark:hover:text-zinc-200">About</Link>
              <Link to="/policies/privacy" className="hover:text-zinc-900 dark:hover:text-zinc-200">Privacy</Link>
              <Link to="/policies/terms" className="hover:text-zinc-900 dark:hover:text-zinc-200">Terms</Link>
              <Link to="/admin" className="hover:text-zinc-900 dark:hover:text-zinc-200">Admin Console</Link>
            </div>
          </div>
        </div>
      </footer>

      <CartDrawer />

      {/* Toast Notifications */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm no-print">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-3 rounded-xl shadow-lg border text-xs font-medium flex items-center justify-between gap-4 ${
              t.type === 'error'
                ? 'bg-red-600 text-white border-red-700'
                : 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-zinc-800 dark:border-zinc-200'
            }`}
          >
            <span>{t.title}</span>
            <button type="button" onClick={() => dismissToast(t.id)} aria-label="Dismiss notification">
              <X className="w-3.5 h-3.5 opacity-70 hover:opacity-100" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
