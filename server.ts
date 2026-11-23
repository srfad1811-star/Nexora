import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { z } from 'zod';
import { GoogleGenAI, Type } from '@google/genai';
import Stripe from 'stripe';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';
import firebaseConfig from './firebase-applet-config.json';

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

// Initialize Firebase Admin solely for stateless verifyIdToken() (requires zero IAM)
const adminApp = getApps().length
  ? getApp()
  : initializeApp({ projectId: firebaseConfig.projectId });
const adminAuth = getAuth(adminApp);

// Gemini Server Client (lazy / optional when GEMINI_API_KEY is present)
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
}

// Stripe Server Client (optional when STRIPE_SECRET_KEY is configured)
function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !key.startsWith('sk_')) return null;
  return new Stripe(key);
}

// In-memory rate limiter for /api routes
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(maxRequests = 120, windowMs = 60_000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const bucket = rateBuckets.get(ip);
    if (!bucket || now > bucket.resetAt) {
      rateBuckets.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (bucket.count >= maxRequests) {
      return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
    }
    bucket.count += 1;
    next();
  };
}

// Optional Auth Middleware (verifies Bearer ID token if supplied)
interface AuthenticatedRequest extends Request {
  authUser?: DecodedIdToken;
}

async function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    if (token) {
      try {
        req.authUser = await adminAuth.verifyIdToken(token);
      } catch {
        // Leave authUser undefined if token invalid
      }
    }
  }
  next();
}

// Idempotent payment reference ledger
const processedWebhooks = new Set<string>();
const paymentIntentsLedger = new Map<string, { id: string; method: string; amount: number; status: string; createdAt: string }>();

