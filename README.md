# Nexora — E-Commerce Storefront & Enterprise Admin Console

Nexora is a full-stack e-commerce platform built with React, TypeScript, Tailwind CSS, Express, Firebase Firestore & Authentication, and Gemini Merchandising Intelligence. It combines a high-conversion shopping storefront with a dedicated `/admin` operations console and regional Pakistan commerce support (PKR currency, city-tiered delivery rates, Cash on Delivery, IBFT Bank Transfer, Stripe, JazzCash, and Easypaisa adapters).

## Key Features

- **Customer Storefront**: Announcement bar, mega category navigation, autocomplete search, product detail gallery with zoom, variant/size/color selection, wishlist sync, product comparison tray, recently viewed shelf, persistent cart drawer, and multi-payment checkout with live inventory validation.
- **Customer Account Portal (`/account`)**: Order tracking timeline, self-service cancellation & return requests, printable invoices, saved shipping addresses, product reviews, notifications, and live support ticket messaging.
- **Admin Console (`/admin`)**: Real-time KPI dashboard with Recharts analytics, Product CRUD (variants, CSV import/export, bulk actions), Categories & Brands management, Inventory ledger with Suppliers & Purchase Orders, Orders fulfillment & printable packing slips, Customers LTV & segmentation, Coupons, Returns/Refunds, Reviews moderation, Support inbox, Storefront CMS editor, Staff RBAC, and immutable Activity Audit Logs.
- **Backend API (`server.ts`)**: Authoritative checkout calculation (`/api/checkout/calculate`), idempotent payment adapter & verified Stripe webhook (`/api/payments/*`), Gemini AI recommendations (`/api/ai/recommendations`) with deterministic fallback, Firebase ID token verification, rate limiting, and dynamic `/robots.txt` & `/sitemap.xml`.

## Setup & Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables in `.env` (see `.env.example`):
   - `GEMINI_API_KEY`: Optional server-side Gemini API key for AI product recommendations.
   - `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`: Optional Stripe credentials for international card checkout.
   - `JAZZCASH_*` / `EASYPAISA_*`: Optional merchant credentials for mobile wallets.
3. Run the development server (Express + Vite middleware on port 3000):
   ```bash
   npm run dev
   ```
4. Build and run in production:
   ```bash
   npm run build
   npm start
   ```

## Verification & Testing

- **Compile & Type Check**: `npm run build` / `npm run lint`
- **Firestore Security Rules Audit**: `npx eslint firestore.rules`
- **Automated Tests**: `npx tsx --test tests/api-and-security.test.ts`
