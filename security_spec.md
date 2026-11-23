# Nexora Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Identity Isolation**: A customer can only read/write their own `users/{uid}`, `carts/{uid}`, `wishlists/{uid}`, `orders`, `returnRequests`, `supportTickets`, and `notifications`.
2. **No Self-Assigned Privileges**: A user cannot create or modify `staff/{uid}` unless they are the verified bootstrapped admin or an active `super_admin`. A user cannot modify `isBlocked`, `loyaltyPoints`, `totalSpent`, `orderCount`, or `customerGroup` on their own `users/{uid}` profile.
3. **Public vs. Draft Catalog**: Public visitors may only read `products` where `status == 'active'`. Draft, pending, and archived products are restricted to staff.
4. **Verified Auth & Strict Key Allowlisting**: All authenticated writes require `request.auth.token.email_verified == true` and strict `keys().hasAll(...) && keys().hasOnly(...)` schema checks on create, plus `affectedKeys().hasOnly(...)` on update.
5. **Immutable Audit Trail**: `activityLogs` are append-only by staff and cannot be edited or deleted.

## 2. Dirty Dozen Attack Payloads (Expected: PERMISSION_DENIED)
1. **Shadow Field Injection on Profile**: User creates `users/{uid}` with extra `isAdmin: true` field.
2. **Privilege Escalation on Staff**: Customer creates `staff/{uid}` with `role: 'super_admin'`.
3. **Unverified Email Spoofing**: Token with `email: 'srfad1811@gmail.com'` and `email_verified: false` attempts admin write.
4. **PII Blanket Read**: Signed-in non-admin attempts `get` or `list` on another user's `users/{otherUid}`.
5. **Cross-Customer Order Scraping**: Customer lists `orders` without `userId == request.auth.uid` filter.
6. **Cart Hijacking**: User writes to `carts/{otherUid}`.
7. **Review Status Spoofing**: Customer creates `reviews/{id}` with `status: 'approved'` directly bypassing moderation or sets `userId` to another user.
8. **Resource Poisoning**: Attacker passes a 2,000-char document ID or 50,000-char string description.
9. **Terminal Order Tampering**: Customer updates `orders/{id}` to `paymentStatus: 'paid'` or `total: 1`.
10. **Audit Log Deletion**: Staff attempts `delete` on `activityLogs/{id}`.
11. **Draft Product Leak**: Public visitor queries `products` where `status == 'draft'`.
12. **Coupon Forgery**: Customer attempts `create` or `update` on `coupons/{id}`.
