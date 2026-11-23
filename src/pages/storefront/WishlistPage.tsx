import React from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { ProductCard } from '../../components/ProductCard';

export function WishlistPage() {
  const { user, signInWithGoogle } = useAuth();
  const { products, wishlistIds } = useStore();
  const saved = products.filter((p) => wishlistIds.includes(p.id));

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <Heart className="w-10 h-10 mx-auto text-zinc-300 dark:text-zinc-700" />
        <h1 className="font-display text-2xl font-bold">Sign in to view your Wishlist</h1>
        <p className="text-sm text-zinc-500">Your saved products sync across all devices once signed in.</p>
        <button
          type="button"
          onClick={signInWithGoogle}
          className="px-6 py-2.5 rounded-lg bg-[#6D5BD0] text-white text-sm font-medium"
        >
          Sign In with Google
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Saved Wishlist</h1>
        <p className="text-sm text-zinc-500 mt-1">{saved.length} saved items</p>
      </div>

      {saved.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#14161D] space-y-3">
          <p className="text-base font-semibold">No saved items yet</p>
          <p className="text-sm text-zinc-500">Tap the heart icon on any product to save it for later.</p>
          <Link to="/shop" className="inline-block px-5 py-2.5 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-xs font-medium">
            Explore Catalog
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {saved.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
