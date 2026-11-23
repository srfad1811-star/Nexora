import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { doc, setDoc } from 'firebase/firestore';
import { ShieldCheck, ChevronDown } from 'lucide-react';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { generateId } from '../../lib/utils';
import { ResilientImage } from '../../components/ResilientImage';

export function CategoriesDirectoryPage() {
  const { categories, products } = useStore();
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Departments &amp; Categories</h1>
        <p className="text-sm text-zinc-500 mt-1">Browse every Nexora product line by department.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.filter((c) => c.active).map((cat) => {
          const count = products.filter((p) => p.categoryId === cat.id).length;
          return (
            <Link
              key={cat.id}
              to={`/categories/${cat.slug}`}
              className="group rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#14161D] overflow-hidden hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
            >
              <div className="aspect-[16/10] bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
                <ResilientImage
                  src={cat.image}
                  alt={cat.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-semibold">{cat.name}</h2>
                  <span className="text-xs font-mono text-zinc-500 tabular-nums">{count} items</span>
                </div>
                {cat.description && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1.5 line-clamp-2">{cat.description}</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function AboutPage() {
  const { cms } = useStore();
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14 space-y-10">
      <div className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-wider text-[#6D5BD0]">Our Craft &amp; Ethos</p>
        <h1 className="font-display text-4xl font-bold tracking-tight">Built around lasting materials.</h1>
        <p className="text-base text-zinc-600 dark:text-zinc-300 leading-relaxed">{cms.aboutStory}</p>
      </div>
      <div className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 aspect-[16/9]">
        <ResilientImage src={cms.heroImage} alt="Nexora workshop selection" className="w-full h-full object-cover" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4">
        <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800">
          <p className="font-mono text-2xl font-bold tabular-nums">100%</p>
          <p className="text-xs text-zinc-500 mt-1">Direct-from-atelier quality inspection before dispatch</p>
        </div>
        <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800">
          <p className="font-mono text-2xl font-bold tabular-nums">14 Days</p>
          <p className="text-xs text-zinc-500 mt-1">Zero-friction portal return &amp; exchange coverage</p>
        </div>
        <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800">
          <p className="font-mono text-2xl font-bold tabular-nums">24–48h</p>
          <p className="text-xs text-zinc-500 mt-1">Express delivery across Lahore, Karachi &amp; Islamabad</p>
        </div>
      </div>
    </div>
  );
}

export function FaqPage() {
  const { cms } = useStore();
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14 space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Frequently Asked Questions</h1>
        <p className="text-sm text-zinc-500 mt-1">Shipping, PKR payments, returns, and order tracking.</p>
      </div>
      <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border-y border-zinc-200 dark:border-zinc-800">
        {cms.faqs.map((faq, idx) => (
          <div key={faq.question} className="py-4">
            <button
              type="button"
              onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
              className="w-full flex items-center justify-between text-left gap-4 py-1 font-medium text-sm"
            >
              <span>{faq.question}</span>
              <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${openIdx === idx ? 'rotate-180' : ''}`} />
            </button>
            {openIdx === idx && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2.5 leading-relaxed">{faq.answer}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ContactPage() {
  const { user, signInWithGoogle } = useAuth();
  const { settings, pushToast } = useStore();
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('Order Inquiry');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      pushToast('Please sign in to submit a tracked support ticket', 'info');
      return;
    }
    setSubmitting(true);
    const id = generateId('tkt');
    const now = new Date().toISOString();
    try {
      await setDoc(doc(db, 'supportTickets', id), {
        id,
        userId: user.uid,
        userEmail: user.email || '',
        userName: user.displayName || 'Customer',
        subject: subject.trim(),
        category,
        status: 'open',
        messages: [
          {
            id: generateId('msg'),
            senderRole: 'customer',
            senderName: user.displayName || 'Customer',
            body: message.trim(),
            createdAt: now,
          },
        ],
        createdAt: now,
        updatedAt: now,
      });
      setSubject('');
      setMessage('');
      pushToast('Support ticket created — track replies in your Account');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `supportTickets/${id}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14 grid grid-cols-1 md:grid-cols-12 gap-10">
      <div className="md:col-span-5 space-y-4">
        <h1 className="font-display text-3xl font-bold tracking-tight">Contact Concierge</h1>
        <p className="text-sm text-zinc-500 leading-relaxed">
          Have a question about sizing, courier tracking, or bulk orders? Reach our team directly.
        </p>
        <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2 text-sm">
          <p><span className="text-zinc-500">Email:</span> {settings.supportEmail}</p>
          <p><span className="text-zinc-500">Phone:</span> {settings.supportPhone}</p>
          <p><span className="text-zinc-500">Hours:</span> Mon–Sat, 9:00 AM – 7:00 PM PKT</p>
        </div>
      </div>
      <div className="md:col-span-7">
        {!user ? (
          <div className="p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#14161D] space-y-4">
            <h2 className="text-base font-semibold">Sign in to open a support ticket</h2>
            <p className="text-sm text-zinc-500">Authenticated tickets appear in your Customer Portal for real-time agent updates.</p>
            <button
              type="button"
              onClick={signInWithGoogle}
              className="px-5 py-2.5 rounded-lg bg-[#6D5BD0] text-white text-sm font-medium"
            >
              Sign In with Google
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#14161D] space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Topic</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
              >
                <option>Order Inquiry</option>
                <option>Shipping &amp; Tracking</option>
                <option>Returns &amp; Refunds</option>
                <option>Product Sizing</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Subject</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Order delivery window"
                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Message</label>
              <textarea
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-lg bg-[#6D5BD0] text-white text-sm font-medium"
            >
              {submitting ? 'Sending...' : 'Submit Ticket'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export function PolicyPage() {
  const { slug } = useParams<{ slug: string }>();
  const { cms } = useStore();
  const title =
    slug === 'privacy' ? 'Privacy Policy' : slug === 'terms' ? 'Terms & Conditions' : 'Return & Refund Policy';
  const body =
    slug === 'privacy'
      ? cms.privacyPolicyText
      : slug === 'terms'
      ? cms.termsText
      : cms.returnPolicyText;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14 space-y-4">
      <h1 className="font-display text-3xl font-bold">{title}</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed whitespace-pre-line">{body}</p>
    </div>
  );
}

export function AuthPortalPage({ mode = 'login' }: { mode?: 'login' | 'register' | 'reset' }) {
  const { user, signInWithGoogle, isStaff } = useAuth();
  const navigate = useNavigate();

  if (user) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-5">
        <ShieldCheck className="w-10 h-10 mx-auto text-emerald-500" />
        <h1 className="font-display text-2xl font-bold">Signed in as {user.displayName || user.email}</h1>
        <p className="text-sm text-zinc-500">{user.email}</p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => navigate('/account')}
            className="w-full py-2.5 rounded-lg bg-[#6D5BD0] text-white text-sm font-medium"
          >
            Go to Customer Portal
          </button>
          {isStaff && (
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="w-full py-2.5 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm font-medium"
            >
              Open Admin Dashboard
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-20">
      <div className="p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#14161D] space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-bold">
            {mode === 'register'
              ? 'Create Your Nexora Account'
              : mode === 'reset'
              ? 'Account Recovery'
              : 'Sign In to Nexora'}
          </h1>
          <p className="text-sm text-zinc-500">
            Secure one-click authentication powered by Google Sign-In. Password recovery and verification are handled directly through your Google Account.
          </p>
        </div>

        <button
          type="button"
          onClick={signInWithGoogle}
          className="w-full py-3 px-5 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Continue with Google
        </button>

        <div className="text-xs text-zinc-500 pt-2 border-t border-zinc-200 dark:border-zinc-800">
          By continuing, you agree to our{' '}
          <Link to="/policies/terms" className="underline">Terms</Link> and{' '}
          <Link to="/policies/privacy" className="underline">Privacy Policy</Link>.
        </div>
      </div>
    </div>
  );
}