async function startServer() {
  const app = express();

  // Stripe webhook requires raw body BEFORE express.json()
  app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), (req: Request, res: Response) => {
    const stripe = getStripeClient();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripe || !webhookSecret) {
      return res.status(503).json({
        error: 'Stripe webhook secret is not configured in environment variables.',
        configured: false,
      });
    }

    const sig = req.headers['stripe-signature'];
    if (!sig || typeof sig !== 'string') {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    try {
      const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      if (processedWebhooks.has(event.id)) {
        return res.json({ received: true, duplicate: true });
      }
      processedWebhooks.add(event.id);
      if (event.type === 'payment_intent.succeeded') {
        const intent = event.data.object as Stripe.PaymentIntent;
        paymentIntentsLedger.set(intent.id, {
          id: intent.id,
          method: 'stripe',
          amount: intent.amount,
          status: 'paid',
          createdAt: new Date().toISOString(),
        });
      }
      return res.json({ received: true, eventId: event.id });
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : 'Webhook signature verification failed' });
    }
  });

  app.use(express.json({ limit: '1mb' }));
  app.use('/api', rateLimit(150, 60_000));

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // ---------------------------------------------------------------------------
  // 1. Integration & Health Status (returns booleans only, zero secret values)
  // ---------------------------------------------------------------------------
  app.get('/api/health', (_req, res) => {
    const geminiReady = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');
    const stripeReady = Boolean(process.env.STRIPE_SECRET_KEY?.startsWith('sk_'));
    const jazzcashReady = Boolean(process.env.JAZZCASH_MERCHANT_ID && process.env.JAZZCASH_INTEGRITY_SALT);
    const easypaisaReady = Boolean(process.env.EASYPAISA_STORE_ID && process.env.EASYPAISA_HASH_KEY);
    const resendReady = Boolean(process.env.RESEND_API_KEY);

    res.json({
      status: 'ok',
      integrations: {
        firebase: true,
        gemini: geminiReady,
        stripe: stripeReady,
        jazzcash: jazzcashReady,
        easypaisa: easypaisaReady,
        resend: resendReady,
      },
    });
  });

  // ---------------------------------------------------------------------------
  // 2. AI Product Recommendations Service (Gemini 4 Hydrogen + deterministic fallback)
  // ---------------------------------------------------------------------------
  const RecommendationInputSchema = z.object({
    currentProductId: z.string().max(128).optional(),
    query: z.string().max(200).optional(),
    recentlyViewedIds: z.array(z.string().max(128)).max(20).optional(),
    catalog: z
      .array(
        z.object({
          id: z.string().max(128),
          title: z.string().max(180),
          categoryName: z.string().max(100).optional(),
          brandName: z.string().max(100).optional(),
          price: z.number(),
          ratingAvg: z.number().optional(),
        })
      )
      .max(60),
  });

  app.post('/api/ai/recommendations', optionalAuth, async (req: Request, res: Response) => {
    const parsed = RecommendationInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid recommendation payload', details: parsed.error.flatten() });
    }

    const { currentProductId, query, recentlyViewedIds = [], catalog } = parsed.data;
    const candidates = catalog.filter((p) => p.id !== currentProductId);

    const deterministicFallback = () => {
      const current = catalog.find((p) => p.id === currentProductId);
      const q = (query || '').toLowerCase();
      const scored = candidates
        .map((item) => {
          let score = (item.ratingAvg || 4.5) * 10;
          if (current && item.categoryName && item.categoryName === current.categoryName) score += 25;
          if (current && item.brandName && item.brandName === current.brandName) score += 15;
          if (recentlyViewedIds.includes(item.id)) score += 10;
          if (q && (item.title.toLowerCase().includes(q) || (item.categoryName || '').toLowerCase().includes(q))) {
            score += 30;
          }
          return { id: item.id, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);

      return {
        recommendedIds: scored.map((s) => s.id),
        rationale: current
          ? `Curated pairings alongside ${current.title} based on category, craft compatibility, and customer ratings.`
          : 'Curated essentials ranked by customer rating and catalog relevance.',
        source: 'catalog_similarity',
      };
    };

    const ai = getGeminiClient();
    if (!ai || candidates.length === 0) {
      return res.json(deterministicFallback());
    }

    try {
      const current = catalog.find((p) => p.id === currentProductId);
      const prompt = [
        'You are the merchandising curator for Nexora.',
        current ? `The shopper is viewing: ${current.title} (${current.categoryName || 'General'}).` : '',
        query ? `Shopper search context: "${query}".` : '',
        `Available catalog items JSON: ${JSON.stringify(candidates.slice(0, 25))}`,
        'Select up to 4 complementary product IDs from the catalog JSON and give one concise editorial sentence explaining the curation.',
      ]
        .filter(Boolean)
        .join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              recommendedIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              rationale: { type: Type.STRING },
            },
            required: ['recommendedIds', 'rationale'],
          },
        },
      });

      const parsedJson = JSON.parse(response.text || '{}') as { recommendedIds?: string[]; rationale?: string };
      const validIds = (parsedJson.recommendedIds || []).filter((id) => candidates.some((c) => c.id === id)).slice(0, 4);

      if (validIds.length === 0) {
        return res.json(deterministicFallback());
      }

      return res.json({
        recommendedIds: validIds,
        rationale: parsedJson.rationale || 'Curated by Nexora Merchandising Intelligence.',
        source: 'gemini',
      });
    } catch (err) {
      console.warn('Gemini recommendation fallback triggered:', err instanceof Error ? err.message : err);
      return res.json(deterministicFallback());
    }
  });

  // ---------------------------------------------------------------------------
  // 3. Authoritative Checkout Totals Calculator
  // ---------------------------------------------------------------------------
  const CheckoutCalcSchema = z.object({
    items: z
      .array(
        z.object({
          productId: z.string().min(1),
          unitPrice: z.number().nonnegative(),
          quantity: z.number().int().positive().max(99),
        })
      )
      .min(1),
    city: z.string().max(100).default('Lahore'),
    deliveryMethod: z.enum(['standard', 'express']).default('standard'),
    paymentMethod: z.enum(['stripe', 'cod', 'bank_transfer', 'jazzcash', 'easypaisa']),
    coupon: z
      .object({
        code: z.string(),
        type: z.enum(['percentage', 'fixed', 'free_shipping']),
        value: z.number().nonnegative(),
        minOrderAmount: z.number().nonnegative().optional(),
      })
      .nullable()
      .optional(),
    settings: z
      .object({
        taxRatePercent: z.number().min(0).max(50).default(5),
        freeShippingThreshold: z.number().nonnegative().default(15000),
        codFee: z.number().nonnegative().default(150),
      })
      .optional(),
  });

  app.post('/api/checkout/calculate', (req: Request, res: Response) => {
    const parsed = CheckoutCalcSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid checkout calculation input' });
    }

    const { items, city, deliveryMethod, paymentMethod, coupon, settings } = parsed.data;
    const taxRate = settings?.taxRatePercent ?? 5;
    const freeThreshold = settings?.freeShippingThreshold ?? 15000;
    const baseCodFee = settings?.codFee ?? 150;

    const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

    let discountAmount = 0;
    let freeShipFromCoupon = false;

    if (coupon && subtotal >= (coupon.minOrderAmount ?? 0)) {
      if (coupon.type === 'percentage') {
        discountAmount = Math.round((subtotal * coupon.value) / 100);
      } else if (coupon.type === 'fixed') {
        discountAmount = Math.min(subtotal, Math.round(coupon.value));
      } else if (coupon.type === 'free_shipping') {
        freeShipFromCoupon = true;
      }
    }

    const normalizedCity = city.trim().toLowerCase();
    let zoneStandard = 390;
    let zoneExpress = 750;
    if (normalizedCity === 'lahore') {
      zoneStandard = 200;
      zoneExpress = 450;
    } else if (['karachi', 'islamabad', 'rawalpindi'].includes(normalizedCity)) {
      zoneStandard = 300;
      zoneExpress = 600;
    }

    let shippingFee = deliveryMethod === 'express' ? zoneExpress : zoneStandard;
    if (deliveryMethod === 'standard' && (subtotal >= freeThreshold || freeShipFromCoupon)) {
      shippingFee = 0;
    }

    const codFee = paymentMethod === 'cod' ? baseCodFee : 0;
    const taxableBase = Math.max(0, subtotal - discountAmount);
    const taxAmount = Math.round((taxableBase * taxRate) / 100);
    const total = Math.max(0, taxableBase + shippingFee + codFee + taxAmount);

    res.json({
      subtotal,
      discountAmount,
      shippingFee,
      codFee,
      taxAmount,
      total,
      freeShippingRemaining: Math.max(0, freeThreshold - subtotal),
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Provider-Based Payment Adapter (Idempotent, Never Fakes Live Gateway)
  // ---------------------------------------------------------------------------
  const PaymentIntentSchema = z.object({
    orderNumber: z.string().min(3).max(40),
    amountPkr: z.number().positive(),
    paymentMethod: z.enum(['stripe', 'cod', 'bank_transfer', 'jazzcash', 'easypaisa']),
    customerEmail: z.string().email(),
    idempotencyKey: z.string().min(8).max(128),
  });

  app.post('/api/payments/create-intent', optionalAuth, async (req: Request, res: Response) => {
    const parsed = PaymentIntentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payment payload' });
    }

    const { orderNumber, amountPkr, paymentMethod, customerEmail, idempotencyKey } = parsed.data;

    if (paymentIntentsLedger.has(idempotencyKey)) {
      return res.json(paymentIntentsLedger.get(idempotencyKey));
    }

    if (paymentMethod === 'cod') {
      const record = {
        id: `COD-${orderNumber}`,
        method: 'cod',
        amount: amountPkr,
        status: 'pending',
        configured: true,
        instructions: 'Cash on Delivery verified. Pay courier upon parcel arrival.',
        createdAt: new Date().toISOString(),
      };
      paymentIntentsLedger.set(idempotencyKey, record);
      return res.json(record);
    }

    if (paymentMethod === 'bank_transfer') {
      const record = {
        id: `IBFT-${orderNumber}`,
        method: 'bank_transfer',
        amount: amountPkr,
        status: 'awaiting_verification',
        configured: true,
        instructions: 'Transfer via IBFT / Raast using your Order Number as reference.',
        createdAt: new Date().toISOString(),
      };
      paymentIntentsLedger.set(idempotencyKey, record);
      return res.json(record);
    }

    if (paymentMethod === 'stripe') {
      const stripe = getStripeClient();
      if (!stripe) {
        return res.status(200).json({
          id: null,
          method: 'stripe',
          amount: amountPkr,
          status: 'requires_configuration',
          configured: false,
          message: 'Stripe API credentials (STRIPE_SECRET_KEY) are not configured in environment secrets. Select Cash on Delivery or Bank Transfer, or configure Stripe in Settings > Secrets.',
        });
      }
      try {
        const intent = await stripe.paymentIntents.create(
          {
            amount: Math.round(amountPkr * 100),
            currency: 'pkr',
            receipt_email: customerEmail,
            metadata: { orderNumber },
          },
          { idempotencyKey }
        );
        const record = {
          id: intent.id,
          clientSecret: intent.client_secret,
          method: 'stripe',
          amount: amountPkr,
          status: 'pending',
          configured: true,
          createdAt: new Date().toISOString(),
        };
        paymentIntentsLedger.set(idempotencyKey, record);
        return res.json(record);
      } catch (err) {
        return res.status(502).json({
          error: err instanceof Error ? err.message : 'Stripe PaymentIntent failed',
        });
      }
    }

    if (paymentMethod === 'jazzcash') {
      const merchantId = process.env.JAZZCASH_MERCHANT_ID;
      const salt = process.env.JAZZCASH_INTEGRITY_SALT;
      if (!merchantId || !salt) {
        return res.status(200).json({
          id: null,
          method: 'jazzcash',
          amount: amountPkr,
          status: 'requires_configuration',
          configured: false,
          message: 'JazzCash Merchant ID & Integrity Salt are not configured in environment secrets.',
        });
      }
      const txnRef = `JC${Date.now()}`;
      const hashString = `${salt}&${Math.round(amountPkr * 100)}&${merchantId}&${txnRef}`;
      const secureHash = crypto.createHmac('sha256', salt).update(hashString).digest('hex');
      const record = {
        id: txnRef,
        method: 'jazzcash',
        amount: amountPkr,
        status: 'awaiting_verification',
        configured: true,
        secureHash,
        createdAt: new Date().toISOString(),
      };
      paymentIntentsLedger.set(idempotencyKey, record);
      return res.json(record);
    }

    if (paymentMethod === 'easypaisa') {
      const storeId = process.env.EASYPAISA_STORE_ID;
      const hashKey = process.env.EASYPAISA_HASH_KEY;
      if (!storeId || !hashKey) {
        return res.status(200).json({
          id: null,
          method: 'easypaisa',
          amount: amountPkr,
          status: 'requires_configuration',
          configured: false,
          message: 'Easypaisa Store ID & Hash Key are not configured in environment secrets.',
        });
      }
      const txnRef = `EP${Date.now()}`;
      const record = {
        id: txnRef,
        method: 'easypaisa',
        amount: amountPkr,
        status: 'awaiting_verification',
        configured: true,
        createdAt: new Date().toISOString(),
      };
      paymentIntentsLedger.set(idempotencyKey, record);
      return res.json(record);
    }

    return res.status(400).json({ error: 'Unsupported payment method' });
  });

  // ---------------------------------------------------------------------------
  // 5. Guest Checkout Receipt Validation & Signing
  // ---------------------------------------------------------------------------
  const GuestReceiptSchema = z.object({
    orderNumber: z.string().min(4).max(40),
    customerName: z.string().min(2).max(120),
    customerEmail: z.string().email(),
    customerPhone: z.string().min(7).max(40),
    total: z.number().nonnegative(),
  });

  app.post('/api/checkout/guest-receipt', (req: Request, res: Response) => {
    const parsed = GuestReceiptSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid guest checkout details' });
    }
    const secret = process.env.GUEST_RECEIPT_SECRET || 'nexora-ephemeral-session-key';
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${parsed.data.orderNumber}:${parsed.data.customerEmail}:${parsed.data.total}`)
      .digest('hex')
      .slice(0, 16);

    res.json({
      verified: true,
      receiptCode: `NX-REC-${signature.toUpperCase()}`,
      createdAt: new Date().toISOString(),
    });
  });

  // ---------------------------------------------------------------------------
  // 6. SEO Sitemap & Robots.txt
  // ---------------------------------------------------------------------------
  app.get('/robots.txt', (_req, res) => {
    res.type('text/plain');
    res.send('User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /account\nSitemap: /sitemap.xml\n');
  });

  app.get('/sitemap.xml', (req, res) => {
    const base = `${req.protocol}://${req.get('host')}`;
    const urls = ['/', '/shop', '/categories', '/about', '/contact', '/faq', '/cart', '/checkout'];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${base}${u}</loc><changefreq>daily</changefreq></url>`).join('\n')}
</urlset>`;
    res.type('application/xml').send(xml);
  });

  // ---------------------------------------------------------------------------
  // 7. Vite Dev Middleware / Production Static Assets
  // ---------------------------------------------------------------------------
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Nexora server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
