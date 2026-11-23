import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { DEFAULT_STOREFRONT_CMS, DEFAULT_STORE_SETTINGS } from '../lib/seed';
import { useAuth } from './AuthContext';
import type {
  Brand,
  CartItem,
  Category,
  Coupon,
  Product,
  StorefrontCmsData,
  StoreSettingsData,
} from '../types/ecommerce';

const LOCAL_CART_KEY = 'nexora_guest_cart_v1';
const LOCAL_RECENT_KEY = 'nexora_recently_viewed_v1';
const LOCAL_THEME_KEY = 'nexora_theme_v1';

export interface ToastMessage {
  id: string;
  title: string;
  type: 'success' | 'error' | 'info';
}

interface StoreContextValue {
  products: Product[];
  allProducts: Product[];
  categories: Category[];
  brands: Brand[];
  coupons: Coupon[];
  cms: StorefrontCmsData;
  settings: StoreSettingsData;
  catalogLoading: boolean;
  cart: CartItem[];
  cartCouponCode: string;
  wishlistIds: string[];
  compareIds: string[];
  recentlyViewedIds: string[];
  cartDrawerOpen: boolean;
  setCartDrawerOpen: (open: boolean) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  addToCart: (item: CartItem) => void;
  updateCartQty: (productId: string, variantId: string | undefined, qty: number) => void;
  removeFromCart: (productId: string, variantId?: string) => void;
  clearCart: () => Promise<void>;
  setCartCouponCode: (code: string) => void;
  toggleWishlist: (productId: string) => Promise<void>;
  toggleCompare: (productId: string) => void;
  recordRecentlyViewed: (productId: string) => void;
  toasts: ToastMessage[];
  pushToast: (title: string, type?: 'success' | 'error' | 'info') => void;
  dismissToast: (id: string) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { user, authReady, isBootstrappedAdmin } = useAuth();

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [cms, setCms] = useState<StorefrontCmsData>(DEFAULT_STOREFRONT_CMS);
  const [settings, setSettings] = useState<StoreSettingsData>(DEFAULT_STORE_SETTINGS);
  const [catalogLoading, setCatalogLoading] = useState(true);

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_CART_KEY);
      return raw ? (JSON.parse(raw) as CartItem[]) : [];
    } catch {
      return [];
    }
  });
  const [cartCouponCode, setCartCouponCodeState] = useState('');
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_RECENT_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(LOCAL_THEME_KEY) === 'dark';
    } catch {
      return false;
    }
  });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const pushToast = useCallback((title: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, title, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      localStorage.setItem(LOCAL_THEME_KEY, darkMode ? 'dark' : 'light');
    } catch {
      // ignore
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode((prev) => !prev);

  // Public & Admin Catalog Listeners
  useEffect(() => {
    if (!authReady) return;

    const prodQuery = isBootstrappedAdmin
      ? query(collection(db, 'products'))
      : query(collection(db, 'products'), where('status', '==', 'active'));

    const unsubProducts = onSnapshot(
      prodQuery,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Product);
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setAllProducts(list);
        setCatalogLoading(false);
      },
      (err) => {
        setCatalogLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'products');
      }
    );

    const unsubCategories = onSnapshot(
      query(collection(db, 'categories'), orderBy('sortOrder', 'asc')),
      (snap) => {
        setCategories(snap.docs.map((d) => d.data() as Category));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'categories')
    );

    const unsubBrands = onSnapshot(
      collection(db, 'brands'),
      (snap) => {
        setBrands(snap.docs.map((d) => d.data() as Brand));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'brands')
    );

    const unsubCmsStorefront = onSnapshot(
      doc(db, 'cmsConfig', 'storefront'),
      (snap) => {
        if (snap.exists()) {
          const payload = snap.data() as { data?: StorefrontCmsData };
          if (payload.data) setCms({ ...DEFAULT_STOREFRONT_CMS, ...payload.data });
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'cmsConfig/storefront')
    );

    const unsubCmsSettings = onSnapshot(
      doc(db, 'cmsConfig', 'settings'),
      (snap) => {
        if (snap.exists()) {
          const payload = snap.data() as { data?: StoreSettingsData };
          if (payload.data) setSettings({ ...DEFAULT_STORE_SETTINGS, ...payload.data });
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'cmsConfig/settings')
    );

    return () => {
      unsubProducts();
      unsubCategories();
      unsubBrands();
      unsubCmsStorefront();
      unsubCmsSettings();
    };
  }, [authReady, isBootstrappedAdmin]);

  // Coupons listener (when signed in)
  useEffect(() => {
    if (!authReady || !user) {
      setCoupons([]);
      return;
    }
    const coupQuery = isBootstrappedAdmin
      ? query(collection(db, 'coupons'))
      : query(collection(db, 'coupons'), where('active', '==', true));

    const unsub = onSnapshot(
      coupQuery,
      (snap) => setCoupons(snap.docs.map((d) => d.data() as Coupon)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'coupons')
    );
    return () => unsub();
  }, [authReady, user, isBootstrappedAdmin]);

  // Persistent Cart & Wishlist sync for signed-in user
  useEffect(() => {
    if (!authReady || !user) {
      setWishlistIds([]);
      return;
    }

    const cartRef = doc(db, 'carts', user.uid);
    const unsubCart = onSnapshot(
      cartRef,
      async (snap) => {
        if (snap.exists()) {
          const data = snap.data() as { items?: CartItem[]; couponCode?: string };
          const remoteItems = data.items || [];
          // Merge any guest items left in localStorage once on login
          let guestItems: CartItem[] = [];
          try {
            const raw = localStorage.getItem(LOCAL_CART_KEY);
            guestItems = raw ? (JSON.parse(raw) as CartItem[]) : [];
          } catch {
            guestItems = [];
          }
          if (guestItems.length > 0) {
            const merged = [...remoteItems];
            for (const g of guestItems) {
              const idx = merged.findIndex(
                (m) => m.productId === g.productId && m.variantId === g.variantId
              );
              if (idx >= 0) {
                merged[idx] = { ...merged[idx], quantity: Math.min(merged[idx].maxStock, merged[idx].quantity + g.quantity) };
              } else {
                merged.push(g);
              }
            }
            localStorage.removeItem(LOCAL_CART_KEY);
            setCart(merged);
            await setDoc(cartRef, {
              uid: user.uid,
              items: merged,
              couponCode: data.couponCode || '',
              updatedAt: new Date().toISOString(),
            });
          } else {
            setCart(remoteItems);
            setCartCouponCodeState(data.couponCode || '');
          }
        } else {
          // Initialize Firestore cart from guest localStorage if present
          let guestItems: CartItem[] = [];
          try {
            const raw = localStorage.getItem(LOCAL_CART_KEY);
            guestItems = raw ? (JSON.parse(raw) as CartItem[]) : [];
          } catch {
            guestItems = [];
          }
          if (guestItems.length > 0) {
            localStorage.removeItem(LOCAL_CART_KEY);
          }
          await setDoc(cartRef, {
            uid: user.uid,
            items: guestItems,
            couponCode: '',
            updatedAt: new Date().toISOString(),
          });
          setCart(guestItems);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `carts/${user.uid}`)
    );

    const wishRef = doc(db, 'wishlists', user.uid);
    const unsubWish = onSnapshot(
      wishRef,
      (snap) => {
        if (snap.exists()) {
          setWishlistIds((snap.data() as { productIds?: string[] }).productIds || []);
        } else {
          setWishlistIds([]);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `wishlists/${user.uid}`)
    );

    return () => {
      unsubCart();
      unsubWish();
    };
  }, [authReady, user]);

  const persistCart = useCallback(
    async (nextItems: CartItem[], nextCoupon = cartCouponCode) => {
      setCart(nextItems);
      if (user) {
        try {
          await setDoc(doc(db, 'carts', user.uid), {
            uid: user.uid,
            items: nextItems,
            couponCode: nextCoupon,
            updatedAt: new Date().toISOString(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `carts/${user.uid}`);
        }
      } else {
        try {
          localStorage.setItem(LOCAL_CART_KEY, JSON.stringify(nextItems));
        } catch {
          // ignore
        }
      }
    },
    [user, cartCouponCode]
  );

  const addToCart = useCallback(
    (item: CartItem) => {
      const idx = cart.findIndex(
        (c) => c.productId === item.productId && c.variantId === item.variantId
      );
      let next: CartItem[];
      if (idx >= 0) {
        next = cart.map((c, i) =>
          i === idx
            ? { ...c, quantity: Math.min(item.maxStock || 99, c.quantity + item.quantity) }
            : c
        );
      } else {
        next = [...cart, item];
      }
      persistCart(next);
      pushToast(`Added ${item.title} to bag`);
      setCartDrawerOpen(true);
    },
    [cart, persistCart, pushToast]
  );

  const updateCartQty = useCallback(
    (productId: string, variantId: string | undefined, qty: number) => {
      if (qty <= 0) {
        const next = cart.filter(
          (c) => !(c.productId === productId && c.variantId === variantId)
        );
        persistCart(next);
        return;
      }
      const next = cart.map((c) =>
        c.productId === productId && c.variantId === variantId
          ? { ...c, quantity: Math.min(c.maxStock || 99, qty) }
          : c
      );
      persistCart(next);
    },
    [cart, persistCart]
  );

  const removeFromCart = useCallback(
    (productId: string, variantId?: string) => {
      const next = cart.filter(
        (c) => !(c.productId === productId && c.variantId === variantId)
      );
      persistCart(next);
      pushToast('Removed item from bag', 'info');
    },
    [cart, persistCart, pushToast]
  );

  const clearCart = useCallback(async () => {
    setCartCouponCodeState('');
    await persistCart([], '');
  }, [persistCart]);

  const setCartCouponCode = useCallback(
    (code: string) => {
      setCartCouponCodeState(code);
      persistCart(cart, code);
    },
    [cart, persistCart]
  );

  const toggleWishlist = useCallback(
    async (productId: string) => {
      if (!user) {
        pushToast('Sign in to save items to your wishlist', 'info');
        return;
      }
      const exists = wishlistIds.includes(productId);
      const next = exists
        ? wishlistIds.filter((id) => id !== productId)
        : [...wishlistIds, productId];
      setWishlistIds(next);
      try {
        await setDoc(doc(db, 'wishlists', user.uid), {
          uid: user.uid,
          productIds: next,
          updatedAt: new Date().toISOString(),
        });
        pushToast(exists ? 'Removed from wishlist' : 'Saved to wishlist', exists ? 'info' : 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `wishlists/${user.uid}`);
      }
    },
    [user, wishlistIds, pushToast]
  );

  const toggleCompare = useCallback(
    (productId: string) => {
      setCompareIds((prev) => {
        if (prev.includes(productId)) {
          return prev.filter((id) => id !== productId);
        }
        if (prev.length >= 3) {
          pushToast('You can compare up to 3 products at once', 'info');
          return prev;
        }
        pushToast('Added to product comparison', 'info');
        return [...prev, productId];
      });
    },
    [pushToast]
  );

  const recordRecentlyViewed = useCallback((productId: string) => {
    setRecentlyViewedIds((prev) => {
      const next = [productId, ...prev.filter((id) => id !== productId)].slice(0, 8);
      try {
        localStorage.setItem(LOCAL_RECENT_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const products = allProducts.filter((p) => p.status === 'active');

  return (
    <StoreContext.Provider
      value={{
        products,
        allProducts,
        categories,
        brands,
        coupons,
        cms,
        settings,
        catalogLoading,
        cart,
        cartCouponCode,
        wishlistIds,
        compareIds,
        recentlyViewedIds,
        cartDrawerOpen,
        setCartDrawerOpen,
        darkMode,
        toggleDarkMode,
        addToCart,
        updateCartQty,
        removeFromCart,
        clearCart,
        setCartCouponCode,
        toggleWishlist,
        toggleCompare,
        recordRecentlyViewed,
        toasts,
        pushToast,
        dismissToast,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
