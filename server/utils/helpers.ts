import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export const BCRYPT_ROUNDS = 12;

export const DEFAULT_SECURITY_DEPOSIT_1_BDT = 825;
export const DEFAULT_SECURITY_DEPOSIT_2_BDT = 1825;
export const DEFAULT_SECURITY_DEPOSIT_EXTRA_BDT = 1000;

export const DEFAULT_PUBLIC_SETTINGS: Record<string, string> = {
  site_name: 'GO PAY BD',
  site_tagline: 'Manage. Earn. Connect.',
  currency_code: 'BDT',
  currency_symbol: '৳',
  support_email: 'support@gopaybd.com',
  support_phone: '+880 1700-000000',
  telegram_link: 'https://t.me/gopaybd',
  whatsapp_link: 'https://wa.me/8801700000000',
  facebook_link: 'https://facebook.com/gopaybd',
  footer_text: '© 2026 GO PAY BD. Verified Bangladesh Digital Wallet, Referral & Financial Ledger Platform.',
  announcement_banner: 'Welcome to GO PAY BD — Instant wallet ledger, verified deposits & transparent referral commissions.',
  min_deposit: '100',
  max_deposit: '500000',
  min_withdrawal: '300',
  max_withdrawal: '200000',
  withdrawal_fee_type: 'percentage',
  withdrawal_fee: '1.5',
  daily_withdrawal_limit: '100000',
  withdrawal_processing_time: '15–60 minutes during business hours',
  deposit_enabled: 'true',
  withdrawal_enabled: 'true',
  registration_enabled: 'true',
  commission_type: 'percentage',
  level_1_commission: '7',
  level_2_commission: '3',
  min_qualifying_order: '100',
  commission_cap: '50000',
  commission_approval_mode: 'auto',
  referral_enabled: 'true',
  commission_enabled: 'true',
  maintenance_mode: 'false',
  invoice_prefix: 'GPBD-INV',
  security_deposit_enabled: 'true',
  security_deposit_1_account: String(DEFAULT_SECURITY_DEPOSIT_1_BDT),
  security_deposit_2_accounts: String(DEFAULT_SECURITY_DEPOSIT_2_BDT),
  security_deposit_extra_account: String(DEFAULT_SECURITY_DEPOSIT_EXTRA_BDT),
};

export function toPaisa(amount: number | string): number {
  const num = typeof amount === 'string' ? Number(amount.trim()) : amount;
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100);
}

export function fromPaisa(paisa: number | string | null | undefined): number {
  const val = Number(paisa || 0);
  if (!Number.isFinite(val)) return 0;
  return Number((val / 100).toFixed(2));
}

export function formatMoneyFixed(paisa: number): string {
  return (Number(paisa || 0) / 100).toFixed(2);
}

export function sanitizeText(value: unknown, maxLen = 500): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\0/g, '').trim().slice(0, maxLen);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function isValidBdPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s-]/g, '');
  return /^(\+?8801|01)[3-9]\d{8}$/.test(cleaned);
}

export function isValidAccountNumber(methodType: string, accountNumber: string): boolean {
  const cleaned = accountNumber.replace(/[\s-]/g, '');
  const m = methodType.toLowerCase();
  if (m.includes('bank')) {
    return /^[0-9A-Za-z]{6,32}$/.test(cleaned);
  }
  if (m.includes('rocket')) {
    return /^(\+?88)?01[3-9]\d{8,9}$/.test(cleaned);
  }
  return /^(\+?88)?01[3-9]\d{8}$/.test(cleaned);
}

export function genId(prefix = 'id'): string {
  return `${prefix}_${crypto.randomBytes(10).toString('hex')}`;
}

export function genCode(prefix: string, digits = 6): string {
  const rand = crypto.randomInt(Math.pow(10, digits - 1), Math.pow(10, digits));
  return `${prefix}-${rand}`;
}

