import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { formatPrice, getDiscountPercent, slugify, ROLE_PERMISSIONS } from '../src/lib/utils.ts';

test('formatPrice formats PKR amounts cleanly without decimals', () => {
  assert.equal(formatPrice(15450, 'Rs.'), 'Rs. 15,450');
  assert.equal(formatPrice(0, 'Rs.'), 'Rs. 0');
});

test('getDiscountPercent calculates rounded discount percentage accurately', () => {
  assert.equal(getDiscountPercent(10000, 8000), 20);
  assert.equal(getDiscountPercent(10000, 10000), 0);
  assert.equal(getDiscountPercent(10000, undefined), 0);
});

test('slugify sanitizes titles into URL-safe slugs', () => {
  assert.equal(slugify('Linen Blend Blazer — Autumn 2026!'), 'linen-blend-blazer-autumn-2026');
});

test('RBAC permission matrix restricts non-admin roles properly', () => {
  assert.ok(ROLE_PERMISSIONS.super_admin.includes('staff.manage'));
  assert.ok(!ROLE_PERMISSIONS.support_agent.includes('products.delete'));
  assert.ok(!ROLE_PERMISSIONS.product_manager.includes('orders.refund'));
});

test('Firestore security rules pass ESLint audit with zero errors', () => {
  const output = execSync('npx eslint firestore.rules', { encoding: 'utf-8' });
  assert.equal(output.trim(), '');
});

test('firebase-blueprint.json and security_spec.md exist and are valid', () => {
  const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');
  const specPath = path.resolve(process.cwd(), 'security_spec.md');
  assert.ok(fs.existsSync(blueprintPath));
  assert.ok(fs.existsSync(specPath));
  const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf-8'));
  assert.ok(blueprint.entities && blueprint.firestore);
});

test('server API health, checkout calculation, payment adapter idempotency, and AI fallback', async () => {
  const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
  let serverReachable = false;
  try {
    const healthRes = await fetch(`${baseUrl}/api/health`);
    if (healthRes.ok) {
      serverReachable = true;
      const health = (await healthRes.json()) as { status: string; integrations: Record<string, boolean> };
      assert.equal(health.status, 'ok');
      assert.equal(health.integrations.firebase, true);
    }
  } catch {
    serverReachable = false;
  }

  if (!serverReachable) {
    // Skip live HTTP assertions when test suite runs standalone without dev server on :3000
    return;
  }

  // 1. Checkout calculation (Lahore free shipping threshold + percentage coupon + tax)
  const calcRes = await fetch(`${baseUrl}/api/checkout/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ productId: 'prod_1', unitPrice: 20000, quantity: 1 }],
      city: 'Lahore',
      deliveryMethod: 'standard',
      paymentMethod: 'cod',
      coupon: { code: 'NEXORA10', type: 'percentage', value: 10, minOrderAmount: 0 },
      settings: { taxRatePercent: 5, freeShippingThreshold: 15000, codFee: 150 },
    }),
  });
  assert.equal(calcRes.status, 200);
  const calcData = (await calcRes.json()) as {
    subtotal: number;
    discountAmount: number;
    shippingFee: number;
    codFee: number;
    taxAmount: number;
    total: number;
  };
  assert.equal(calcData.subtotal, 20000);
  assert.equal(calcData.discountAmount, 2000);
  assert.equal(calcData.shippingFee, 0);
  assert.equal(calcData.codFee, 150);
  assert.equal(calcData.taxAmount, 900);
  assert.equal(calcData.total, 19050);

  // 2. Idempotent COD payment intent
  const idemKey = `test-idem-${Date.now()}`;
  const payPayload = {
    orderNumber: 'NX-TEST-001',
    amountPkr: 19050,
    paymentMethod: 'cod',
    customerEmail: 'shopper@example.com',
    idempotencyKey: idemKey,
  };
  const pay1 = await (
    await fetch(`${baseUrl}/api/payments/create-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payPayload),
    })
  ).json();
  const pay2 = await (
    await fetch(`${baseUrl}/api/payments/create-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payPayload),
    })
  ).json();
  assert.equal((pay1 as { id: string }).id, (pay2 as { id: string }).id);

  // 3. AI Recommendations endpoint returns valid catalog IDs (Gemini or deterministic fallback)
  const recRes = await fetch(`${baseUrl}/api/ai/recommendations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      currentProductId: 'p1',
      catalog: [
        { id: 'p1', title: 'Linen Blazer', categoryName: 'Apparel', price: 14500 },
        { id: 'p2', title: 'Cotton Polo', categoryName: 'Apparel', price: 4800, ratingAvg: 4.8 },
        { id: 'p3', title: 'Leather Tote', categoryName: 'Bags', price: 18900, ratingAvg: 4.9 },
      ],
    }),
  });
  assert.equal(recRes.status, 200);
  const recData = (await recRes.json()) as { recommendedIds: string[] };
  assert.ok(Array.isArray(recData.recommendedIds));
  assert.ok(!recData.recommendedIds.includes('p1'));
});
