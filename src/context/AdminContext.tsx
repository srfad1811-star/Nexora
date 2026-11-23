import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { collection, doc, onSnapshot, query, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { useAuth } from './AuthContext';
import { generateId } from '../lib/utils';
import type {
  ActivityLog,
  InventoryMovement,
  Order,
  PurchaseOrder,
  ReturnRequest,
  Review,
  StaffMember,
  Supplier,
  SupportTicket,
  UserProfile,
} from '../types/ecommerce';

interface AdminContextValue {
  orders: Order[];
  customers: UserProfile[];
  returns: ReturnRequest[];
  reviews: Review[];
  tickets: SupportTicket[];
  movements: InventoryMovement[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  staffList: StaffMember[];
  activityLogs: ActivityLog[];
  loading: boolean;
  logActivity: (action: string, entityType: string, entityId?: string, details?: string) => Promise<void>;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const { user, authReady, isStaff, staffRole } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<UserProfile[]>([]);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authReady || !user || !isStaff) {
      setLoading(false);
      return;
    }

    const unsubs: Array<() => void> = [];

    const listen = <T,>(colName: string, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
      const unsub = onSnapshot(
        query(collection(db, colName)),
        (snap) => {
          const items = snap.docs.map((d) => d.data() as T);
          setter(items);
          setLoading(false);
        },
        (err) => {
          setLoading(false);
          handleFirestoreError(err, OperationType.LIST, colName);
        }
      );
      unsubs.push(unsub);
    };

    listen<Order>('orders', setOrders);
    listen<UserProfile>('users', setCustomers);
    listen<ReturnRequest>('returnRequests', setReturns);
    listen<Review>('reviews', setReviews);
    listen<SupportTicket>('supportTickets', setTickets);
    listen<InventoryMovement>('inventoryMovements', setMovements);
    listen<Supplier>('suppliers', setSuppliers);
    listen<PurchaseOrder>('purchaseOrders', setPurchaseOrders);
    listen<StaffMember>('staff', setStaffList);
    listen<ActivityLog>('activityLogs', setActivityLogs);

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authReady, user, isStaff]);

  const logActivity = useCallback(
    async (action: string, entityType: string, entityId?: string, details?: string) => {
      if (!user) return;
      const id = generateId('log');
      const entry: ActivityLog = {
        id,
        actorUid: user.uid,
        actorEmail: user.email || '',
        actorRole: staffRole || 'admin',
        action,
        entityType,
        entityId: entityId || '',
        details: details || '',
        createdAt: new Date().toISOString(),
      };
      try {
        await setDoc(doc(db, 'activityLogs', id), entry);
      } catch (err) {
        console.error('Activity log failed:', err);
      }
    },
    [user, staffRole]
  );

  return (
    <AdminContext.Provider
      value={{
        orders,
        customers,
        returns,
        reviews,
        tickets,
        movements,
        suppliers,
        purchaseOrders,
        staffList,
        activityLogs,
        loading,
        logActivity,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used inside AdminProvider');
  return ctx;
}
