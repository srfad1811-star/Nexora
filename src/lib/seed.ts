import { collection, doc, getDocs, limit, query, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firestore-errors';
import type {
  Brand,
  Category,
  Coupon,
  Product,
  StorefrontCmsData,
  StoreSettingsData,
  Supplier,
} from '../types/ecommerce';

const nowIso = () => new Date().toISOString();

export const DEFAULT_STOREFRONT_CMS: StorefrontCmsData = {
  announcementEnabled: true,
  announcementText: 'Complimentary Express Delivery across Pakistan on orders above Rs. 15,000 · Use NEXORA10 for 10% off',
  announcementLink: '/shop',
  heroEyebrow: 'Autumn / Winter Edit',
  heroTitle: 'Precision objects for everyday living.',
  heroSubtitle:
    'Thoughtfully engineered studio audio, Swiss-calibrated ceramic horology, and tailored natural-fiber wardrobe staples curated under one roof.',
  heroCtaLabel: 'Explore Collection',
  heroCtaLink: '/shop',
  heroImage: '/src/assets/images/hero_nexora_collection_1795454579224.jpg',
  promoTitle: 'Atelier Tailoring & Acoustic Engineering',
  promoDescription:
    'Every piece in the Nexora catalog undergoes material longevity testing and direct-to-door quality inspection across Lahore, Karachi, and Islamabad.',
  promoCtaLabel: 'Browse Featured Brands',
  promoCtaLink: '/shop?featured=true',
  aboutStory:
    'Nexora was founded to bridge architectural minimalism with dependable daily commerce. We partner directly with independent workshops, acoustic engineers, and heritage leather artisans to deliver transparent pricing in PKR with verified nationwide fulfillment.',
  testimonials: [
    {
      name: 'Zainab Tariq',
      role: 'Creative Director',
      city: 'Lahore',
      quote: 'The linen blazer arrived pressed in breathable garment packaging within 24 hours.',
      outcome: '3 repeat wardrobe orders across 4 months',
    },
    {
      name: 'Hamza Siddiqui',
      role: 'Mastering Engineer',
      city: 'Karachi',
      quote: 'Aether Reference headphones hold a dead-flat midrange curve that beats rigs twice the price.',
      outcome: 'Adopted across 2 studio rooms',
    },
    {
      name: 'Bilal Qureshi',
      role: 'Product Architect',
      city: 'Islamabad',
      quote: 'Transparent PKR pricing, real-time tracking, and effortless Cash on Delivery verification.',
      outcome: 'Zero delivery delays in 6 shipments',
    },
  ],
  faqs: [
    {
      question: 'How long does delivery take across Pakistan?',
      answer:
        'Orders placed before 4:00 PM PKT ship the same day. Major hubs (Lahore, Karachi, Islamabad, Rawalpindi) arrive within 1–2 business days; other cities arrive in 2–4 business days.',
    },
    {
      question: 'Which payment methods are supported?',
      answer:
        'We support Cash on Delivery (COD), direct Bank Transfer (IBAN), Stripe international cards, and JazzCash / Easypaisa mobile wallet adapters.',
    },
    {
      question: 'What is the Nexora return and exchange window?',
      answer:
        'Unused items in original packaging with tags intact are eligible for a full refund or size exchange within 14 days of delivery directly from your Account Portal.',
    },
    {
      question: 'How can I track my shipment?',
      answer:
        'Every dispatched order receives a courier tracking number visible in your Account Orders dashboard with step-by-step fulfillment updates.',
    },
  ],
  returnPolicyText:
    'All Nexora orders qualify for a 14-day hassle-free return or exchange window provided items remain unworn, unwashed, and complete with original packaging.',
  privacyPolicyText:
    'Nexora collects only the contact, shipping, and order telemetry required to fulfill deliveries and support requests. Payment credentials are never stored in plain text or browser storage.',
  termsText:
    'Orders are confirmed subject to real-time warehouse stock validation. Promotional coupons apply before shipping and tax calculation unless otherwise stated.',
};

export const DEFAULT_STORE_SETTINGS: StoreSettingsData = {
  storeName: 'Nexora',
  supportEmail: 'concierge@nexora.pk',
  supportPhone: '+92 42 3578 9012',
  currencyCode: 'PKR',
  currencySymbol: 'Rs.',
  taxRatePercent: 5,
  freeShippingThreshold: 15000,
  codFee: 150,
  codEnabled: true,
  bankTransferEnabled: true,
  bankDetails: 'Meezan Bank · IBAN PK42MEZN0002810104928172 · Title: Nexora Commerce Pvt Ltd',
  stripeEnabled: true,
  jazzcashEnabled: true,
  easypaisaEnabled: true,
  deliveryPartners: ['TCS Express', 'Leopards Courier', 'Trax Logistics', 'PostEx'],
  shippingZones: [
    {
      id: 'zone_lhr',
      zoneName: 'Lahore Metro',
      cities: ['Lahore'],
      standardFee: 200,
      expressFee: 450,
      estimatedDays: '1 business day',
    },
    {
      id: 'zone_khi_isb',
      zoneName: 'Karachi & Islamabad Twin Cities',
      cities: ['Karachi', 'Islamabad', 'Rawalpindi'],
      standardFee: 300,
      expressFee: 600,
      estimatedDays: '1–2 business days',
    },
    {
      id: 'zone_national',
      zoneName: 'Nationwide Pakistan',
      cities: ['Faisalabad', 'Multan', 'Peshawar', 'Quetta', 'Sialkot', 'Gujranwala', 'Hyderabad', 'Bahawalpur'],
      standardFee: 390,
      expressFee: 750,
      estimatedDays: '2–4 business days',
    },
  ],
};

export const SEED_CATEGORIES: Category[] = [
  {
    id: 'cat_apparel',
    name: 'Tailored Apparel',
    slug: 'tailored-apparel',
    description: 'Breathable Belgian linen tailoring and heavyweight organic cotton essentials.',
    image: '/src/assets/images/product_linen_blazer_1795454579122.jpg',
    sortOrder: 1,
    active: true,
    seoTitle: 'Tailored Apparel | Nexora',
    seoDescription: 'Minimalist blazers, knit polos, and structured outerwear.',
    createdAt: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'cat_footwear',
    name: 'Architectural Footwear',
    slug: 'architectural-footwear',
    description: 'Full-grain tumbled leather and calfskin suede low-top silhouettes.',
    image: '/src/assets/images/product_sneakers_ivory_1795454580502.jpg',
    sortOrder: 2,
    active: true,
    seoTitle: 'Footwear | Nexora',
    seoDescription: 'Minimalist leather sneakers crafted for all-day wear.',
    createdAt: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'cat_audio',
    name: 'Studio Audio',
    slug: 'studio-audio',
    description: 'Anodized aluminum wireless headphones and precision acoustic hardware.',
    image: '/src/assets/images/product_studio_headphones_1795454579470.jpg',
    sortOrder: 3,
    active: true,
    seoTitle: 'Studio Audio | Nexora',
    seoDescription: 'Reference wireless audio equipment.',
    createdAt: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'cat_watches',
    name: 'Watches & Horology',
    slug: 'watches-horology',
    description: 'Matte ceramic chronographs with anti-reflective sapphire crystals.',
    image: '/src/assets/images/product_ceramic_watch_1795454579246.jpg',
    sortOrder: 4,
    active: true,
    seoTitle: 'Watches & Horology | Nexora',
    seoDescription: 'Precision ceramic and brushed steel timepieces.',
    createdAt: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'cat_leather',
    name: 'Leather Goods',
    slug: 'leather-goods',
    description: 'Vegetable-tanned everyday totes, briefcases, and travel carry.',
    image: '/src/assets/images/product_leather_tote_1795454579410.jpg',
    sortOrder: 5,
    active: true,
    seoTitle: 'Leather Goods | Nexora',
    seoDescription: 'Handcrafted full-grain leather bags.',
    createdAt: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'cat_botanical',
    name: 'Botanical Care',
    slug: 'botanical-care',
    description: 'Cold-pressed apothecary serums and restorative skin formulations.',
    image: '/src/assets/images/product_amber_serum_1795454579157.jpg',
    sortOrder: 6,
    active: true,
    seoTitle: 'Botanical Skincare | Nexora',
    seoDescription: 'Apothecary formulations in UV-protective amber glass.',
    createdAt: '2026-10-01T08:00:00.000Z',
  },
];

export const SEED_BRANDS: Brand[] = [
  {
    id: 'brand_atelier',
    name: 'Atelier Nord',
    slug: 'atelier-nord',
    description: 'Nordic-inspired architectural tailoring in natural Belgian flax and combed cotton.',
    logo: '/src/assets/images/product_linen_blazer_1795454579122.jpg',
    featured: true,
    createdAt: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'brand_aether',
    name: 'Aether Acoustics',
    slug: 'aether-acoustics',
    description: 'Milled aluminum personal listening systems tuned for studio neutrality.',
    logo: '/src/assets/images/product_studio_headphones_1795454579470.jpg',
    featured: true,
    createdAt: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'brand_vesper',
    name: 'Vesper Horology',
    slug: 'vesper-horology',
    description: 'High-hardness ceramic chronographs engineered for daily resilience.',
    logo: '/src/assets/images/product_ceramic_watch_1795454579246.jpg',
    featured: true,
    createdAt: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'brand_maison',
    name: 'Maison Sol',
    slug: 'maison-sol',
    description: 'Small-batch full-grain leather carry and architectural footwear.',
    logo: '/src/assets/images/product_leather_tote_1795454579410.jpg',
    featured: true,
    createdAt: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'brand_botanica',
    name: 'Botanica Lab',
    slug: 'botanica-lab',
    description: 'Clinical plant-derived serums bottled in apothecary amber glass.',
    logo: '/src/assets/images/product_amber_serum_1795454579157.jpg',
    featured: false,
    createdAt: '2026-10-01T08:00:00.000Z',
  },
];

export const SEED_PRODUCTS: Product[] = [
  {
    id: 'prod_linen_blazer',
    title: 'Sand Linen Blend Unstructured Blazer',
    slug: 'sand-linen-blend-unstructured-blazer',
    sku: 'NX-APP-101',
    barcode: '8901234001015',
    shortDescription: 'Breathable Belgian flax-cotton blazer with soft natural shoulders and horn buttons.',
    description:
      'Cut in a relaxed architectural silhouette from 65% Belgian linen and 35% organic long-staple cotton. Half-lined in breathable Bemberg cupro for warm climates from Lahore to Karachi.',
    categoryId: 'cat_apparel',
    categoryName: 'Tailored Apparel',
    subcategory: 'Outerwear',
    brandId: 'brand_atelier',
    brandName: 'Atelier Nord',
    price: 24500,
    salePrice: 21500,
    costPrice: 12800,
    stock: 42,
    lowStockThreshold: 8,
    status: 'active',
    featured: true,
    trending: true,
    newArrival: true,
    images: ['/src/assets/images/product_linen_blazer_1795454579122.jpg'],
    variants: [
      { id: 'v_blz_s', name: 'Sand / S', color: 'Sand', colorHex: '#D5C7B2', size: 'S', sku: 'NX-APP-101-S', stock: 12 },
      { id: 'v_blz_m', name: 'Sand / M', color: 'Sand', colorHex: '#D5C7B2', size: 'M', sku: 'NX-APP-101-M', stock: 18 },
      { id: 'v_blz_l', name: 'Sand / L', color: 'Sand', colorHex: '#D5C7B2', size: 'L', sku: 'NX-APP-101-L', stock: 12 },
    ],
    specifications: [
      { label: 'Fabric', value: '65% Belgian Linen, 35% Organic Cotton' },
      { label: 'Weight', value: '240 GSM' },
      { label: 'Buttons', value: 'Natural Matte Horn' },
      { label: 'Care', value: 'Dry clean or gentle cold steam' },
    ],
    ratingAvg: 4.9,
    ratingCount: 38,
    salesCount: 142,
    seoTitle: 'Sand Linen Blend Unstructured Blazer | Nexora',
    seoDescription: 'Lightweight unstructured linen blazer crafted for effortless tailoring.',
    createdAt: '2026-10-05T09:00:00.000Z',
    updatedAt: '2026-11-18T12:00:00.000Z',
  },
  {
    id: 'prod_studio_headphones',
    title: 'Aether Reference ANC Wireless Headphones',
    slug: 'aether-reference-anc-wireless-headphones',
    sku: 'NX-AUD-204',
    barcode: '8901234002043',
    shortDescription: 'CNC-milled anodized aluminum wireless headphones with 45h battery and lossless USB-C DAC.',
    description:
      'Engineered with custom 40mm beryllium-coated dynamic drivers inside CNC-machined aluminum housings. Features hybrid adaptive noise cancellation, multipoint Bluetooth 5.4, and replaceable acoustic memory-foam earpads.',
    categoryId: 'cat_audio',
    categoryName: 'Studio Audio',
    subcategory: 'Over-Ear',
    brandId: 'brand_aether',
    brandName: 'Aether Acoustics',
    price: 48900,
    salePrice: 44500,
    costPrice: 26500,
    stock: 26,
    lowStockThreshold: 6,
    status: 'active',
    featured: true,
    trending: true,
    newArrival: true,
    images: ['/src/assets/images/product_studio_headphones_1795454579470.jpg'],
    variants: [
      { id: 'v_hp_silver', name: 'Brushed Silver / Standard', color: 'Brushed Silver', colorHex: '#C7C9CC', size: 'One Size', sku: 'NX-AUD-204-SLV', stock: 16 },
      { id: 'v_hp_slate', name: 'Anodized Slate / Standard', color: 'Anodized Slate', colorHex: '#43464B', size: 'One Size', sku: 'NX-AUD-204-SLT', stock: 10 },
    ],
    specifications: [
      { label: 'Drivers', value: '40mm Beryllium Dynamic' },
      { label: 'Battery Life', value: '45 Hours (ANC On)' },
      { label: 'Connectivity', value: 'Bluetooth 5.4 / USB-C Lossless / 3.5mm' },
      { label: 'Weight', value: '295g' },
    ],
    ratingAvg: 4.8,
    ratingCount: 64,
    salesCount: 215,
    seoTitle: 'Aether Reference ANC Wireless Headphones | Nexora',
    seoDescription: 'Precision milled wireless studio headphones with adaptive ANC.',
    createdAt: '2026-10-08T09:00:00.000Z',
    updatedAt: '2026-11-19T12:00:00.000Z',
  },
  {
    id: 'prod_ceramic_watch',
    title: 'Vesper Matte Ceramic Chronograph 40mm',
    slug: 'vesper-matte-ceramic-chronograph-40mm',
    sku: 'NX-WAT-308',
    barcode: '8901234003088',
    shortDescription: 'Scratch-proof matte black zirconium ceramic case with domed sapphire crystal and 100m WR.',
    description:
      'Constructed from high-density sintered ceramic for near-diamond scratch resistance and featherlight wrist comfort. Powered by a Swiss Ronda 5030.D chronograph movement with Super-LumiNova indices.',
    categoryId: 'cat_watches',
    categoryName: 'Watches & Horology',
    subcategory: 'Chronographs',
    brandId: 'brand_vesper',
    brandName: 'Vesper Horology',
    price: 62000,
    costPrice: 34000,
    stock: 15,
    lowStockThreshold: 5,
    status: 'active',
    featured: true,
    trending: true,
    newArrival: false,
    images: ['/src/assets/images/product_ceramic_watch_1795454579246.jpg'],
    variants: [
      { id: 'v_wat_blk', name: 'Matte Obsidian / 40mm', color: 'Matte Obsidian', colorHex: '#18181B', size: '40mm', sku: 'NX-WAT-308-BLK', stock: 15 },
    ],
    specifications: [
      { label: 'Case Material', value: 'Matte Zirconium Oxide Ceramic' },
      { label: 'Crystal', value: 'AR-Coated Sapphire' },
      { label: 'Movement', value: 'Swiss Quartz Chronograph' },
      { label: 'Water Resistance', value: '10 ATM / 100 Meters' },
    ],
    ratingAvg: 4.9,
    ratingCount: 29,
    salesCount: 89,
    seoTitle: 'Vesper Matte Ceramic Chronograph | Nexora',
    seoDescription: 'Minimalist matte ceramic chronograph wristwatch.',
    createdAt: '2026-10-10T09:00:00.000Z',
    updatedAt: '2026-11-18T12:00:00.000Z',
  },
  {
    id: 'prod_leather_tote',
    title: 'Maison Sol Cognac Architect Tote',
    slug: 'maison-sol-cognac-architect-tote',
    sku: 'NX-LTH-412',
    barcode: '8901234004122',
    shortDescription: 'Full-grain vegetable-tanned cognac leather work tote with padded 16-inch laptop sleeve.',
    description:
      'Hand-stitched from full-grain Italian calfskin that develops a deep amber patina over time. Features solid brushed-brass D-rings, magnetic top closure, and suede-lined compartments.',
    categoryId: 'cat_leather',
    categoryName: 'Leather Goods',
    subcategory: 'Tote Bags',
    brandId: 'brand_maison',
    brandName: 'Maison Sol',
    price: 34000,
    salePrice: 29900,
    costPrice: 17500,
    stock: 19,
    lowStockThreshold: 5,
    status: 'active',
    featured: true,
    trending: false,
    newArrival: true,
    images: ['/src/assets/images/product_leather_tote_1795454579410.jpg'],
    variants: [
      { id: 'v_tote_cog', name: 'Cognac Tan / 16"', color: 'Cognac Tan', colorHex: '#9C5A2C', size: '16"', sku: 'NX-LTH-412-COG', stock: 12 },
      { id: 'v_tote_esp', name: 'Espresso / 16"', color: 'Espresso', colorHex: '#3B281E', size: '16"', sku: 'NX-LTH-412-ESP', stock: 7 },
    ],
    specifications: [
      { label: 'Leather', value: 'Full-Grain Vegetable-Tanned Calfskin' },
      { label: 'Hardware', value: 'Solid Brushed Brass' },
      { label: 'Laptop Fit', value: 'Up to 16-inch MacBook Pro' },
      { label: 'Dimensions', value: '41 × 31 × 14 cm' },
    ],
    ratingAvg: 4.8,
    ratingCount: 47,
    salesCount: 168,
    createdAt: '2026-10-12T09:00:00.000Z',
    updatedAt: '2026-11-18T12:00:00.000Z',
  },
  {
    id: 'prod_sneakers_ivory',
    title: 'Maison Sol Ivory Suede Low-Top Sneakers',
    slug: 'maison-sol-ivory-suede-low-top-sneakers',
    sku: 'NX-FTW-505',
    barcode: '8901234005051',
    shortDescription: 'Tumbled calfskin and sand suede court sneakers with Margom stitched cupsole.',
    description:
      'Clean architectural court profile pairing supple ivory pebbled leather with water-repellent suede overlays, calfskin lining, and a sidewall-stitched natural rubber cupsole.',
    categoryId: 'cat_footwear',
    categoryName: 'Architectural Footwear',
    subcategory: 'Sneakers',
    brandId: 'brand_maison',
    brandName: 'Maison Sol',
    price: 22000,
    costPrice: 11200,
    stock: 34,
    lowStockThreshold: 8,
    status: 'active',
    featured: true,
    trending: true,
    newArrival: false,
    images: ['/src/assets/images/product_sneakers_ivory_1795454580502.jpg'],
    variants: [
      { id: 'v_snk_41', name: 'Ivory Suede / EU 41', color: 'Ivory', colorHex: '#F3EFE6', size: 'EU 41', sku: 'NX-FTW-505-41', stock: 10 },
      { id: 'v_snk_42', name: 'Ivory Suede / EU 42', color: 'Ivory', colorHex: '#F3EFE6', size: 'EU 42', sku: 'NX-FTW-505-42', stock: 14 },
      { id: 'v_snk_43', name: 'Ivory Suede / EU 43', color: 'Ivory', colorHex: '#F3EFE6', size: 'EU 43', sku: 'NX-FTW-505-43', stock: 10 },
    ],
    specifications: [
      { label: 'Upper', value: 'Tumbled Calfskin & Split Suede' },
      { label: 'Outsole', value: 'Sidewall-Stitched Natural Rubber' },
      { label: 'Footbed', value: 'Removable OrthoLite Leather' },
    ],
    ratingAvg: 4.7,
    ratingCount: 52,
    salesCount: 194,
    createdAt: '2026-10-14T09:00:00.000Z',
    updatedAt: '2026-11-18T12:00:00.000Z',
  },
  {
    id: 'prod_cotton_polo',
    title: 'Atelier Organic Charcoal Knit Polo',
    slug: 'atelier-organic-charcoal-knit-polo',
    sku: 'NX-APP-119',
    barcode: '8901234001190',
    shortDescription: '310 GSM organic combed-cotton pique knit polo with mother-of-pearl placket.',
    description:
      'Woven from GOTS-certified organic combed cotton in a structured open-pique stitch that holds crisp collar shape from studio mornings to evening dinners.',
    categoryId: 'cat_apparel',
    categoryName: 'Tailored Apparel',
    subcategory: 'Knitwear',
    brandId: 'brand_atelier',
    brandName: 'Atelier Nord',
    price: 9800,
    salePrice: 8400,
    costPrice: 4400,
    stock: 64,
    lowStockThreshold: 12,
    status: 'active',
    featured: false,
    trending: true,
    newArrival: true,
    images: ['/src/assets/images/product_cotton_polo_1795454578802.jpg'],
    variants: [
      { id: 'v_pol_s', name: 'Charcoal / S', color: 'Charcoal', colorHex: '#33363B', size: 'S', sku: 'NX-APP-119-S', stock: 18 },
      { id: 'v_pol_m', name: 'Charcoal / M', color: 'Charcoal', colorHex: '#33363B', size: 'M', sku: 'NX-APP-119-M', stock: 26 },
      { id: 'v_pol_l', name: 'Charcoal / L', color: 'Charcoal', colorHex: '#33363B', size: 'L', sku: 'NX-APP-119-L', stock: 20 },
    ],
    specifications: [
      { label: 'Material', value: '100% Organic Combed Cotton' },
      { label: 'Fabric Weight', value: '310 GSM Heavy Pique' },
      { label: 'Buttons', value: 'Smoked Mother-of-Pearl' },
    ],
    ratingAvg: 4.8,
    ratingCount: 73,
    salesCount: 310,
    createdAt: '2026-10-16T09:00:00.000Z',
    updatedAt: '2026-11-18T12:00:00.000Z',
  },
  {
    id: 'prod_amber_serum',
    title: 'Botanica Lab Barrier Restore Serum No. 01',
    slug: 'botanica-lab-barrier-restore-serum-01',
    sku: 'NX-BOT-601',
    barcode: '8901234006010',
    shortDescription: 'Cold-pressed sea buckthorn, squalane, and niacinamide restorative facial serum (30ml).',
    description:
      'Formulated without synthetic fragrance or essential oil irritants. Delivers concentrated omega-7 fatty acids and 5% clinical niacinamide in UV-shielded amber apothecary glass.',
    categoryId: 'cat_botanical',
    categoryName: 'Botanical Care',
    subcategory: 'Serums',
    brandId: 'brand_botanica',
    brandName: 'Botanica Lab',
    price: 6800,
    costPrice: 2700,
    stock: 4,
    lowStockThreshold: 10,
    status: 'active',
    featured: true,
    trending: false,
    newArrival: true,
    images: ['/src/assets/images/product_amber_serum_1795454579157.jpg'],
    variants: [
      { id: 'v_ser_30', name: '30ml Amber Glass', color: 'Amber', colorHex: '#92400E', size: '30ml', sku: 'NX-BOT-601-30', stock: 4 },
    ],
    specifications: [
      { label: 'Volume', value: '30 ml / 1.0 fl oz' },
      { label: 'Key Actives', value: '5% Niacinamide, Plant Squalane, Sea Buckthorn' },
      { label: 'Formulation', value: 'Vegan, Fragrance-Free, Dermatologist Tested' },
    ],
    ratingAvg: 4.9,
    ratingCount: 41,
    salesCount: 156,
    createdAt: '2026-10-18T09:00:00.000Z',
    updatedAt: '2026-11-18T12:00:00.000Z',
  },
  {
    id: 'prod_linen_overshirt',
    title: 'Atelier Stone Architectural Overshirt',
    slug: 'atelier-stone-architectural-overshirt',
    sku: 'NX-APP-125',
    barcode: '8901234001251',
    shortDescription: 'Structured twill overshirt crafted for layering over heavyweight knitwear.',
    description:
      'A crisp mid-weight cotton-linen twill overshirt featuring concealed chest utility pockets and clean felled seams. Currently staged for upcoming seasonal release.',
    categoryId: 'cat_apparel',
    categoryName: 'Tailored Apparel',
    subcategory: 'Shirts',
    brandId: 'brand_atelier',
    brandName: 'Atelier Nord',
    price: 14200,
    costPrice: 7100,
    stock: 22,
    lowStockThreshold: 6,
    status: 'draft',
    featured: false,
    trending: false,
    newArrival: true,
    images: ['/src/assets/images/product_linen_blazer_1795454579122.jpg'],
    variants: [
      { id: 'v_ov_m', name: 'Stone / M', color: 'Stone', colorHex: '#D6D3CD', size: 'M', sku: 'NX-APP-125-M', stock: 12 },
      { id: 'v_ov_l', name: 'Stone / L', color: 'Stone', colorHex: '#D6D3CD', size: 'L', sku: 'NX-APP-125-L', stock: 10 },
    ],
    specifications: [
      { label: 'Fabric', value: '70% Organic Cotton, 30% Linen Twill' },
      { label: 'Origin', value: 'Small-batch Studio Production' },
    ],
    ratingAvg: 0,
    ratingCount: 0,
    salesCount: 0,
    createdAt: '2026-11-01T09:00:00.000Z',
    updatedAt: '2026-11-19T12:00:00.000Z',
  },
];

export const SEED_COUPONS: Coupon[] = [
  {
    id: 'coup_nexora10',
    code: 'NEXORA10',
    type: 'percentage',
    value: 10,
    minOrderAmount: 5000,
    usageLimit: 500,
    usedCount: 28,
    expiresAt: '2027-12-31',
    active: true,
    description: '10% off orders above Rs. 5,000',
    createdAt: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'coup_welcome500',
    code: 'WELCOME500',
    type: 'fixed',
    value: 500,
    minOrderAmount: 3000,
    usageLimit: 1000,
    usedCount: 64,
    expiresAt: '2027-12-31',
    active: true,
    description: 'Flat Rs. 500 off your first order',
    createdAt: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'coup_freeship',
    code: 'FREESHIP',
    type: 'free_shipping',
    value: 0,
    minOrderAmount: 2000,
    usageLimit: 500,
    usedCount: 15,
    expiresAt: '2027-12-31',
    active: true,
    description: 'Complimentary standard shipping nationwide',
    createdAt: '2026-10-01T08:00:00.000Z',
  },
];

export const SEED_SUPPLIERS: Supplier[] = [
  {
    id: 'sup_nord_textiles',
    name: 'Nordic Looms & Tailoring Co.',
    contactName: 'Tariq Mahmood',
    email: 'orders@nordiclooms.pk',
    phone: '+92 42 3581 2201',
    leadTimeDays: 10,
    createdAt: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'sup_aether_tech',
    name: 'Shenzhen Aether Acoustic Works',
    contactName: 'Lin Wei',
    email: 'supply@aether-acoustics.com',
    phone: '+86 755 8821 4409',
    leadTimeDays: 18,
    createdAt: '2026-10-01T08:00:00.000Z',
  },
];

export async function seedStorefrontIfEmpty(force = false): Promise<boolean> {
  try {
    if (!force) {
      const existingCheck = await getDocs(query(collection(db, 'products'), limit(1)));
      if (!existingCheck.empty) {
        return false;
      }
    }

    const batch = writeBatch(db);
    const ts = nowIso();

    for (const cat of SEED_CATEGORIES) {
      batch.set(doc(db, 'categories', cat.id), cat);
    }
    for (const brand of SEED_BRANDS) {
      batch.set(doc(db, 'brands', brand.id), brand);
    }
    for (const prod of SEED_PRODUCTS) {
      batch.set(doc(db, 'products', prod.id), prod);
    }
    for (const coup of SEED_COUPONS) {
      batch.set(doc(db, 'coupons', coup.id), coup);
    }
    for (const sup of SEED_SUPPLIERS) {
      batch.set(doc(db, 'suppliers', sup.id), sup);
    }

    batch.set(doc(db, 'cmsConfig', 'storefront'), {
      id: 'storefront',
      data: DEFAULT_STOREFRONT_CMS,
      updatedAt: ts,
    });

    batch.set(doc(db, 'cmsConfig', 'settings'), {
      id: 'settings',
      data: DEFAULT_STORE_SETTINGS,
      updatedAt: ts,
    });

    await batch.commit();
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'seed');
  }
}
