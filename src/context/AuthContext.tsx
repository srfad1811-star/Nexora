import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, googleAuthProvider } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { ROLE_PERMISSIONS } from '../lib/utils';
import { seedStorefrontIfEmpty } from '../lib/seed';
import type { PermissionKey, StaffMember, StaffRole, UserProfile } from '../types/ecommerce';

const BOOTSTRAPPED_ADMIN_EMAIL = 'srfad1811@gmail.com';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  staffMember: StaffMember | null;
  authReady: boolean;
  isBootstrappedAdmin: boolean;
  isStaff: boolean;
  staffRole: StaffRole | null;
  hasPermission: (perm: PermissionKey) => boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [staffMember, setStaffMember] = useState<StaffMember | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const syncUserRecords = useCallback(async (firebaseUser: User) => {
    const uid = firebaseUser.uid;
    const email = firebaseUser.email || '';
    const now = new Date().toISOString();

    // 1. Sync private customer profile
    const userRef = doc(db, 'users', uid);
    try {
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
      } else {
        const newProfile: UserProfile = {
          uid,
          email,
          displayName: firebaseUser.displayName || email.split('@')[0] || 'Nexora Member',
          photoURL: firebaseUser.photoURL || '',
          addresses: [],
          isBlocked: false,
          customerGroup: 'standard',
          loyaltyPoints: 0,
          totalSpent: 0,
          orderCount: 0,
          createdAt: now,
          updatedAt: now,
        };
        await setDoc(userRef, newProfile);
        setProfile(newProfile);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `users/${uid}`);
    }

    // 2. Check staff RBAC assignment
    const isBootstrap = email === BOOTSTRAPPED_ADMIN_EMAIL && firebaseUser.emailVerified;
    const staffRef = doc(db, 'staff', uid);
    try {
      const staffSnap = await getDoc(staffRef);
      if (staffSnap.exists()) {
        const staffData = staffSnap.data() as StaffMember;
        setStaffMember(staffData);
        if (staffData.active) {
          updateDoc(staffRef, { lastLoginAt: now }).catch(() => {});
        }
      } else if (isBootstrap) {
        const bootstrapStaff: StaffMember = {
          uid,
          email,
          name: firebaseUser.displayName || 'Store Super Admin',
          role: 'super_admin',
          permissions: ROLE_PERMISSIONS.super_admin,
          active: true,
          twoFactorEnabled: false,
          lastLoginAt: now,
          createdAt: now,
        };
        await setDoc(staffRef, bootstrapStaff);
        setStaffMember(bootstrapStaff);
      } else {
        setStaffMember(null);
      }
    } catch {
      // Non-staff user reading missing staff/{uid} or permission check
      setStaffMember(null);
    }

    // 3. Auto-seed storefront on first admin sign-in if catalog is empty
    if (isBootstrap) {
      seedStorefrontIfEmpty(false).catch((e) => console.error('Auto-seed skipped:', e));
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await syncUserRecords(firebaseUser);
      } else {
        setProfile(null);
        setStaffMember(null);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, [syncUserRecords]);

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleAuthProvider);
  };

  const logout = async () => {
    await signOut(auth);
    setProfile(null);
    setStaffMember(null);
  };

  const refreshProfile = async () => {
    if (!user) return;
    await syncUserRecords(user);
  };

  const getIdToken = async () => {
    if (!user) return null;
    return user.getIdToken();
  };

  const isBootstrappedAdmin = Boolean(
    user && user.email === BOOTSTRAPPED_ADMIN_EMAIL && user.emailVerified
  );
  const isStaff = Boolean(isBootstrappedAdmin || (staffMember && staffMember.active));
  const staffRole: StaffRole | null = isBootstrappedAdmin
    ? 'super_admin'
    : staffMember?.active
    ? staffMember.role
    : null;

  const hasPermission = useCallback(
    (perm: PermissionKey): boolean => {
      if (isBootstrappedAdmin) return true;
      if (!staffMember || !staffMember.active) return false;
      const rolePerms = ROLE_PERMISSIONS[staffMember.role] || [];
      const customPerms = staffMember.permissions || [];
      return rolePerms.includes(perm) || customPerms.includes(perm);
    },
    [isBootstrappedAdmin, staffMember]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        staffMember,
        authReady,
        isBootstrappedAdmin,
        isStaff,
        staffRole,
        hasPermission,
        signInWithGoogle,
        logout,
        refreshProfile,
        getIdToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
