import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  Bell,
  Heart,
  LifeBuoy,
  LogOut,
  MapPin,
  Package,
  Printer,
  RotateCcw,
  Star,
  User,
} from 'lucide-react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { formatPrice, generateId, PAKISTAN_CITIES } from '../../lib/utils';
import type {
  Address,
  AppNotification,
  Order,
  ReturnRequest,
  Review,
  SupportTicket,
} from '../../types/ecommerce';

const TRACKING_STEPS = ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'delivered'] as const;

export function AccountDashboard() {
  const { user, profile, authReady, signInWithGoogle, logout, refreshProfile } = useAuth();
  const { products, wishlistIds, settings, pushToast } = useStore();
  const location = useLocation();

  const [orders, setOrders] = useState<Order[]>([]);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [returnModalOrder, setReturnModalOrder] = useState<Order | null>(null);
  const [returnReason, setReturnReason] = useState('');

  // Profile form state
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Address form state
  const [addrLabel, setAddrLabel] = useState('Home');
  const [addrFullName, setAddrFullName] = useState('');
  const [addrPhone, setAddrPhone] = useState('');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrCity, setAddrCity] = useState('Lahore');
  const [addrProvince, setAddrProvince] = useState('Punjab');
  const [addrPostal, setAddrPostal] = useState('54000');

  // Support ticket reply
  const [ticketReply, setTicketReply] = useState<Record<string, string>>({});

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setPhone(profile.phone || '');
      setAddrFullName(profile.displayName || '');
      setAddrPhone(profile.phone || '');
    }
  }, [profile]);

  useEffect(() => {
    if (!authReady || !user) return;

    const unsubOrders = onSnapshot(
      query(collection(db, 'orders'), where('userId', '==', user.uid)),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Order);
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setOrders(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'orders')
    );

    const unsubReturns = onSnapshot(
      query(collection(db, 'returnRequests'), where('userId', '==', user.uid)),
      (snap) => setReturns(snap.docs.map((d) => d.data() as ReturnRequest)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'returnRequests')
    );

    const unsubTickets = onSnapshot(
      query(collection(db, 'supportTickets'), where('userId', '==', user.uid)),
      (snap) => setTickets(snap.docs.map((d) => d.data() as SupportTicket)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'supportTickets')
    );

    const unsubReviews = onSnapshot(
      query(collection(db, 'reviews'), where('userId', '==', user.uid)),
      (snap) => setReviews(snap.docs.map((d) => d.data() as Review)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'reviews')
    );

    const unsubNotifs = onSnapshot(
      query(collection(db, 'notifications'), where('recipientUid', '==', user.uid)),
      (snap) => setNotifications(snap.docs.map((d) => d.data() as AppNotification)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
    );

    return () => {
      unsubOrders();
      unsubReturns();
      unsubTickets();
      unsubReviews();
      unsubNotifs();
    };
  }, [authReady, user]);

  if (!authReady) {
    return <div className="max-w-5xl mx-auto p-12 text-center text-sm text-zinc-500">Loading account...</div>;
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-5">
        <User className="w-10 h-10 mx-auto text-zinc-400" />
        <h1 className="font-display text-2xl font-bold">Customer Portal</h1>
        <p className="text-sm text-zinc-500">
          Sign in with Google to track orders, manage addresses, request returns, and view invoices.
        </p>
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

  const path = location.pathname;
  const activeSection = path.includes('/orders')
    ? 'orders'
    : path.includes('/addresses')
    ? 'addresses'
    : path.includes('/profile')
    ? 'profile'
    : path.includes('/returns')
    ? 'returns'
    : path.includes('/reviews')
    ? 'reviews'
    : path.includes('/notifications')
    ? 'notifications'
    : path.includes('/support')
    ? 'support'
    : 'overview';

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: displayName.trim() || user.email?.split('@')[0] || 'Customer',
        phone: phone.trim(),
        updatedAt: new Date().toISOString(),
      });
      await refreshProfile();
      pushToast('Profile updated');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextAddr: Address = {
      id: generateId('addr'),
      label: addrLabel.trim() || 'Home',
      fullName: addrFullName.trim(),
      phone: addrPhone.trim(),
      street: addrStreet.trim(),
      city: addrCity,
      province: addrProvince.trim(),
      postalCode: addrPostal.trim(),
      country: 'Pakistan',
    };
    const nextList = [...(profile?.addresses || []), nextAddr];
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        addresses: nextList,
        updatedAt: new Date().toISOString(),
      });
      await refreshProfile();
      setAddrStreet('');
      pushToast('Address saved');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    const nextList = (profile?.addresses || []).filter((a) => a.id !== id);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        addresses: nextList,
        updatedAt: new Date().toISOString(),
      });
      await refreshProfile();
      pushToast('Address removed', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleCancelOrder = async (order: Order) => {
    const now = new Date().toISOString();
    const nextHistory = [
      ...(order.statusHistory || []),
      {
        status: 'cancelled' as const,
        note: 'Cancelled by customer',
        actorEmail: user.email || '',
        timestamp: now,
      },
    ];
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: 'cancelled',
        statusHistory: nextHistory,
        updatedAt: now,
      });
      pushToast(`Order ${order.orderNumber} cancelled`, 'info');
      setSelectedOrder(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${order.id}`);
    }
  };

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnModalOrder || returnReason.trim().length < 4) return;
    const id = generateId('ret');
    const now = new Date().toISOString();
    try {
      await setDoc(doc(db, 'returnRequests', id), {
        id,
        orderId: returnModalOrder.id,
        orderNumber: returnModalOrder.orderNumber,
        userId: user.uid,
        amount: returnModalOrder.total,
        reason: returnReason.trim(),
        status: 'requested',
        createdAt: now,
        updatedAt: now,
      });
      setReturnModalOrder(null);
      setReturnReason('');
      pushToast('Return request submitted');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `returnRequests/${id}`);
    }
  };

  const handleTicketReply = async (ticket: SupportTicket) => {
    const body = (ticketReply[ticket.id] || '').trim();
    if (!body) return;
    const now = new Date().toISOString();
    try {
      await updateDoc(doc(db, 'supportTickets', ticket.id), {
        messages: [
          ...ticket.messages,
          {
            id: generateId('msg'),
            senderRole: 'customer',
            senderName: profile?.displayName || 'Customer',
            body,
            createdAt: now,
          },
        ],
        updatedAt: now,
      });
      setTicketReply((prev) => ({ ...prev, [ticket.id]: '' }));
      pushToast('Reply sent');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `supportTickets/${ticket.id}`);
    }
  };

  const navItems = [
    { to: '/account', label: 'Overview', icon: User, end: true },
    { to: '/account/orders', label: 'My Orders', icon: Package },
    { to: '/account/addresses', label: 'Saved Addresses', icon: MapPin },
    { to: '/account/returns', label: 'Returns & Refunds', icon: RotateCcw },
    { to: '/account/reviews', label: 'My Reviews', icon: Star },
    { to: '/account/notifications', label: 'Notifications', icon: Bell },
    { to: '/account/support', label: 'Support Tickets', icon: LifeBuoy },
    { to: '/account/profile', label: 'Profile Settings', icon: User },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar */}
        <aside className="lg:col-span-3 space-y-2 no-print">
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#14161D] mb-4">
            <p className="text-sm font-semibold truncate">{profile?.displayName || user.displayName}</p>
            <p className="text-xs text-zinc-500 truncate">{user.email}</p>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-[#6D5BD0] text-white'
                        : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
            <Link
              to="/wishlist"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <Heart className="w-4 h-4 shrink-0" />
              <span>Wishlist ({wishlistIds.length})</span>
            </Link>
            <button
              type="button"
              onClick={logout}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Sign Out</span>
            </button>
          </nav>
        </aside>

        {/* Main Content */}
        <div className="lg:col-span-9 space-y-6">
          {activeSection === 'overview' && (
            <div className="space-y-6">
              <h1 className="font-display text-2xl font-bold">Account Overview</h1>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#14161D]">
                  <p className="text-xs text-zinc-500">Total Orders</p>
                  <p className="text-2xl font-bold font-mono tabular-nums mt-1">{orders.length}</p>
                </div>
                <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#14161D]">
                  <p className="text-xs text-zinc-500">Saved Wishlist</p>
                  <p className="text-2xl font-bold font-mono tabular-nums mt-1">{wishlistIds.length}</p>
                </div>
                <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#14161D]">
                  <p className="text-xs text-zinc-500">Lifetime Spend</p>
                  <p className="text-2xl font-bold font-mono tabular-nums mt-1">
                    {formatPrice(
                      orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0),
                      settings.currencySymbol
                    )}
                  </p>
                </div>
              </div>

              <div className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#14161D]">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold">Recent Orders</h2>
                  <Link to="/account/orders" className="text-xs text-[#6D5BD0] hover:underline">
                    View all
                  </Link>
                </div>
                {orders.length === 0 ? (
                  <p className="text-sm text-zinc-500">You have not placed any orders yet.</p>
                ) : (
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {orders.slice(0, 3).map((ord) => (
                      <div key={ord.id} className="py-3 flex items-center justify-between gap-4 text-sm">
                        <div>
                          <p className="font-mono font-semibold">{ord.orderNumber}</p>
                          <p className="text-xs text-zinc-500">
                            {new Date(ord.createdAt).toLocaleDateString()} · {ord.items.length} item(s)
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-semibold tabular-nums">
                            {formatPrice(ord.total, settings.currencySymbol)}
                          </p>
                          <p className="text-xs capitalize text-zinc-500">{ord.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSection === 'orders' && (
            <div className="space-y-6">
              <h1 className="font-display text-2xl font-bold">My Orders &amp; Tracking</h1>
              {orders.length === 0 ? (
                <div className="p-10 text-center rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <p className="text-sm text-zinc-500 mb-4">No orders placed yet.</p>
                  <Link to="/shop" className="px-5 py-2.5 rounded-lg bg-[#6D5BD0] text-white text-xs font-medium">
                    Start Shopping
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((ord) => {
                    const stepIdx = TRACKING_STEPS.indexOf(ord.status as (typeof TRACKING_STEPS)[number]);
                    return (
                      <div
                        key={ord.id}
                        className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#14161D] space-y-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div>
                            <p className="font-mono text-base font-bold">{ord.orderNumber}</p>
                            <p className="text-xs text-zinc-500">
                              Placed {new Date(ord.createdAt).toLocaleString()} · {ord.paymentMethod.toUpperCase()} ({ord.paymentStatus})
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-base font-bold tabular-nums">
                              {formatPrice(ord.total, settings.currencySymbol)}
                            </span>
                            <button
                              type="button"
                              onClick={() => setSelectedOrder(selectedOrder?.id === ord.id ? null : ord)}
                              className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-zinc-300 dark:border-zinc-700"
                            >
                              {selectedOrder?.id === ord.id ? 'Hide Details' : 'Details / Invoice'}
                            </button>
                          </div>
                        </div>

                        {/* Tracking Progress */}
                        {ord.status !== 'cancelled' && ord.status !== 'refunded' ? (
                          <div className="grid grid-cols-6 gap-2 pt-2">
                            {TRACKING_STEPS.map((st, idx) => (
                              <div key={st} className="space-y-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${
                                    idx <= stepIdx ? 'bg-[#6D5BD0]' : 'bg-zinc-200 dark:bg-zinc-800'
                                  }`}
                                />
                                <p className="text-[11px] capitalize text-zinc-500 truncate">{st}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs font-medium text-red-600 capitalize">Status: {ord.status}</p>
                        )}

                        {ord.trackingNumber && (
                          <p className="text-xs text-zinc-500">
                            Courier: {ord.deliveryPartner} · Tracking:{' '}
                            <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                              {ord.trackingNumber}
                            </span>
                          </p>
                        )}

                        {selectedOrder?.id === ord.id && (
                          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
                            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-sm">
                              {ord.items.map((item) => (
                                <div key={`${item.productId}_${item.sku}`} className="py-2 flex justify-between">
                                  <span>
                                    {item.title} × {item.quantity}
                                  </span>
                                  <span className="font-mono tabular-nums">
                                    {formatPrice(item.lineTotal, settings.currencySymbol)}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <div className="flex flex-wrap gap-3 no-print">
                              <button
                                type="button"
                                onClick={() => window.print()}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-zinc-300 dark:border-zinc-700"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                Print Invoice
                              </button>
                              {['pending', 'confirmed'].includes(ord.status) && (
                                <button
                                  type="button"
                                  onClick={() => handleCancelOrder(ord)}
                                  className="px-3.5 py-2 text-xs font-medium rounded-lg border border-red-300 text-red-600 hover:bg-red-50"
                                >
                                  Cancel Order
                                </button>
                              )}
                              {ord.status === 'delivered' && (
                                <button
                                  type="button"
                                  onClick={() => setReturnModalOrder(ord)}
                                  className="px-3.5 py-2 text-xs font-medium rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                                >
                                  Request Return / Refund
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeSection === 'addresses' && (
            <div className="space-y-6">
              <h1 className="font-display text-2xl font-bold">Saved Addresses</h1>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(profile?.addresses || []).map((a) => (
                  <div key={a.id} className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#14161D] flex justify-between gap-4">
                    <div className="text-sm space-y-1">
                      <p className="font-semibold">{a.label} — {a.fullName}</p>
                      <p className="text-zinc-600 dark:text-zinc-400">{a.street}</p>
                      <p className="text-zinc-600 dark:text-zinc-400">{a.city}, {a.province} {a.postalCode}</p>
                      <p className="text-xs text-zinc-500">{a.phone}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteAddress(a.id)}
                      className="text-xs text-red-600 hover:underline self-start"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddAddress} className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#14161D] space-y-4">
                <h2 className="text-base font-semibold">Add New Address</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <input
                    type="text"
                    required
                    value={addrLabel}
                    onChange={(e) => setAddrLabel(e.target.value)}
                    placeholder="Label (Home / Office)"
                    className="px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                  />
                  <input
                    type="text"
                    required
                    value={addrFullName}
                    onChange={(e) => setAddrFullName(e.target.value)}
                    placeholder="Full Name"
                    className="px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                  />
                  <input
                    type="tel"
                    required
                    value={addrPhone}
                    onChange={(e) => setAddrPhone(e.target.value)}
                    placeholder="Phone"
                    className="px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                  />
                </div>
                <input
                  type="text"
                  required
                  value={addrStreet}
                  onChange={(e) => setAddrStreet(e.target.value)}
                  placeholder="Street Address"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <select
                    value={addrCity}
                    onChange={(e) => setAddrCity(e.target.value)}
                    className="px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                  >
                    {PAKISTAN_CITIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    required
                    value={addrProvince}
                    onChange={(e) => setAddrProvince(e.target.value)}
                    placeholder="Province"
                    className="px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                  />
                  <input
                    type="text"
                    required
                    value={addrPostal}
                    onChange={(e) => setAddrPostal(e.target.value)}
                    placeholder="Postal Code"
                    className="px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-[#6D5BD0] text-white text-xs font-medium"
                >
                  Save Address
                </button>
              </form>
            </div>
          )}

          {activeSection === 'profile' && (
            <form onSubmit={handleSaveProfile} className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#14161D] space-y-4 max-w-xl">
              <h1 className="font-display text-2xl font-bold">Profile Settings</h1>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Email</label>
                <input
                  type="email"
                  disabled
                  value={user.email || ''}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/50 text-zinc-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                />
              </div>
              <button
                type="submit"
                disabled={savingProfile}
                className="px-5 py-2.5 rounded-lg bg-[#6D5BD0] text-white text-xs font-medium"
              >
                {savingProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          )}

          {activeSection === 'returns' && (
            <div className="space-y-6">
              <h1 className="font-display text-2xl font-bold">Returns &amp; Refunds</h1>
              {returns.length === 0 ? (
                <p className="text-sm text-zinc-500">No return requests submitted. Eligible delivered orders can be returned from My Orders.</p>
              ) : (
                <div className="space-y-3">
                  {returns.map((r) => (
                    <div key={r.id} className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#14161D] flex justify-between items-center">
                      <div>
                        <p className="font-mono text-sm font-semibold">Order {r.orderNumber}</p>
                        <p className="text-xs text-zinc-500 mt-1">{r.reason}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm font-semibold tabular-nums">
                          {formatPrice(r.amount, settings.currencySymbol)}
                        </p>
                        <p className="text-xs capitalize text-[#6D5BD0]">{r.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeSection === 'reviews' && (
            <div className="space-y-4">
              <h1 className="font-display text-2xl font-bold">My Product Reviews</h1>
              {reviews.length === 0 ? (
                <p className="text-sm text-zinc-500">You have not written any product reviews yet.</p>
              ) : (
                reviews.map((rev) => {
                  const prod = products.find((p) => p.id === rev.productId);
                  return (
                    <div key={rev.id} className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#14161D] space-y-1.5">
                      <p className="text-sm font-semibold">{prod?.title || rev.productId}</p>
                      <p className="text-xs text-amber-500 font-mono">{'★'.repeat(rev.rating)}</p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-300">{rev.comment}</p>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeSection === 'notifications' && (
            <div className="space-y-4">
              <h1 className="font-display text-2xl font-bold">Notifications</h1>
              {notifications.length === 0 ? (
                <p className="text-sm text-zinc-500">No notifications at the moment.</p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#14161D] flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="text-sm font-semibold">{n.title}</p>
                      <p className="text-xs text-zinc-500">{n.message}</p>
                    </div>
                    {!n.read && (
                      <button
                        type="button"
                        onClick={() => updateDoc(doc(db, 'notifications', n.id), { read: true })}
                        className="text-xs text-[#6D5BD0] hover:underline shrink-0"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeSection === 'support' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h1 className="font-display text-2xl font-bold">Support Tickets</h1>
                <Link to="/contact" className="px-4 py-2 rounded-lg bg-[#6D5BD0] text-white text-xs font-medium">
                  New Ticket
                </Link>
              </div>
              {tickets.length === 0 ? (
                <p className="text-sm text-zinc-500">No support conversations yet.</p>
              ) : (
                tickets.map((t) => (
                  <div key={t.id} className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#14161D] space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-semibold">{t.subject}</p>
                        <p className="text-xs text-zinc-500">{t.category}</p>
                      </div>
                      <span className="text-xs font-medium capitalize text-[#6D5BD0]">{t.status.replace('_', ' ')}</span>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto bg-zinc-50 dark:bg-zinc-900 p-3 rounded-lg">
                      {t.messages.map((m) => (
                        <div key={m.id} className="text-xs">
                          <span className="font-semibold">{m.senderName}: </span>
                          <span className="text-zinc-600 dark:text-zinc-300">{m.body}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={ticketReply[t.id] || ''}
                        onChange={(e) => setTicketReply((prev) => ({ ...prev, [t.id]: e.target.value }))}
                        placeholder="Write a reply..."
                        className="flex-1 px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                      />
                      <button
                        type="button"
                        onClick={() => handleTicketReply(t)}
                        className="px-4 py-2 text-xs font-medium rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Return Modal */}
      {returnModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <form
            onSubmit={handleSubmitReturn}
            className="bg-white dark:bg-[#14161D] border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4"
          >
            <h2 className="text-lg font-semibold">Request Return — {returnModalOrder.orderNumber}</h2>
            <p className="text-xs text-zinc-500">
              Refund amount: {formatPrice(returnModalOrder.total, settings.currencySymbol)}
            </p>
            <textarea
              rows={4}
              required
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="Describe the reason for return or exchange..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReturnModalOrder(null)}
                className="px-4 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700"
              >
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 text-xs font-medium rounded-lg bg-[#6D5BD0] text-white">
                Submit Request
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