export function genReferralCode(username: string): string {
  const base = username.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6) || 'GPBD';
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${base}${suffix}`;
}

export function normalizeTrxKey(trx: string): string {
  return trx.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 120);
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string | null | undefined): Promise<boolean> {
  if (!plain || !hash) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

export function createVaultPasscodeHash(passcode: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(passcode, salt, 120000, 32, 'sha256').toString('hex');
  return { salt, hash };
}

export function verifyVaultPasscode(passcode: string, salt: string, expectedHash: string): boolean {
  if (!passcode || !salt || !expectedHash) return false;
  try {
    const derived = crypto.pbkdf2Sync(passcode, salt, 120000, 32, 'sha256');
    const expected = Buffer.from(expectedHash, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function timingSafeStringEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function computeSecurityDepositRequirement(
  existingActiveCount: number,
  settings: Record<string, string>
): { enabled: boolean; requiredBdt: number; requiredPaisa: number; nextSlot: number } {
  const enabled = settings.security_deposit_enabled !== 'false';
  const nextSlot = existingActiveCount + 1;
  if (!enabled) {
    return { enabled: false, requiredBdt: 0, requiredPaisa: 0, nextSlot };
  }
  const tier1 = Math.max(0, Number(settings.security_deposit_1_account ?? DEFAULT_SECURITY_DEPOSIT_1_BDT) || DEFAULT_SECURITY_DEPOSIT_1_BDT);
  const tier2 = Math.max(0, Number(settings.security_deposit_2_accounts ?? DEFAULT_SECURITY_DEPOSIT_2_BDT) || DEFAULT_SECURITY_DEPOSIT_2_BDT);
  const extra = Math.max(0, Number(settings.security_deposit_extra_account ?? DEFAULT_SECURITY_DEPOSIT_EXTRA_BDT) || DEFAULT_SECURITY_DEPOSIT_EXTRA_BDT);

  let requiredBdt = tier1;
  if (nextSlot === 1) {
    requiredBdt = tier1;
  } else if (nextSlot === 2) {
    requiredBdt = tier2;
  } else {
    requiredBdt = tier2 + (nextSlot - 2) * extra;
  }
  return {
    enabled: true,
    requiredBdt,
    requiredPaisa: toPaisa(requiredBdt),
    nextSlot,
  };
}

export function toIso(val: Date | string | null | undefined): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  const str = String(val);
  if (str.includes('T')) return str;
  return new Date(str.replace(' ', 'T') + 'Z').toISOString();
}

export function getClientIp(req: any): string {
  const fwd = req.headers?.['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0].trim().slice(0, 64);
  }
  return String(req.ip || req.socket?.remoteAddress || 'unknown').slice(0, 64);
}

export function parsePermissions(jsonText: string | null | undefined): string[] {
  if (!jsonText) return [];
  try {
    const parsed = JSON.parse(jsonText);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

// ============================================================================
// Standard API Object Mappers (preserving 100% of existing frontend field names)
// ============================================================================

export function mapWallet(w: any, extra?: { pendingCommissionPaisa?: number | string }) {
  const bal = fromPaisa(w?.balance_paisa);
  const locked = fromPaisa(w?.locked_balance_paisa);
  const pendingComm = fromPaisa(extra?.pendingCommissionPaisa ?? w?.pending_commission_paisa ?? 0);
  const totalDeposited = fromPaisa(w?.total_deposited_paisa);
  const totalWithdrawn = fromPaisa(w?.total_withdrawn_paisa);
  const totalCommission = fromPaisa(w?.total_commission_paisa);
  return {
    user_id: w?.user_id || '',
    balance: bal,
    available_balance: bal,
    locked_balance: locked,
    pending_balance: locked,
    pending_withdrawal: locked,
    pending_commission: pendingComm,
    total_balance: Number((bal + locked).toFixed(2)),
    total_deposited: totalDeposited,
    total_deposits: totalDeposited,
    total_withdrawn: totalWithdrawn,
    total_withdrawals: totalWithdrawn,
    total_commission: totalCommission,
    total_earnings: totalCommission,
    total_spent: fromPaisa(w?.total_spent_paisa),
    updated_at: toIso(w?.updated_at),
  };
}

export function mapUserPublic(u: any) {
  return {
    id: u.id,
    uid: u.uid,
    full_name: u.full_name,
    username: u.username,
    email: u.email,
    phone: u.phone,
    referral_code: u.referral_code,
    referred_by: u.referred_by || null,
    sponsor_uid: u.sponsor_uid || null,
    sponsor_username: u.sponsor_username || null,
    status: u.status,
    role: u.role || 'user',
    preferred_language: u.preferred_language || 'en',
    avatar_url: u.avatar_url || null,
    admin_note: u.admin_note || '',
    last_login_at: toIso(u.last_login_at),
    created_at: toIso(u.created_at),
  };
}

export function mapTransaction(t: any) {
  const before = fromPaisa(t.balance_before_paisa);
  const after = fromPaisa(t.balance_after_paisa);
  return {
    id: t.id,
    tx_uid: t.tx_uid,
    user_id: t.user_id,
    full_name: t.full_name,
    user_name: t.full_name,
    username: t.username,
    user_uid: t.user_uid,
    type: t.type,
    tx_type: t.type,
    direction: t.direction,
    amount: fromPaisa(t.amount_paisa),
    balance_before: before,
    previous_balance: before,
    balance_after: after,
    new_balance: after,
    reference_type: t.reference_type,
    reference_id: t.reference_id,
    payment_method: t.payment_method,
    sender_number: t.sender_number,
    receiver_number: t.receiver_number,
    receiving_number: t.receiver_number,
    description: t.description,
    status: t.status,
    created_at: toIso(t.created_at),
  };
}

export function mapDeposit(d: any) {
  const processedAt = toIso(d.reviewed_at);
  return {
    id: d.id,
    deposit_uid: d.deposit_uid,
    user_id: d.user_id,
    full_name: d.full_name,
    user_name: d.full_name,
    username: d.username,
    user_uid: d.user_uid,
    email: d.email,
    payment_method: d.payment_method,
    payment_setting_id: d.payment_setting_id,
    account_type: d.account_type,
    amount: fromPaisa(d.amount_paisa),
    sender_number: d.sender_number,
    receiver_number: d.receiver_number,
    receiving_number: d.receiver_number,
    transaction_id: d.transaction_id,
    screenshot_url: d.screenshot_url || null,
    screenshot_path: d.screenshot_url || null,
    note: d.note || '',
    user_note: d.note || '',
    status: d.status,
    admin_note: d.admin_note || '',
    processing_eta: d.processing_eta || '',
    rejection_reason: d.status === 'rejected' ? (d.admin_note || '') : '',
    reviewed_by: d.reviewed_by || null,
    reviewed_at: processedAt,
    processed_at: processedAt,
    processed_by_name: d.reviewed_by_name || null,
    created_at: toIso(d.created_at),
    updated_at: toIso(d.updated_at),
  };
}

export function mapWithdrawal(w: any) {
  const paidDateStr = w.payment_date
    ? String(w.payment_date).slice(0, 10)
    : w.paid_at
    ? toIso(w.paid_at)?.slice(0, 10) || null
    : null;
  return {
    id: w.id,
    withdrawal_uid: w.withdrawal_uid,
    user_id: w.user_id,
    full_name: w.full_name,
    user_name: w.full_name,
    username: w.username,
    user_uid: w.user_uid,
    email: w.email,
    payment_method_id: w.payment_method_id,
    payment_method: w.payment_method,
    account_number: w.account_number,
    account_holder_name: w.account_holder_name,
    account_type: w.account_type,
    amount: fromPaisa(w.amount_paisa),
    fee: fromPaisa(w.fee_paisa),
    net_amount: fromPaisa(w.net_amount_paisa),
    paid_amount: fromPaisa(w.paid_amount_paisa ?? w.net_amount_paisa),
    status: w.status,
    payout_reference: w.payout_reference || '',
    payout_tx_id: w.payout_reference || '',
    admin_note: w.admin_note || '',
    rejection_reason: w.status === 'rejected' ? (w.admin_note || '') : '',
    reviewed_by: w.reviewed_by || null,
    reviewed_at: toIso(w.reviewed_at),
    paid_at: toIso(w.paid_at),
    payment_date: paidDateStr,
    created_at: toIso(w.created_at),
    updated_at: toIso(w.updated_at),
  };
}

export function mapPaymentSetting(ps: any) {
  const active = Boolean(ps.is_active);
  const wdEnabled = ps.withdrawal_enabled === undefined ? true : Boolean(ps.withdrawal_enabled);
  return {
    id: ps.id,
    method_type: ps.method_type,
    method_name: ps.method_type,
    account_title: ps.account_title,
    account_holder_name: ps.account_title,
    account_number: ps.account_number,
    receiving_number: ps.account_number,
    account_type: ps.account_type,
    bank_name: ps.bank_name || '',
    branch_name: ps.branch_name || '',
    routing_number: ps.routing_number || '',
    instructions: ps.instructions || '',
    min_deposit: fromPaisa(ps.min_deposit_paisa),
    max_deposit: fromPaisa(ps.max_deposit_paisa),
    is_active: active,
    deposit_enabled: active,
    withdrawal_enabled: wdEnabled,
    display_order: Number(ps.display_order || 0),
    created_at: toIso(ps.created_at),
    updated_at: toIso(ps.updated_at),
  };
}

export function mapPaymentMethod(pm: any) {
  return {
    id: pm.id,
    user_id: pm.user_id,
    full_name: pm.full_name,
    user_name: pm.full_name,
    username: pm.username,
    user_uid: pm.user_uid,
    method_type: pm.method_type,
    method_name: pm.method_type,
    account_label: pm.account_label,
    account_number: pm.account_number,
    account_holder_name: pm.account_holder_name,
    account_type: pm.account_type,
    bank_name: pm.bank_name || '',
    branch_name: pm.branch_name || '',
    routing_number: pm.routing_number || '',
    notes: pm.notes || '',
    is_default: Boolean(pm.is_default),
    verification_status: pm.verification_status || 'active',
    has_pin: Boolean(pm.pin_hash),
    status: pm.status,
    created_at: toIso(pm.created_at),
    updated_at: toIso(pm.updated_at),
  };
}

export function mapOrder(o: any) {
  const total = fromPaisa(o.total_amount_paisa);
  return {
    id: o.id,
    order_uid: o.order_uid,
    order_number: o.order_uid,
    user_id: o.user_id,
    full_name: o.full_name,
    user_name: o.full_name,
    username: o.username,
    user_uid: o.user_uid,
    product_id: o.product_id,
    product_name: o.product_name,
    quantity: Number(o.quantity || 1),
    unit_price: fromPaisa(o.unit_price_paisa),
    subtotal: fromPaisa(o.subtotal_paisa),
    discount: fromPaisa(o.discount_paisa),
    fee: fromPaisa(o.fee_paisa),
    total_amount: total,
    total,
    payment_source: o.payment_source,
    payment_status: o.status === 'refunded' ? 'refunded' : o.status === 'cancelled' ? 'cancelled' : 'paid',
    status: o.status,
    order_status: o.status,
    commission_status: o.commission_status || 'none',
    notes: o.notes || '',
    admin_note: o.notes || '',
    invoice_id: o.invoice_id || null,
    invoice_number: o.invoice_number || null,
    created_at: toIso(o.created_at),
    updated_at: toIso(o.updated_at),
  };
}

export function mapInvoice(inv: any) {
  let rawItems: any[] = [];
  try {
    rawItems = typeof inv.items_json === 'string' ? JSON.parse(inv.items_json) : inv.items_json || [];
  } catch {
    rawItems = [];
  }
  const items = Array.isArray(rawItems)
    ? rawItems.map((it: any, idx: number) => ({
        id: it?.id ?? idx + 1,
        sku: it?.sku || '',
        item_name: it?.item_name || it?.name || 'Service Item',
        name: it?.name || it?.item_name || 'Service Item',
        quantity: Number(it?.quantity || 1),
        unit_price: Number(it?.unit_price || 0),
        line_total: Number(it?.line_total ?? it?.subtotal ?? 0),
        subtotal: Number(it?.subtotal ?? it?.line_total ?? 0),
      }))
    : [];

  const issuedIso = toIso(inv.issued_at);
  const dueStr = inv.due_date
    ? String(inv.due_date).slice(0, 10)
    : issuedIso
    ? issuedIso.slice(0, 10)
    : '';
  return {
    id: inv.id,
    invoice_number: inv.invoice_number,
    order_id: inv.order_id,
    order_uid: inv.order_uid || null,
    order_number: inv.order_uid || null,
    user_id: inv.user_id,
    customer_uid: inv.customer_uid || inv.user_uid || '',
    customer_name: inv.customer_name,
    customer_email: inv.customer_email,
    customer_phone: inv.customer_phone,
    customer_contact: inv.customer_contact || inv.customer_phone || inv.customer_email || '',
    items,
    subtotal: fromPaisa(inv.subtotal_paisa),
    discount: fromPaisa(inv.discount_paisa),
    fee: fromPaisa(inv.fee_paisa),
    tax: fromPaisa(inv.tax_paisa),
    total: fromPaisa(inv.total_paisa),
    payment_status: inv.payment_status,
    invoice_status: inv.invoice_status || inv.payment_status || 'paid',
    payment_method: inv.payment_method || 'wallet',
    invoice_date: issuedIso ? issuedIso.slice(0, 10) : '',
    due_date: dueStr,
    issued_at: issuedIso,
    notes: inv.notes || '',
    created_at: toIso(inv.created_at),
  };
}

export function mapCommission(c: any) {
  const amt = fromPaisa(c.commission_amount_paisa);
  const base = fromPaisa(c.base_amount_paisa);
  return {
    id: c.id,
    commission_uid: c.commission_uid,
    earner_user_id: c.earner_user_id,
    earner_name: c.earner_name,
    earner_username: c.earner_username,
    beneficiary_username: c.earner_username || c.beneficiary_username || '',
    source_user_id: c.source_user_id,
    source_name: c.source_name,
    source_username: c.source_username,
    order_id: c.order_id,
    order_uid: c.order_uid || null,
    order_number: c.order_uid || 'MANUAL',
    level: Number(c.level || 1),
    referral_level: Number(c.level || 1),
    rate_percent: Number(c.rate_percent || 0),
    rate_value: Number(c.rate_percent || 0),
    rate_type: 'percentage',
    base_amount: base,
    order_amount: base,
    commission_amount: amt,
    status: c.status,
    note: c.note || '',
    admin_note: c.note || '',
    credited_at: toIso(c.credited_at),
    created_at: toIso(c.created_at),
  };
}
