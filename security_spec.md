# GO PAY BD Firestore Security Specification (Phase 0)

## 1. Core Data Invariants
1. **Zero-Balance Wallet Creation**: Users can only initialize their own `/wallets/{uid}` with `availablePaisa == 0`, `pendingWithdrawalPaisa == 0`, and all totals `== 0`. Free balance minting is mathematically blocked.
2. **Wallet Conservation & Deduction-Only User Writes**: Regular users can NEVER increase `availablePaisa + pendingWithdrawalPaisa`. They may only:
   - Reserve/release funds between `availablePaisa` and `pendingWithdrawalPaisa` (sum preserved), OR
   - Spend from `availablePaisa` for a paid order (`availablePaisa` strictly decreases, `totalSpentPaisa` increases by the exact delta).
3. **Deposit Integrity**: Users may only create `/deposits/{id}` with `status == 'pending'`. Users can NEVER approve their own deposits or credit their own wallets. Duplicate Transaction IDs are blocked via `/deposit_trx_index/{trxId}`.
4. **Immutable Ledger & Audit Logs**: `/wallet_transactions/{id}` and `/audit_logs/{id}` forbid all updates and deletes.
5. **PII Isolation**: `/users/{uid}` is readable ONLY by the owner (`request.auth.uid == userId`) or a verified admin (`isAdmin()`). Public referral lookups use `/public_referrals/{code}` which stores zero PII.
6. **Master Gate on Subcollections**: `/support_tickets/{ticketId}/messages/{messageId}` performs a parent `get()` on `/support_tickets/{ticketId}` to verify ownership or admin role.
7. **Verified Admin & Role Immutability**: `isAdmin()` requires `request.auth.token.email_verified == true` and either the bootstrapped Super Admin email (`sozibhasan416@gmail.com`) or an active `/admins/{uid}` document. Users can never elevate `role` or `status`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Self-Admin Escalation**: `setDoc('/users/attacker', { role: 'admin', ... })` -> DENIED (`role == 'user'` enforced).
2. **Free Money Wallet Creation**: `setDoc('/wallets/attacker', { availablePaisa: 10000000, ... })` -> DENIED (`availablePaisa == 0` enforced on create).
3. **Wallet Balance Inflation**: `updateDoc('/wallets/attacker', { availablePaisa: 999999 })` -> DENIED (total balance conservation violated).
4. **Self-Approve Deposit**: `updateDoc('/deposits/dep1', { status: 'approved' })` -> DENIED (only `isAdmin()` can update deposits).
5. **Duplicate Transaction ID Replay**: `setDoc('/deposit_trx_index/TRX999', { ... })` when doc exists -> DENIED (`allow update: if false`).
6. **Shadow Field Injection**: `updateDoc('/users/attacker', { fullName: 'Bob', isVerifiedAdmin: true })` -> DENIED (`affectedKeys().hasOnly(...)`).
7. **PII Blanket Read / Scraping**: `getDocs('/users')` as non-admin -> DENIED (`resource.data.authUid == request.auth.uid`).
8. **Cross-User Ticket Message Snooping**: `getDoc('/support_tickets/victimTicket/messages/m1')` as attacker -> DENIED (Master Gate parent check).
9. **Terminal Withdrawal Mutation**: `updateDoc('/withdrawals/w1', { status: 'cancelled' })` when existing status is `'paid'` -> DENIED (terminal state lock).
10. **Ledger Tampering**: `updateDoc('/wallet_transactions/tx1', { amountPaisa: 0 })` -> DENIED (ledger is append-only).
11. **Unverified Email Spoofing**: Admin check with `email: 'sozibhasan416@gmail.com', email_verified: false` -> DENIED (`email_verified == true` enforced).
12. **ID Poisoning / Resource Exhaustion**: `setDoc('/payment_methods/' + 'A'.repeat(2000), ...)` -> DENIED (`isValidId()` <= 128 chars).
