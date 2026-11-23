/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import { StoreProvider } from './context/StoreContext';
import { StorefrontLayout } from './components/StorefrontLayout';
import { HomePage } from './pages/storefront/HomePage';
import { CatalogPage } from './pages/storefront/CatalogPage';
import { ProductDetailPage } from './pages/storefront/ProductDetailPage';
import { CartPage } from './pages/storefront/CartPage';
import { CheckoutPage } from './pages/storefront/CheckoutPage';
import { WishlistPage } from './pages/storefront/WishlistPage';
import {
  AboutPage,
  AuthPortalPage,
  CategoriesDirectoryPage,
  ContactPage,
  FaqPage,
  PolicyPage,
} from './pages/storefront/InfoPages';
import { AccountDashboard } from './pages/account/AccountDashboard';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminOverview } from './pages/admin/AdminOverview';
import { AdminProducts } from './pages/admin/AdminProducts';
import {
  AdminBrandsPage,
  AdminCategoriesPage,
  AdminInventoryPage,
} from './pages/admin/AdminCatalogOps';
import {
  AdminCustomersPage,
  AdminOrdersPage,
  AdminPaymentsPage,
  AdminReturnsPage,
} from './pages/admin/AdminOrdersOps';
import {
  AdminActivityLogsPage,
  AdminAnalyticsPage,
  AdminCmsPage,
  AdminCouponsPage,
  AdminReviewsPage,
  AdminSettingsPage,
  AdminShippingPage,
  AdminStaffPage,
  AdminSupportPage,
} from './pages/admin/AdminMarketingAndCms';

function NotFoundPage() {
  return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center space-y-5">
      <p className="font-mono text-xs uppercase tracking-widest text-[#6D5BD0]">404</p>
      <h1 className="font-display text-3xl font-bold tracking-tight">Page not found</h1>
      <p className="text-sm text-zinc-500">
        The page you requested could not be found or has been moved.
      </p>
      <div className="flex items-center justify-center gap-3">
        <Link
          to="/"
          className="px-5 py-2.5 rounded-lg bg-[#6D5BD0] text-white text-sm font-medium"
        >
          Back to Home
        </Link>
        <Link
          to="/shop"
          className="px-5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm font-medium"
        >
          Browse Catalog
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <StoreProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Storefront & Customer Portal */}
              <Route element={<StorefrontLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/shop" element={<CatalogPage mode="all" />} />
                <Route path="/categories" element={<CategoriesDirectoryPage />} />
                <Route path="/categories/:slug" element={<CatalogPage mode="category" />} />
                <Route path="/brands/:slug" element={<CatalogPage mode="brand" />} />
                <Route path="/search" element={<CatalogPage mode="search" />} />
                <Route path="/products/:slug" element={<ProductDetailPage />} />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/wishlist" element={<WishlistPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/faq" element={<FaqPage />} />
                <Route path="/policies/:slug" element={<PolicyPage />} />
                <Route path="/login" element={<AuthPortalPage mode="login" />} />
                <Route path="/register" element={<AuthPortalPage mode="register" />} />
                <Route path="/forgot-password" element={<AuthPortalPage mode="reset" />} />
                <Route path="/reset-password" element={<AuthPortalPage mode="reset" />} />

                {/* Customer Account Portal */}
                <Route path="/account" element={<AccountDashboard />} />
                <Route path="/account/orders" element={<AccountDashboard />} />
                <Route path="/account/addresses" element={<AccountDashboard />} />
                <Route path="/account/profile" element={<AccountDashboard />} />
                <Route path="/account/returns" element={<AccountDashboard />} />
                <Route path="/account/reviews" element={<AccountDashboard />} />
                <Route path="/account/notifications" element={<AccountDashboard />} />
                <Route path="/account/support" element={<AccountDashboard />} />

                <Route path="*" element={<NotFoundPage />} />
              </Route>

              {/* Enterprise Admin Console */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminOverview />} />
                <Route path="products" element={<AdminProducts />} />
                <Route path="categories" element={<AdminCategoriesPage />} />
                <Route path="brands" element={<AdminBrandsPage />} />
                <Route path="orders" element={<AdminOrdersPage />} />
                <Route path="customers" element={<AdminCustomersPage />} />
                <Route path="inventory" element={<AdminInventoryPage />} />
                <Route path="coupons" element={<AdminCouponsPage />} />
                <Route path="promotions" element={<AdminCouponsPage />} />
                <Route path="reviews" element={<AdminReviewsPage />} />
                <Route path="returns" element={<AdminReturnsPage />} />
                <Route path="payments" element={<AdminPaymentsPage />} />
                <Route path="shipping" element={<AdminShippingPage />} />
                <Route path="analytics" element={<AdminAnalyticsPage />} />
                <Route path="reports" element={<AdminAnalyticsPage />} />
                <Route path="cms" element={<AdminCmsPage />} />
                <Route path="staff" element={<AdminStaffPage />} />
                <Route path="roles" element={<AdminStaffPage />} />
                <Route path="activity-logs" element={<AdminActivityLogsPage />} />
                <Route path="support" element={<AdminSupportPage />} />
                <Route path="settings" element={<AdminSettingsPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </StoreProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
