import React, { useState } from 'react';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { deleteDoc, doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { useAdmin } from '../../context/AdminContext';
import { formatPrice, generateId, slugify } from '../../lib/utils';
import type { Brand, Category, Product, PurchaseOrder, Supplier } from '../../types/ecommerce';

export function AdminCategoriesPage() {
  const { categories, pushToast } = useStore();
  const { logActivity } = useAdmin();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('/src/assets/images/product_linen_blazer_1795454579122.jpg');
  const [sortOrder, setSortOrder] = useState(categories.length + 1);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const id = editingId || generateId('cat');
    const now = new Date().toISOString();
    const existing = editingId ? categories.find((c) => c.id === editingId) : undefined;
    const payload: Category = {
      id,
      name: name.trim(),
      slug: slugify(name),
      description: description.trim(),
      image: image.trim(),
      sortOrder: Number(sortOrder) || 1,
      active: true,
      createdAt: existing?.createdAt || now,
    };
    try {
      await setDoc(doc(db, 'categories', id), payload);
      await logActivity(editingId ? 'category.updated' : 'category.created', 'category', id, payload.name);
      setName('');
      setDescription('');
      setEditingId(null);
      pushToast(editingId ? 'Category updated' : 'Category created');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `categories/${id}`);
    }
  };

  const handleDelete = async (cat: Category) => {
    try {
      await deleteDoc(doc(db, 'categories', cat.id));
      await logActivity('category.deleted', 'category', cat.id, cat.name);
      pushToast('Category deleted', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `categories/${cat.id}`);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Categories</h1>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form onSubmit={handleSave} className="lg:col-span-4 p-6 rounded-2xl bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 space-y-4 self-start">
          <h2 className="text-sm font-semibold">{editingId ? 'Edit Category' : 'Add Category'}</h2>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category Name"
            className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
          />
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
          />
          <input
            type="text"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="Image path"
            className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
          />
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            placeholder="Sort Order"
            className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
          />
          <div className="flex gap-2">
            <button type="submit" className="flex-1 py-2 rounded-lg bg-[#6D5BD0] text-white text-xs font-medium">
              {editingId ? 'Update Category' : 'Create Category'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setName('');
                  setDescription('');
                }}
                className="px-3 py-2 rounded-lg border border-zinc-300 text-xs"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="lg:col-span-8 bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-500">
                <th className="py-3 px-4">Order</th>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Slug</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {categories.map((cat) => (
                <tr key={cat.id}>
                  <td className="py-3 px-4 font-mono tabular-nums">{cat.sortOrder}</td>
                  <td className="py-3 px-4 font-medium">{cat.name}</td>
                  <td className="py-3 px-4 font-mono text-zinc-500">{cat.slug}</td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(cat.id);
                        setName(cat.name);
                        setDescription(cat.description || '');
                        setImage(cat.image || '');
                        setSortOrder(cat.sortOrder);
                      }}
                      className="p-1 text-zinc-500 hover:text-zinc-900"
                    >
                      <Pencil className="w-3.5 h-3.5 inline" />
                    </button>
                    <button type="button" onClick={() => handleDelete(cat)} className="p-1 text-zinc-500 hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function AdminBrandsPage() {
  const { brands, pushToast } = useStore();
  const { logActivity } = useAdmin();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [featured, setFeatured] = useState(true);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const id = generateId('brand');
    const payload: Brand = {
      id,
      name: name.trim(),
      slug: slugify(name),
      description: description.trim(),
      featured,
      createdAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'brands', id), payload);
      await logActivity('brand.created', 'brand', id, payload.name);
      setName('');
      setDescription('');
      pushToast('Brand created');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `brands/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Brands</h1>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form onSubmit={handleSave} className="lg:col-span-4 p-6 rounded-2xl bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 space-y-4 self-start">
          <h2 className="text-sm font-semibold">Add Brand</h2>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Brand Name"
            className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
          />
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brand Description"
            className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
          />
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
            <span>Featured Brand</span>
          </label>
          <button type="submit" className="w-full py-2 rounded-lg bg-[#6D5BD0] text-white text-xs font-medium">
            Create Brand
          </button>
        </form>

        <div className="lg:col-span-8 bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-500">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Slug</th>
                <th className="py-3 px-4">Featured</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {brands.map((b) => (
                <tr key={b.id}>
                  <td className="py-3 px-4 font-medium">{b.name}</td>
                  <td className="py-3 px-4 font-mono text-zinc-500">{b.slug}</td>
                  <td className="py-3 px-4">{b.featured ? 'Featured' : 'Standard'}</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => deleteDoc(doc(db, 'brands', b.id))}
                      className="p-1 text-zinc-500 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function AdminInventoryPage() {
  const { user } = useAuth();
  const { allProducts, settings, pushToast } = useStore();
  const { movements, suppliers, purchaseOrders, logActivity } = useAdmin();

  const [tab, setTab] = useState<'stock' | 'movements' | 'suppliers' | 'pos'>('stock');
  const [adjustDelta, setAdjustDelta] = useState<Record<string, number>>({});
  const [adjustReason, setAdjustReason] = useState<Record<string, string>>({});

  // Supplier form
  const [supName, setSupName] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supPhone, setSupPhone] = useState('');

  // PO form
  const [poSupplierId, setPoSupplierId] = useState(suppliers[0]?.id || '');
  const [poProductId, setPoProductId] = useState(allProducts[0]?.id || '');
  const [poQty, setPoQty] = useState(20);

  const handleStockAdjust = async (product: Product) => {
    const delta = Number(adjustDelta[product.id] || 0);
    if (!delta) return;
    const nextStock = Math.max(0, product.stock + delta);
    const now = new Date().toISOString();
    const movId = generateId('mov');
    const batch = writeBatch(db);
    batch.update(doc(db, 'products', product.id), { stock: nextStock, updatedAt: now });
    batch.set(doc(db, 'inventoryMovements', movId), {
      id: movId,
      productId: product.id,
      productTitle: product.title,
      sku: product.sku,
      delta,
      previousStock: product.stock,
      newStock: nextStock,
      reason: adjustReason[product.id] || 'Manual warehouse adjustment',
      actorEmail: user?.email || '',
      createdAt: now,
    });
    try {
      await batch.commit();
      await logActivity('inventory.adjusted', 'product', product.id, `${product.sku}: ${delta > 0 ? `+${delta}` : delta}`);
      setAdjustDelta((prev) => ({ ...prev, [product.id]: 0 }));
      pushToast(`Stock updated for ${product.sku}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `products/${product.id}`);
    }
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = generateId('sup');
    await setDoc(doc(db, 'suppliers', id), {
      id,
      name: supName.trim(),
      email: supEmail.trim(),
      phone: supPhone.trim(),
      leadTimeDays: 10,
      createdAt: new Date().toISOString(),
    });
    setSupName('');
    setSupEmail('');
    setSupPhone('');
    pushToast('Supplier added');
  };

  const handleCreatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    const sup = suppliers.find((s) => s.id === (poSupplierId || suppliers[0]?.id));
    const prod = allProducts.find((p) => p.id === (poProductId || allProducts[0]?.id));
    if (!sup || !prod) return;
    const id = generateId('po');
    const unitCost = prod.costPrice || Math.round(prod.price * 0.5);
    await setDoc(doc(db, 'purchaseOrders', id), {
      id,
      poNumber: `PO-${Math.floor(1000 + Math.random() * 9000)}`,
      supplierId: sup.id,
      supplierName: sup.name,
      items: [{ productId: prod.id, title: prod.title, sku: prod.sku, quantity: poQty, unitCost }],
      totalCost: unitCost * poQty,
      status: 'ordered',
      createdAt: new Date().toISOString(),
    });
    pushToast('Purchase Order created');
  };

  const handleReceivePo = async (po: PurchaseOrder) => {
    if (po.status === 'received') return;
    const now = new Date().toISOString();
    const batch = writeBatch(db);
    batch.update(doc(db, 'purchaseOrders', po.id), { status: 'received' });
    for (const item of po.items) {
      const prod = allProducts.find((p) => p.id === item.productId);
      if (prod) {
        const nextStock = prod.stock + item.quantity;
        batch.update(doc(db, 'products', prod.id), { stock: nextStock, updatedAt: now });
        const movId = generateId('mov');
        batch.set(doc(db, 'inventoryMovements', movId), {
          id: movId,
          productId: prod.id,
          productTitle: prod.title,
          sku: prod.sku,
          delta: item.quantity,
          previousStock: prod.stock,
          newStock: nextStock,
          reason: `Received ${po.poNumber}`,
          actorEmail: user?.email || '',
          createdAt: now,
        });
      }
    }
    await batch.commit();
    pushToast(`${po.poNumber} received & stock updated`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold">Inventory &amp; Supply Chain</h1>
        <div className="inline-flex p-1 rounded-lg bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800">
          {(['stock', 'movements', 'suppliers', 'pos'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize ${
                tab === t ? 'bg-[#6D5BD0] text-white' : 'text-zinc-500'
              }`}
            >
              {t === 'pos' ? 'Purchase Orders' : t}
            </button>
          ))}
        </div>
      </div>

      {tab === 'stock' && (
        <div className="bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-500">
                <th className="py-3 px-4">SKU / Product</th>
                <th className="py-3 px-4">Current Stock</th>
                <th className="py-3 px-4">Threshold</th>
                <th className="py-3 px-4">Adjustment (+/-)</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4 text-right">Apply</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {allProducts.map((p) => (
                <tr key={p.id}>
                  <td className="py-3 px-4">
                    <p className="font-medium">{p.title}</p>
                    <p className="font-mono text-zinc-400">{p.sku}</p>
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold tabular-nums">
                    <span className={p.stock <= (p.lowStockThreshold ?? 5) ? 'text-amber-600' : ''}>{p.stock}</span>
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-zinc-500">{p.lowStockThreshold ?? 5}</td>
                  <td className="py-3 px-4">
                    <input
                      type="number"
                      value={adjustDelta[p.id] ?? 0}
                      onChange={(e) => setAdjustDelta((prev) => ({ ...prev, [p.id]: Number(e.target.value) }))}
                      className="w-20 px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <input
                      type="text"
                      value={adjustReason[p.id] ?? ''}
                      onChange={(e) => setAdjustReason((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      placeholder="Restock / Audit"
                      className="w-40 px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                    />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleStockAdjust(p)}
                      className="px-3 py-1 rounded bg-[#6D5BD0] text-white font-medium"
                    >
                      Save
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'movements' && (
        <div className="bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-500">
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4">Delta</th>
                <th className="py-3 px-4">Before → After</th>
                <th className="py-3 px-4">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {movements.map((m) => (
                <tr key={m.id}>
                  <td className="py-3 px-4 font-mono text-zinc-500">{new Date(m.createdAt).toLocaleString()}</td>
                  <td className="py-3 px-4 font-mono">{m.sku}</td>
                  <td className={`py-3 px-4 font-mono font-semibold ${m.delta < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {m.delta > 0 ? `+${m.delta}` : m.delta}
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums">{m.previousStock} → {m.newStock}</td>
                  <td className="py-3 px-4">{m.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'suppliers' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={handleAddSupplier} className="lg:col-span-4 p-5 rounded-2xl bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 space-y-3 self-start">
            <h2 className="text-sm font-semibold">Add Supplier</h2>
            <input type="text" required value={supName} onChange={(e) => setSupName(e.target.value)} placeholder="Supplier Name" className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900" />
            <input type="email" required value={supEmail} onChange={(e) => setSupEmail(e.target.value)} placeholder="Email" className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900" />
            <input type="text" value={supPhone} onChange={(e) => setSupPhone(e.target.value)} placeholder="Phone" className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900" />
            <button type="submit" className="w-full py-2 rounded-lg bg-[#6D5BD0] text-white text-xs font-medium">Add Supplier</button>
          </form>
          <div className="lg:col-span-8 bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
            {suppliers.map((s) => (
              <div key={s.id} className="py-3 flex justify-between">
                <div>
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-zinc-500">{s.email} · {s.phone}</p>
                </div>
                <span className="font-mono text-zinc-500">{s.leadTimeDays || 10}d lead</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={handleCreatePo} className="lg:col-span-4 p-5 rounded-2xl bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 space-y-3 self-start text-xs">
            <h2 className="text-sm font-semibold flex items-center gap-1.5"><Plus className="w-4 h-4" /> Create Purchase Order</h2>
            <select value={poSupplierId || suppliers[0]?.id} onChange={(e) => setPoSupplierId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={poProductId || allProducts[0]?.id} onChange={(e) => setPoProductId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
              {allProducts.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            <input type="number" min={1} value={poQty} onChange={(e) => setPoQty(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono" />
            <button type="submit" className="w-full py-2 rounded-lg bg-[#6D5BD0] text-white font-medium">Issue PO</button>
          </form>
          <div className="lg:col-span-8 bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
            {purchaseOrders.length === 0 ? (
              <p className="text-zinc-500">No purchase orders yet.</p>
            ) : (
              purchaseOrders.map((po) => (
                <div key={po.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-mono font-semibold">{po.poNumber} · {po.supplierName}</p>
                    <p className="text-zinc-500">{po.items.map((i) => `${i.title} ×${i.quantity}`).join(', ')}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono tabular-nums">{formatPrice(po.totalCost, settings.currencySymbol)}</span>
                    {po.status !== 'received' ? (
                      <button
                        type="button"
                        onClick={() => handleReceivePo(po)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-emerald-600 text-white font-medium"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Receive Stock
                      </button>
                    ) : (
                      <span className="text-emerald-600 font-medium capitalize">{po.status}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
