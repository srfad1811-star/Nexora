import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Copy,
  Download,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { deleteDoc, doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';
import { useStore } from '../../context/StoreContext';
import { useAdmin } from '../../context/AdminContext';
import { exportToCsv, formatPrice, generateId, slugify } from '../../lib/utils';
import { ResilientImage } from '../../components/ResilientImage';
import type { Product, ProductVariant } from '../../types/ecommerce';

const EMPTY_PRODUCT: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> = {
  title: '',
  slug: '',
  sku: '',
  barcode: '',
  shortDescription: '',
  description: '',
  categoryId: '',
  categoryName: '',
  brandId: '',
  brandName: '',
  price: 0,
  salePrice: undefined,
  costPrice: 0,
  stock: 10,
  lowStockThreshold: 5,
  status: 'active',
  featured: false,
  trending: false,
  newArrival: true,
  images: ['/src/assets/images/product_linen_blazer_1795454579122.jpg'],
  variants: [],
  specifications: [],
  seoTitle: '',
  seoDescription: '',
};

export function AdminProducts() {
  const [searchParams] = useSearchParams();
  const { allProducts, categories, brands, settings, pushToast } = useStore();
  const { logActivity } = useAdmin();

  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc' | 'stock_asc'>('newest');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>(EMPTY_PRODUCT);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allProducts
      .filter((p) => {
        if (statusFilter !== 'all' && p.status !== statusFilter) return false;
        if (q) {
          const hay = `${p.title} ${p.sku} ${p.categoryName || ''} ${p.brandName || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price_asc') return a.price - b.price;
        if (sortBy === 'price_desc') return b.price - a.price;
        if (sortBy === 'stock_asc') return a.stock - b.stock;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });
  }, [allProducts, search, sortBy, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const toggleSelectAll = () => {
    if (selectedIds.length === paged.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paged.map((p) => p.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const openCreateModal = () => {
    setEditingId(null);
    setForm({
      ...EMPTY_PRODUCT,
      categoryId: categories[0]?.id || '',
      categoryName: categories[0]?.name || '',
      brandId: brands[0]?.id || '',
      brandName: brands[0]?.name || '',
    });
    setEditorOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingId(product.id);
    setForm({
      title: product.title,
      slug: product.slug,
      sku: product.sku,
      barcode: product.barcode || '',
      shortDescription: product.shortDescription || '',
      description: product.description || '',
      categoryId: product.categoryId,
      categoryName: product.categoryName || '',
      brandId: product.brandId,
      brandName: product.brandName || '',
      price: product.price,
      salePrice: product.salePrice,
      costPrice: product.costPrice || 0,
      stock: product.stock,
      lowStockThreshold: product.lowStockThreshold ?? 5,
      status: product.status,
      featured: Boolean(product.featured),
      trending: Boolean(product.trending),
      newArrival: Boolean(product.newArrival),
      images: product.images?.length ? product.images : [''],
      variants: product.variants || [],
      specifications: product.specifications || [],
      seoTitle: product.seoTitle || '',
      seoDescription: product.seoDescription || '',
    });
    setEditorOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.sku.trim()) {
      pushToast('Title and SKU are required', 'error');
      return;
    }
    setSaving(true);
    const now = new Date().toISOString();
    const id = editingId || generateId('prod');
    const existing = editingId ? allProducts.find((p) => p.id === editingId) : undefined;
    const cat = categories.find((c) => c.id === form.categoryId);
    const brand = brands.find((b) => b.id === form.brandId);

    const payload: Product = {
      id,
      title: form.title.trim(),
      slug: form.slug.trim() || slugify(form.title),
      sku: form.sku.trim(),
      barcode: form.barcode?.trim() || '',
      shortDescription: form.shortDescription?.trim() || '',
      description: form.description?.trim() || '',
      categoryId: cat?.id || form.categoryId || 'cat_general',
      categoryName: cat?.name || form.categoryName || 'General',
      brandId: brand?.id || form.brandId || 'brand_general',
      brandName: brand?.name || form.brandName || 'Nexora',
      price: Number(form.price) || 0,
      ...(form.salePrice && Number(form.salePrice) > 0 ? { salePrice: Number(form.salePrice) } : {}),
      costPrice: Number(form.costPrice) || 0,
      stock: Math.max(0, Math.round(Number(form.stock) || 0)),
      lowStockThreshold: Math.max(0, Math.round(Number(form.lowStockThreshold) || 5)),
      status: form.status,
      featured: Boolean(form.featured),
      trending: Boolean(form.trending),
      newArrival: Boolean(form.newArrival),
      images: (form.images || []).filter(Boolean),
      variants: form.variants || [],
      specifications: form.specifications || [],
      ratingAvg: existing?.ratingAvg ?? 0,
      ratingCount: existing?.ratingCount ?? 0,
      salesCount: existing?.salesCount ?? 0,
      seoTitle: form.seoTitle?.trim() || form.title.trim(),
      seoDescription: form.seoDescription?.trim() || form.shortDescription?.trim() || '',
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    try {
      await setDoc(doc(db, 'products', id), payload);
      await logActivity(editingId ? 'product.updated' : 'product.created', 'product', id, payload.title);
      pushToast(editingId ? 'Product updated' : 'Product created');
      setEditorOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `products/${id}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (product: Product) => {
    const id = generateId('prod');
    const now = new Date().toISOString();
    const clone: Product = {
      ...product,
      id,
      title: `${product.title} (Copy)`,
      slug: `${product.slug}-${Date.now().toString(36)}`,
      sku: `${product.sku}-CPY`,
      status: 'draft',
      salesCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await setDoc(doc(db, 'products', id), clone);
      await logActivity('product.duplicated', 'product', id, clone.title);
      pushToast('Product duplicated as Draft');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `products/${id}`);
    }
  };

  const handleDelete = async (product: Product) => {
    try {
      await deleteDoc(doc(db, 'products', product.id));
      await logActivity('product.deleted', 'product', product.id, product.title);
      setSelectedIds((prev) => prev.filter((x) => x !== product.id));
      pushToast('Product deleted', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `products/${product.id}`);
    }
  };

  const handleBulkStatus = async (status: Product['status']) => {
    if (selectedIds.length === 0) return;
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    selectedIds.forEach((id) => {
      batch.update(doc(db, 'products', id), { status, updatedAt: now });
    });
    try {
      await batch.commit();
      await logActivity('product.bulk_status', 'product', selectedIds.join(','), `Set status=${status}`);
      setSelectedIds([]);
      pushToast(`Updated ${selectedIds.length} products to ${status}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'products');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const batch = writeBatch(db);
    selectedIds.forEach((id) => {
      batch.delete(doc(db, 'products', id));
    });
    try {
      await batch.commit();
      await logActivity('product.bulk_delete', 'product', selectedIds.join(','), `Deleted ${selectedIds.length} items`);
      setSelectedIds([]);
      pushToast('Selected products deleted', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'products');
    }
  };

  const handleCsvExport = () => {
    exportToCsv(
      'nexora-products.csv',
      allProducts.map((p) => ({
        id: p.id,
        title: p.title,
        sku: p.sku,
        category: p.categoryName || '',
        brand: p.brandName || '',
        price: p.price,
        salePrice: p.salePrice || '',
        stock: p.stock,
        status: p.status,
      }))
    );
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      pushToast('CSV file requires a header row and at least one product', 'error');
      return;
    }
    const headers = lines[0].split(',').map((h) => h.replace(/"/g, '').trim().toLowerCase());
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    let count = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.replace(/^"|"$/g, '').trim());
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = cols[idx] || '';
      });
      if (!row.title) continue;
      const id = generateId('prod');
      const prod: Product = {
        id,
        title: row.title,
        slug: slugify(row.title) + '-' + i,
        sku: row.sku || `NX-IMP-${i}`,
        categoryId: categories[0]?.id || 'cat_apparel',
        categoryName: row.category || categories[0]?.name || 'General',
        brandId: brands[0]?.id || 'brand_atelier',
        brandName: row.brand || brands[0]?.name || 'Nexora',
        price: Number(row.price) || 5000,
        stock: Math.max(0, Math.round(Number(row.stock) || 10)),
        status: (row.status as Product['status']) || 'draft',
        images: ['/src/assets/images/product_linen_blazer_1795454579122.jpg'],
        createdAt: now,
        updatedAt: now,
      };
      batch.set(doc(db, 'products', id), prod);
      count += 1;
    }

    if (count > 0) {
      await batch.commit();
      await logActivity('product.csv_import', 'product', '', `Imported ${count} products`);
      pushToast(`Imported ${count} products from CSV`);
    }
    e.target.value = '';
  };

  const statusStyles: Record<Product['status'], string> = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    pending: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    draft: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
    scheduled: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800',
    archived: 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700',
  };

  const startIdx = filtered.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIdx = Math.min(filtered.length, page * pageSize);

  return (
    <div className="space-y-6">
      {/* Page Title & Action Row matching reference */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold tracking-tight">Products</h1>
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#14161D] hover:bg-zinc-50 cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>Import</span>
            <input type="file" accept=".csv" onChange={handleCsvImport} className="hidden" />
          </label>
          <button
            type="button"
            onClick={handleCsvExport}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#14161D] hover:bg-zinc-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-full bg-[#6D5BD0] text-white hover:bg-[#5B49BF]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Main White Table Card */}
      <div className="bg-white dark:bg-[#14161D] border border-zinc-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden">
        {/* Card Toolbar */}
        <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold">All Products</h2>
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 pl-3 border-l border-zinc-200 dark:border-zinc-700">
                <span className="text-xs text-zinc-500 tabular-nums">{selectedIds.length} selected</span>
                <button
                  type="button"
                  onClick={() => handleBulkStatus('active')}
                  className="px-2.5 py-1 text-[11px] font-medium rounded bg-emerald-50 text-emerald-700"
                >
                  Publish
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkStatus('draft')}
                  className="px-2.5 py-1 text-[11px] font-medium rounded bg-zinc-100 text-zinc-700"
                >
                  Draft
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  className="px-2.5 py-1 text-[11px] font-medium rounded bg-red-50 text-red-600"
                >
                  Delete
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search"
                className="pl-8 pr-3 py-1.5 text-xs rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 w-48 focus:outline-none focus:ring-2 focus:ring-[#6D5BD0]"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 text-xs rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-1.5 text-xs rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
            >
              <option value="newest">Sort by: Newest</option>
              <option value="price_asc">Price: Low-High</option>
              <option value="price_desc">Price: High-Low</option>
              <option value="stock_asc">Stock: Low-High</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 text-[11px] font-medium text-zinc-500">
                <th className="py-3.5 pl-5 pr-2 w-10">
                  <input
                    type="checkbox"
                    checked={paged.length > 0 && selectedIds.length === paged.length}
                    onChange={toggleSelectAll}
                    aria-label="Select all rows"
                    className="rounded accent-[#6D5BD0]"
                  />
                </th>
                <th className="py-3.5 px-3">Product</th>
                <th className="py-3.5 px-3">Category</th>
                <th className="py-3.5 px-3">Stock</th>
                <th className="py-3.5 px-3">Price</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 pr-5 pl-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500">
                    No products match your search criteria.
                  </td>
                </tr>
              ) : (
                paged.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40 transition-colors">
                    <td className="py-3 pl-5 pr-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(p.id)}
                        onChange={() => toggleSelect(p.id)}
                        aria-label={`Select ${p.title}`}
                        className="rounded accent-[#6D5BD0]"
                      />
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-3">
                        <ResilientImage
                          src={p.images?.[0]}
                          alt={p.title}
                          className="w-9 h-9 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-[240px]">
                            {p.title}
                          </p>
                          <p className="text-[11px] font-mono text-zinc-400">{p.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-zinc-600 dark:text-zinc-400">{p.categoryName || 'General'}</td>
                    <td className="py-3 px-3 font-mono tabular-nums">
                      <span className={p.stock <= (p.lowStockThreshold ?? 5) ? 'text-amber-600 font-semibold' : ''}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-medium tabular-nums">
                      {formatPrice(p.salePrice || p.price, settings.currencySymbol)}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-md border text-[11px] font-medium capitalize ${statusStyles[p.status]}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 pr-5 pl-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(p)}
                          aria-label={`Edit ${p.title}`}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicate(p)}
                          aria-label={`Duplicate ${p.title}`}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-[#6D5BD0] hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p)}
                          aria-label={`Delete ${p.title}`}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-5 py-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-500">
          <span className="tabular-nums">
            Showing {startIdx} to {endIdx} of {filtered.length} entries
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 disabled:opacity-40"
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                className={`w-7 h-7 rounded-lg font-medium tabular-nums ${
                  page === n
                    ? 'bg-[#6D5BD0] text-white'
                    : 'border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Product Create / Edit Modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <form
            onSubmit={handleSaveProduct}
            className="bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5"
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-lg font-bold">{editingId ? 'Edit Product' : 'Add New Product'}</h2>
              <button type="button" onClick={() => setEditorOpen(false)} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-medium text-zinc-500 mb-1">Product Title *</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value, slug: editingId ? form.slug : slugify(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                />
              </div>
              <div>
                <label className="block font-medium text-zinc-500 mb-1">URL Slug</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-zinc-500 mb-1">SKU *</label>
                <input
                  type="text"
                  required
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-zinc-500 mb-1">Barcode / UPC</label>
                <input
                  type="text"
                  value={form.barcode || ''}
                  onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-zinc-500 mb-1">Category</label>
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-zinc-500 mb-1">Brand</label>
                <select
                  value={form.brandId}
                  onChange={(e) => setForm({ ...form, brandId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                >
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-zinc-500 mb-1">Price ({settings.currencyCode}) *</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-zinc-500 mb-1">Sale Price (Optional)</label>
                <input
                  type="number"
                  min={0}
                  value={form.salePrice ?? ''}
                  onChange={(e) => setForm({ ...form, salePrice: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-zinc-500 mb-1">Stock Quantity</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-zinc-500 mb-1">Publishing Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as Product['status'] })}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                >
                  <option value="active">Active (Published)</option>
                  <option value="pending">Pending Review</option>
                  <option value="draft">Draft</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>

            <div className="text-xs space-y-3">
              <div>
                <label className="block font-medium text-zinc-500 mb-1">Primary Image Path / URL</label>
                <input
                  type="text"
                  value={form.images?.[0] || ''}
                  onChange={(e) => setForm({ ...form, images: [e.target.value, ...(form.images?.slice(1) || [])] })}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-zinc-500 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={form.description || ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                />
              </div>
              <div className="flex flex-wrap gap-4 pt-1">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(form.featured)}
                    onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                  />
                  <span>Featured on Homepage</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(form.trending)}
                    onChange={(e) => setForm({ ...form, trending: e.target.checked })}
                  />
                  <span>Trending</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(form.newArrival)}
                    onChange={(e) => setForm({ ...form, newArrival: e.target.checked })}
                  />
                  <span>New Arrival</span>
                </label>
              </div>

              {/* Variants quick add */}
              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Variants ({form.variants?.length || 0})</span>
                  <button
                    type="button"
                    onClick={() => {
                      const next: ProductVariant = {
                        id: generateId('var'),
                        name: 'Standard',
                        color: 'Default',
                        colorHex: '#18181B',
                        size: 'M',
                        sku: `${form.sku || 'SKU'}-V${(form.variants?.length || 0) + 1}`,
                        stock: 10,
                      };
                      setForm({ ...form, variants: [...(form.variants || []), next] });
                    }}
                    className="text-[#6D5BD0] hover:underline"
                  >
                    + Add Variant
                  </button>
                </div>
                {(form.variants || []).map((v, idx) => (
                  <div key={v.id} className="grid grid-cols-4 gap-2">
                    <input
                      type="text"
                      value={v.name}
                      onChange={(e) => {
                        const list = [...(form.variants || [])];
                        list[idx] = { ...v, name: e.target.value };
                        setForm({ ...form, variants: list });
                      }}
                      placeholder="Name (Sand / M)"
                      className="px-2 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                    />
                    <input
                      type="text"
                      value={v.sku}
                      onChange={(e) => {
                        const list = [...(form.variants || [])];
                        list[idx] = { ...v, sku: e.target.value };
                        setForm({ ...form, variants: list });
                      }}
                      placeholder="Variant SKU"
                      className="px-2 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
                    />
                    <input
                      type="number"
                      value={v.stock}
                      onChange={(e) => {
                        const list = [...(form.variants || [])];
                        list[idx] = { ...v, stock: Number(e.target.value) };
                        setForm({ ...form, variants: list });
                      }}
                      placeholder="Stock"
                      className="px-2 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const list = (form.variants || []).filter((_, i) => i !== idx);
                        setForm({ ...form, variants: list });
                      }}
                      className="text-red-600 hover:underline text-left"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="px-4 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 text-xs font-medium rounded-lg bg-[#6D5BD0] text-white hover:bg-[#5B49BF]"
              >
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Product'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
