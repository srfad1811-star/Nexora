import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Database,
  Download,
  Plus,
  Send,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { useAdmin } from '../../context/AdminContext';
import { seedStorefrontIfEmpty } from '../../lib/seed';
import {
  exportToCsv,
  formatPrice,
  generateId,
  PAKISTAN_CITIES,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
} from '../../lib/utils';
import type {
  Coupon,
  Review,
  ShippingZoneRate,
  StaffMember,
  StaffRole,
  StorefrontCmsData,
  StoreSettingsData,
  SupportTicket,
} from '../../types/ecommerce';

const CHART_COLORS = ['#6D5BD0', '#10B981', '#F59E0B', '#0EA5E9', '#EC4899'];

// ============================================================================
// 1. Coupons & Promotions
// ============================================================================
export function AdminCouponsPage() {
  const { coupons, settings, pushToast } = useStore();
  const { logActivity } = useAdmin();

  const [code, setCode] = useState('');
  const [type, setType] = useState<Coupon['type']>('percentage');
  const [value, setValue] = useState(10);
  const [minOrderAmount, setMinOrderAmount] = useState(0);
  const [usageLimit, setUsageLimit] = useState(100);
  const [expiresAt, setExpiresAt] = useState('');
  const [description, setDescription] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    const id = generateId('coup');
    const cleanCode = code.trim().toUpperCase();
    const payload: Coupon = {
      id,
      code: cleanCode,
      type,
      value: Number(value) || 0,
      minOrderAmount: Number(minOrderAmount) || 0,
      usageLimit: Number(usageLimit) || 100,
      usedCount: 0,
      expiresAt: expiresAt || undefined,
      active: true,
      description: description.trim(),
      createdAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'coupons', id), payload);
      await logActivity('create_coupon', 'coupon', id, cleanCode);
      setCode('');
      setDescription('');
      pushToast(`Coupon ${cleanCode} created`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `coupons/${id}`);
    }
  };

  const toggleActive = async (c: Coupon) => {
    try {
      await updateDoc(doc(db, 'coupons', c.id), { active: !c.active });
      await logActivity('toggle_coupon', 'coupon', c.id, `${c.code}: ${!c.active}`);
      pushToast(`Coupon ${c.code} ${!c.active ? 'activated' : 'paused'}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `coupons/${c.id}`);
    }
  };

  const removeCoupon = async (c: Coupon) => {
    try {
      await deleteDoc(doc(db, 'coupons', c.id));
      await logActivity('delete_coupon', 'coupon', c.id, c.code);
      pushToast(`Coupon ${c.code} deleted`, 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `coupons/${c.id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Coupons &amp; Promotions</h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          Create percentage discounts, fixed PKR markdowns, or free shipping vouchers.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleCreate}
          className="lg:col-span-4 bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-3 self-start text-xs"
        >
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Create Coupon
          </h2>
          <div>
            <label className="block text-zinc-500 mb-1">Code</label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="EID20"
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono uppercase"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-500 mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as Coupon['type'])}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed ({settings.currencySymbol})</option>
                <option value="free_shipping">Free Shipping</option>
              </select>
            </div>
            <div>
              <label className="block text-zinc-500 mb-1">Value</label>
              <input
                type="number"
                min={0}
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
                disabled={type === 'free_shipping'}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-500 mb-1">Min Spend</label>
              <input
                type="number"
                min={0}
                value={minOrderAmount}
                onChange={(e) => setMinOrderAmount(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
              />
            </div>
            <div>
              <label className="block text-zinc-500 mb-1">Usage Limit</label>
              <input
                type="number"
                min={1}
                value={usageLimit}
                onChange={(e) => setUsageLimit(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-zinc-500 mb-1">Expiry Date (Optional)</label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
            />
          </div>
          <div>
            <label className="block text-zinc-500 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Seasonal collection promotion"
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
            />
          </div>
          <button type="submit" className="w-full py-2.5 rounded-lg bg-[#6D5BD0] text-white font-medium">
            Save Coupon
          </button>
        </form>

        <div className="lg:col-span-8 bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50/70 dark:bg-zinc-900/50 text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
              <tr>
                <th className="py-3 px-4 font-medium">Code</th>
                <th className="py-3 px-4 font-medium">Discount</th>
                <th className="py-3 px-4 font-medium">Usage</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {coupons.map((c) => (
                <tr key={c.id}>
                  <td className="py-3.5 px-4">
                    <p className="font-mono font-bold">{c.code}</p>
                    {c.description && <p className="text-[11px] text-zinc-500">{c.description}</p>}
                  </td>
                  <td className="py-3.5 px-4 font-mono">
                    {c.type === 'percentage'
                      ? `${c.value}%`
                      : c.type === 'fixed'
                      ? formatPrice(c.value, settings.currencySymbol)
                      : 'Free Shipping'}
                  </td>
                  <td className="py-3.5 px-4 font-mono tabular-nums">
                    {c.usedCount || 0} / {c.usageLimit || '∞'}
                  </td>
                  <td className="py-3.5 px-4">
                    <button
                      type="button"
                      onClick={() => toggleActive(c)}
                      className={`px-2 py-0.5 rounded border text-[11px] ${
                        c.active
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}
                    >
                      {c.active ? 'Active' : 'Paused'}
                    </button>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => removeCoupon(c)}
                      className="p-1.5 text-zinc-500 hover:text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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

// ============================================================================
// 2. Reviews Moderation
// ============================================================================
export function AdminReviewsPage() {
  const { allProducts, pushToast } = useStore();
  const { reviews, logActivity } = useAdmin();

  const moderate = async (review: Review, status: Review['status']) => {
    try {
      await updateDoc(doc(db, 'reviews', review.id), { status });
      await logActivity('moderate_review', 'review', review.id, `${status}`);
      pushToast(`Review marked ${status}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reviews/${review.id}`);
    }
  };

  const remove = async (review: Review) => {
    try {
      await deleteDoc(doc(db, 'reviews', review.id));
      await logActivity('delete_review', 'review', review.id);
      pushToast('Review deleted', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `reviews/${review.id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Reviews Moderation</h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          Approve, hide, or remove customer product feedback.
        </p>
      </div>

      <div className="bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 rounded-2xl divide-y divide-zinc-100 dark:divide-zinc-800">
        {reviews.length === 0 ? (
          <p className="p-10 text-center text-xs text-zinc-500">No product reviews yet.</p>
        ) : (
          [...reviews]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((r) => {
              const product = allProducts.find((p) => p.id === r.productId);
              return (
                <div key={r.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{r.userName}</span>
                      <span className="font-mono text-amber-500">{'★'.repeat(r.rating)}</span>
                      <span className="text-zinc-500">on {product?.title || r.productId}</span>
                    </div>
                    {r.title && <p className="font-medium">{r.title}</p>}
                    <p className="text-zinc-600 dark:text-zinc-400">{r.comment}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="capitalize px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">{r.status}</span>
                    {r.status !== 'approved' && (
                      <button
                        type="button"
                        onClick={() => moderate(r, 'approved')}
                        className="px-2.5 py-1 rounded bg-emerald-600 text-white"
                      >
                        Approve
                      </button>
                    )}
                    {r.status !== 'rejected' && (
                      <button
                        type="button"
                        onClick={() => moderate(r, 'rejected')}
                        className="px-2.5 py-1 rounded border border-zinc-300 dark:border-zinc-700"
                      >
                        Hide
                      </button>
                    )}
                    <button type="button" onClick={() => remove(r)} className="p-1.5 text-zinc-400 hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 3. Support Inbox
// ============================================================================
export function AdminSupportPage() {
  const { user, staffMember } = useAuth();
  const { pushToast } = useStore();
  const { tickets, logActivity } = useAdmin();

  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [replyText, setReplyText] = useState('');

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !replyText.trim()) return;
    const now = new Date().toISOString();
    const updatedMessages = [
      ...selected.messages,
      {
        id: generateId('msg'),
        senderRole: 'staff' as const,
        senderName: staffMember?.name || user?.displayName || 'Nexora Concierge',
        body: replyText.trim(),
        createdAt: now,
      },
    ];
    try {
      await updateDoc(doc(db, 'supportTickets', selected.id), {
        messages: updatedMessages,
        status: 'in_progress',
        updatedAt: now,
      });
      await logActivity('reply_ticket', 'supportTicket', selected.id, selected.subject);
      setSelected({ ...selected, messages: updatedMessages, status: 'in_progress', updatedAt: now });
      setReplyText('');
      pushToast('Reply sent to customer');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `supportTickets/${selected.id}`);
    }
  };

  const setStatus = async (ticket: SupportTicket, status: SupportTicket['status']) => {
    try {
      await updateDoc(doc(db, 'supportTickets', ticket.id), {
        status,
        updatedAt: new Date().toISOString(),
      });
      if (selected?.id === ticket.id) setSelected({ ...ticket, status });
      pushToast(`Ticket marked ${status}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `supportTickets/${ticket.id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Customer Messages &amp; Tickets</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Respond to customer inquiries and resolve support cases.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 rounded-2xl divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
          {tickets.length === 0 ? (
            <p className="p-8 text-center text-xs text-zinc-500">No support tickets in inbox.</p>
          ) : (
            [...tickets]
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
              .map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelected(t)}
                  className={`w-full text-left p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-colors ${
                    selected?.id === t.id ? 'bg-[#6D5BD0]/5' : ''
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold">{t.subject}</span>
                    <span className="capitalize text-[11px] text-[#6D5BD0]">{t.status.replace('_', ' ')}</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    {t.userName || t.userEmail} · {t.messages.length} messages
                  </p>
                </button>
              ))
          )}
        </div>

        <div className="lg:col-span-7 bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
          {!selected ? (
            <p className="text-xs text-zinc-500 py-16 text-center">Select a ticket thread to view conversation.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div>
                  <h2 className="text-sm font-semibold">{selected.subject}</h2>
                  <p className="text-xs text-zinc-500">{selected.userEmail}</p>
                </div>
                <select
                  value={selected.status}
                  onChange={(e) => setStatus(selected, e.target.value as SupportTicket['status'])}
                  className="px-2.5 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <div className="space-y-2.5 max-h-80 overflow-y-auto">
                {selected.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`p-3 rounded-xl text-xs ${
                      m.senderRole === 'staff'
                        ? 'bg-[#6D5BD0]/10 ml-6'
                        : 'bg-zinc-100 dark:bg-zinc-900 mr-6'
                    }`}
                  >
                    <p className="font-semibold mb-0.5">
                      {m.senderName}{' '}
                      <span className="font-normal text-zinc-500">
                        · {new Date(m.createdAt).toLocaleString()}
                      </span>
                    </p>
                    <p>{m.body}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={sendReply} className="flex gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write an official staff response..."
                  className="flex-1 px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#6D5BD0] text-white text-xs font-medium"
                >
                  <Send className="w-3.5 h-3.5" />
                  Reply
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 4. CMS Content Editor
// ============================================================================
export function AdminCmsPage() {
  const { cms, pushToast } = useStore();
  const { logActivity } = useAdmin();
  const [form, setForm] = useState<StorefrontCmsData>(cms);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(cms);
  }, [cms]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, 'cmsConfig', 'storefront'), {
        id: 'storefront',
        data: form,
        updatedAt: new Date().toISOString(),
      });
      await logActivity('update_cms', 'cmsConfig', 'storefront', 'Updated storefront copy and banners');
      pushToast('Storefront CMS published live');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'cmsConfig/storefront');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Storefront CMS</h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          Manage announcement bar, homepage hero banner, promotional block, brand story, and legal policies.
        </p>
      </div>

      <form onSubmit={handleSave} className="bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-5 text-xs">
        <div className="space-y-3 border-b border-zinc-100 dark:border-zinc-800 pb-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Announcement Bar</h2>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.announcementEnabled}
                onChange={(e) => setForm({ ...form, announcementEnabled: e.target.checked })}
              />
              <span>Visible</span>
            </label>
          </div>
          <input
            type="text"
            value={form.announcementText}
            onChange={(e) => setForm({ ...form, announcementText: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-5">
          <div>
            <label className="block text-zinc-500 mb-1">Hero Eyebrow</label>
            <input
              type="text"
              value={form.heroEyebrow}
              onChange={(e) => setForm({ ...form, heroEyebrow: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
            />
          </div>
          <div>
            <label className="block text-zinc-500 mb-1">Hero CTA Label</label>
            <input
              type="text"
              value={form.heroCtaLabel}
              onChange={(e) => setForm({ ...form, heroCtaLabel: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-zinc-500 mb-1">Hero Headline</label>
            <input
              type="text"
              value={form.heroTitle}
              onChange={(e) => setForm({ ...form, heroTitle: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-zinc-500 mb-1">Hero Subtitle</label>
            <textarea
              rows={2}
              value={form.heroSubtitle}
              onChange={(e) => setForm({ ...form, heroSubtitle: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-zinc-500 mb-1">Hero Image Path</label>
            <input
              type="text"
              value={form.heroImage}
              onChange={(e) => setForm({ ...form, heroImage: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-zinc-500 mb-1">Promotional Section Title</label>
            <input
              type="text"
              value={form.promoTitle}
              onChange={(e) => setForm({ ...form, promoTitle: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
            />
          </div>
          <div>
            <label className="block text-zinc-500 mb-1">About Page Story</label>
            <textarea
              rows={3}
              value={form.aboutStory}
              onChange={(e) => setForm({ ...form, aboutStory: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
            />
          </div>
          <div>
            <label className="block text-zinc-500 mb-1">Return Policy Text</label>
            <textarea
              rows={2}
              value={form.returnPolicyText}
              onChange={(e) => setForm({ ...form, returnPolicyText: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-[#6D5BD0] text-white font-medium hover:bg-[#5B49BF]"
          >
            {saving ? 'Publishing...' : 'Publish Storefront Content'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================================
// 5. Shipping Zones & Couriers
// ============================================================================
export function AdminShippingPage() {
  const { settings, pushToast } = useStore();
  const { logActivity } = useAdmin();
  const [form, setForm] = useState<StoreSettingsData>(settings);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneCities, setNewZoneCities] = useState('');
  const [newStdFee, setNewStdFee] = useState(350);
  const [newExpFee, setNewExpFee] = useState(700);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const saveSettings = async (next: StoreSettingsData) => {
    try {
      await setDoc(doc(db, 'cmsConfig', 'settings'), {
        id: 'settings',
        data: next,
        updatedAt: new Date().toISOString(),
      });
      await logActivity('update_shipping', 'cmsConfig', 'settings', 'Updated shipping zones & thresholds');
      pushToast('Shipping configuration saved');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'cmsConfig/settings');
    }
  };

  const addZone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZoneName.trim()) return;
    const zone: ShippingZoneRate = {
      id: generateId('zone'),
      zoneName: newZoneName.trim(),
      cities: newZoneCities.split(',').map((s) => s.trim()).filter(Boolean),
      standardFee: Number(newStdFee) || 0,
      expressFee: Number(newExpFee) || 0,
      estimatedDays: '2–3 business days',
    };
    const next = { ...form, shippingZones: [...form.shippingZones, zone] };
    setForm(next);
    saveSettings(next);
    setNewZoneName('');
    setNewZoneCities('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Shipping &amp; Delivery Zones</h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          Configure Pakistan regional delivery rates, free shipping thresholds, and COD fees.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
        <div className="lg:col-span-5 bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold">Global Shipping Rules</h2>
          <div>
            <label className="block text-zinc-500 mb-1">Free Shipping Threshold ({form.currencySymbol})</label>
            <input
              type="number"
              value={form.freeShippingThreshold}
              onChange={(e) => setForm({ ...form, freeShippingThreshold: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
            />
          </div>
          <div>
            <label className="block text-zinc-500 mb-1">COD Handling Fee ({form.currencySymbol})</label>
            <input
              type="number"
              value={form.codFee}
              onChange={(e) => setForm({ ...form, codFee: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
            />
          </div>
          <div>
            <label className="block text-zinc-500 mb-1">Courier Partners (comma-separated)</label>
            <input
              type="text"
              value={form.deliveryPartners.join(', ')}
              onChange={(e) =>
                setForm({
                  ...form,
                  deliveryPartners: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                })
              }
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
            />
          </div>
          <button
            type="button"
            onClick={() => saveSettings(form)}
            className="w-full py-2 rounded-lg bg-[#6D5BD0] text-white font-medium"
          >
            Save Rules
          </button>

          <form onSubmit={addZone} className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
            <h3 className="font-semibold">Add Regional Zone</h3>
            <input
              type="text"
              placeholder="Zone Name (e.g. Northern Areas)"
              value={newZoneName}
              onChange={(e) => setNewZoneName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
            />
            <input
              type="text"
              placeholder={`Cities (${PAKISTAN_CITIES.slice(0, 3).join(', ')})`}
              value={newZoneCities}
              onChange={(e) => setNewZoneCities(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={newStdFee}
                onChange={(e) => setNewStdFee(Number(e.target.value))}
                placeholder="Standard Fee"
                className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
              />
              <input
                type="number"
                value={newExpFee}
                onChange={(e) => setNewExpFee(Number(e.target.value))}
                placeholder="Express Fee"
                className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
              />
            </div>
            <button type="submit" className="w-full py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 font-medium">
              Add Shipping Zone
            </button>
          </form>
        </div>

        <div className="lg:col-span-7 bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 divide-y divide-zinc-100 dark:divide-zinc-800">
          {form.shippingZones.map((z) => (
            <div key={z.id} className="py-3.5 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-sm">{z.zoneName}</p>
                <p className="text-zinc-500">{z.cities.join(', ')} · {z.estimatedDays}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right font-mono tabular-nums">
                  <p>Std: {formatPrice(z.standardFee, form.currencySymbol)}</p>
                  <p className="text-zinc-500">Exp: {formatPrice(z.expressFee, form.currencySymbol)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = { ...form, shippingZones: form.shippingZones.filter((x) => x.id !== z.id) };
                    setForm(next);
                    saveSettings(next);
                  }}
                  className="p-1.5 text-zinc-400 hover:text-red-500"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 6. Deep Analytics & Reports
// ============================================================================
export function AdminAnalyticsPage() {
  const { settings } = useStore();
  const { orders, customers } = useAdmin();

  const paymentBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    orders
      .filter((o) => o.status !== 'cancelled')
      .forEach((o) => {
        const key = o.paymentMethod.replace('_', ' ').toUpperCase();
        map.set(key, (map.get(key) || 0) + o.total);
      });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [orders]);

  const statusBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach((o) => {
      map.set(o.status, (map.get(o.status) || 0) + 1);
    });
    return Array.from(map.entries()).map(([status, count]) => ({ status, count }));
  }, [orders]);

  const exportFinancialReport = () => {
    exportToCsv(
      `nexora-financial-report-${new Date().toISOString().slice(0, 10)}.csv`,
      orders.map((o) => ({
        orderNumber: o.orderNumber,
        date: o.createdAt,
        subtotal: o.subtotal,
        discount: o.discountAmount || 0,
        shipping: o.shippingFee || 0,
        tax: o.taxAmount || 0,
        total: o.total,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
        orderStatus: o.status,
      }))
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Analytics &amp; Financial Reports</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Live breakdowns by payment method, fulfillment funnel, and customer cohort retention.
          </p>
        </div>
        <button
          type="button"
          onClick={exportFinancialReport}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#6D5BD0] text-white text-xs font-medium"
        >
          <Download className="w-3.5 h-3.5" />
          Export Financial CSV
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold mb-4">Revenue by Payment Method</h2>
          <div className="h-64">
            {paymentBreakdown.length === 0 ? (
              <p className="text-xs text-zinc-500 pt-20 text-center">No orders recorded yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentBreakdown} dataKey="value" nameKey="name" outerRadius={85} label>
                    {paymentBreakdown.map((entry, idx) => (
                      <Cell key={entry.name} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => formatPrice(Number(val) || 0, settings.currencySymbol)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold mb-4">Orders by Status ({orders.length} total · {customers.length} customers)</h2>
          <div className="h-64">
            {statusBreakdown.length === 0 ? (
              <p className="text-xs text-zinc-500 pt-20 text-center">No status records yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" vertical={false} />
                  <XAxis dataKey="status" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6D5BD0" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 7. Staff & RBAC Roles
// ============================================================================
export function AdminStaffPage() {
  const { isBootstrappedAdmin, staffRole } = useAuth();
  const { pushToast } = useStore();
  const { staffList, customers, logActivity } = useAdmin();

  const [selectedUid, setSelectedUid] = useState('');
  const [role, setRole] = useState<StaffRole>('store_manager');

  const canManageStaff = isBootstrappedAdmin || staffRole === 'super_admin' || staffRole === 'admin';

  const handleAssignStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageStaff) {
      pushToast('Only Super Admin or Admin can assign staff roles', 'error');
      return;
    }
    const target = customers.find((c) => c.uid === selectedUid);
    if (!target) {
      pushToast('Select an existing signed-in user first', 'info');
      return;
    }
    const payload: StaffMember = {
      uid: target.uid,
      email: target.email,
      name: target.displayName,
      role,
      permissions: ROLE_PERMISSIONS[role],
      active: true,
      twoFactorEnabled: false,
      createdAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'staff', target.uid), payload);
      await logActivity('assign_staff', 'staff', target.uid, `${target.email} -> ${role}`);
      setSelectedUid('');
      pushToast(`${target.displayName} assigned as ${ROLE_LABELS[role]}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `staff/${target.uid}`);
    }
  };

  const toggleStaffActive = async (member: StaffMember) => {
    if (!canManageStaff) return;
    try {
      await updateDoc(doc(db, 'staff', member.uid), { active: !member.active });
      await logActivity('toggle_staff', 'staff', member.uid, `${member.email}: ${!member.active}`);
      pushToast(`${member.name} ${!member.active ? 'activated' : 'deactivated'}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `staff/${member.uid}`);
    }
  };

  const removeStaff = async (member: StaffMember) => {
    if (!canManageStaff) return;
    try {
      await deleteDoc(doc(db, 'staff', member.uid));
      await logActivity('remove_staff', 'staff', member.uid, member.email);
      pushToast(`Removed ${member.name} from staff`, 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `staff/${member.uid}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Staff &amp; Role-Based Access Control</h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          Assign granular RBAC roles across store operations, merchandising, fulfillment, and support.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
        <form
          onSubmit={handleAssignStaff}
          className="lg:col-span-4 bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-3 self-start"
        >
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-[#6D5BD0]" /> Grant Staff Role
          </h2>
          <p className="text-zinc-500">
            Users must sign in once via Google so their verified Firebase UID appears in the directory.
          </p>
          <div>
            <label className="block text-zinc-500 mb-1">User Account</label>
            <select
              value={selectedUid}
              onChange={(e) => setSelectedUid(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
            >
              <option value="">Select user...</option>
              {customers.map((c) => (
                <option key={c.uid} value={c.uid}>
                  {c.displayName} ({c.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-zinc-500 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
            >
              {(Object.keys(ROLE_LABELS) as StaffRole[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="w-full py-2.5 rounded-lg bg-[#6D5BD0] text-white font-medium">
            Assign Role
          </button>
        </form>

        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-zinc-50/70 dark:bg-zinc-900/50 text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                <tr>
                  <th className="py-3 px-4 font-medium">Staff Member</th>
                  <th className="py-3 px-4 font-medium">Role</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {staffList.map((m) => (
                  <tr key={m.uid}>
                    <td className="py-3 px-4">
                      <p className="font-semibold">{m.name}</p>
                      <p className="text-[11px] text-zinc-500">{m.email}</p>
                    </td>
                    <td className="py-3 px-4">{ROLE_LABELS[m.role]}</td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => toggleStaffActive(m)}
                        className={`px-2 py-0.5 rounded border text-[11px] ${
                          m.active
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                        }`}
                      >
                        {m.active ? 'Active' : 'Disabled'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => removeStaff(m)}
                        className="p-1.5 text-zinc-400 hover:text-red-500"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-semibold">Role Permission Matrix</h3>
            <div className="space-y-2">
              {(Object.keys(ROLE_LABELS) as StaffRole[]).map((r) => (
                <div key={r} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                  <span className="font-semibold w-36 shrink-0">{ROLE_LABELS[r]}</span>
                  <span className="text-zinc-500 font-mono text-[11px]">
                    {ROLE_PERMISSIONS[r].join(' · ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 8. Activity Audit Logs
// ============================================================================
export function AdminActivityLogsPage() {
  const { activityLogs } = useAdmin();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...activityLogs]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter((l) => {
        if (!q) return true;
        return `${l.actorEmail} ${l.action} ${l.entityType} ${l.details || ''}`.toLowerCase().includes(q);
      });
  }, [activityLogs, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Immutable Activity Logs</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Append-only audit trail across catalog edits, fulfillment transitions, and staff updates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter logs..."
            className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#14161D]"
          />
          <button
            type="button"
            onClick={() => exportToCsv('nexora-activity-logs.csv', filtered as unknown as Record<string, unknown>[])}
            className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#14161D]"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-50/70 dark:bg-zinc-900/50 text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
            <tr>
              <th className="py-3 px-4 font-medium">Timestamp</th>
              <th className="py-3 px-4 font-medium">Actor</th>
              <th className="py-3 px-4 font-medium">Action</th>
              <th className="py-3 px-4 font-medium">Entity</th>
              <th className="py-3 px-4 font-medium">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-zinc-500">
                  No activity entries recorded yet.
                </td>
              </tr>
            ) : (
              filtered.slice(0, 100).map((l) => (
                <tr key={l.id}>
                  <td className="py-3 px-4 font-mono text-zinc-500">{new Date(l.createdAt).toLocaleString()}</td>
                  <td className="py-3 px-4">{l.actorEmail}</td>
                  <td className="py-3 px-4 font-mono font-semibold">{l.action}</td>
                  <td className="py-3 px-4">{l.entityType}</td>
                  <td className="py-3 px-4 text-zinc-500">{l.details || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// 9. Store Settings & Seed Controls
// ============================================================================
export function AdminSettingsPage() {
  const { settings, pushToast } = useStore();
  const { logActivity } = useAdmin();
  const [form, setForm] = useState<StoreSettingsData>(settings);
  const [health, setHealth] = useState<Record<string, boolean>>({});
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setHealth(d.integrations || {}))
      .catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'cmsConfig', 'settings'), {
        id: 'settings',
        data: form,
        updatedAt: new Date().toISOString(),
      });
      await logActivity('update_settings', 'cmsConfig', 'settings', 'Updated store settings');
      pushToast('Store settings saved');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'cmsConfig/settings');
    }
  };

  const handleReseed = async () => {
    setSeeding(true);
    try {
      await seedStorefrontIfEmpty(true);
      await logActivity('seed_catalog', 'system', 'seed', 'Re-initialized default Nexora catalog');
      pushToast('Storefront catalog seeded into Firestore');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Seed failed', 'error');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Store Settings</h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          General storefront identity, tax settings, payment toggles, and catalog initialization.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
        <form
          onSubmit={handleSave}
          className="lg:col-span-8 bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-500 mb-1">Store Name</label>
              <input
                type="text"
                value={form.storeName}
                onChange={(e) => setForm({ ...form, storeName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
              />
            </div>
            <div>
              <label className="block text-zinc-500 mb-1">Support Email</label>
              <input
                type="email"
                value={form.supportEmail}
                onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
              />
            </div>
            <div>
              <label className="block text-zinc-500 mb-1">Support Phone</label>
              <input
                type="text"
                value={form.supportPhone}
                onChange={(e) => setForm({ ...form, supportPhone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
              />
            </div>
            <div>
              <label className="block text-zinc-500 mb-1">Tax Rate (%)</label>
              <input
                type="number"
                min={0}
                max={30}
                value={form.taxRatePercent}
                onChange={(e) => setForm({ ...form, taxRatePercent: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-500 mb-1">Bank Transfer IBAN / Instructions</label>
            <input
              type="text"
              value={form.bankDetails}
              onChange={(e) => setForm({ ...form, bankDetails: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
            {[
              { key: 'codEnabled', label: 'Cash on Delivery' },
              { key: 'bankTransferEnabled', label: 'Bank Transfer (IBFT)' },
              { key: 'stripeEnabled', label: 'Stripe Cards' },
              { key: 'jazzcashEnabled', label: 'JazzCash' },
              { key: 'easypaisaEnabled', label: 'Easypaisa' },
            ].map((item) => (
              <label key={item.key} className="flex items-center gap-2 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <input
                  type="checkbox"
                  checked={Boolean(form[item.key as keyof StoreSettingsData])}
                  onChange={(e) =>
                    setForm({ ...form, [item.key]: e.target.checked })
                  }
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" className="px-5 py-2.5 rounded-lg bg-[#6D5BD0] text-white font-medium">
              Save Settings
            </button>
          </div>
        </form>

        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-3">
            <h2 className="text-sm font-semibold">Server Environment Status</h2>
            {Object.entries(health).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between py-1 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                <span className="capitalize">{k}</span>
                <span className={`inline-flex items-center gap-1 ${v ? 'text-emerald-600' : 'text-zinc-400'}`}>
                  {v && <Check className="w-3.5 h-3.5" />}
                  {v ? 'Configured' : 'Optional / Off'}
                </span>
              </div>
            ))}
          </div>

          <div className="bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <Database className="w-4 h-4 text-[#6D5BD0]" /> Catalog Initialization
            </h2>
            <p className="text-zinc-500 leading-relaxed">
              Re-seed default categories, brands, products, suppliers, and active coupons if needed. Existing edits with new IDs are preserved.
            </p>
            <button
              type="button"
              onClick={handleReseed}
              disabled={seeding}
              className="w-full py-2.5 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-medium"
            >
              {seeding ? 'Seeding Firestore...' : 'Seed / Refresh Default Catalog'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
