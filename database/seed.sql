-- ============================================================================
-- GO PAY BD — Idempotent Production Seed Data
-- Safe to run multiple times: uses INSERT IGNORE and never overwrites admin edits
-- ============================================================================

SET NAMES utf8mb4;

-- 1. Default RBAC Admin Roles
INSERT IGNORE INTO `admin_roles` (`id`, `slug`, `name`, `description`, `permissions_json`) VALUES
  (1, 'super_admin', 'Super Admin', 'Full unrestricted system, financial, RBAC, and settings control', '["*"]'),
  (2, 'finance_admin', 'Finance Admin', 'Manage deposits, withdrawals, wallets, commissions, invoices, and financial reports', '["dashboard","deposits","withdrawals","wallets","transactions","commissions","invoices","reports","payment_settings","notifications"]'),
  (3, 'support_admin', 'Support Admin', 'Manage support tickets, member inquiries, and view user/order histories', '["dashboard","users","orders","invoices","support","notifications"]'),
  (4, 'manager', 'Operations Manager', 'View operational metrics, users, referrals, orders, and financial reports', '["dashboard","users","orders","referrals","commissions","transactions","invoices","reports","support","notifications"]');

-- 2. Default Dynamic Platform Settings (exact keys consumed by Public & Admin UI)
INSERT IGNORE INTO `platform_settings` (`setting_key`, `setting_value`) VALUES
  ('site_name', 'GO PAY BD'),
  ('site_tagline', 'Manage. Earn. Connect.'),
  ('currency_code', 'BDT'),
  ('currency_symbol', '৳'),
  ('support_email', 'support@gopaybd.com'),
  ('support_phone', '+880 1700-000000'),
  ('telegram_link', 'https://t.me/gopaybd'),
  ('whatsapp_link', 'https://wa.me/8801700000000'),
  ('facebook_link', 'https://facebook.com/gopaybd'),
  ('footer_text', '© 2026 GO PAY BD. Verified Bangladesh Digital Wallet, Referral & Financial Ledger Platform.'),
  ('announcement_banner', 'Welcome to GO PAY BD — Instant wallet ledger, verified deposits & transparent referral commissions.'),
  ('min_deposit', '100'),
  ('max_deposit', '500000'),
  ('min_withdrawal', '300'),
  ('max_withdrawal', '200000'),
  ('withdrawal_fee_type', 'percentage'),
  ('withdrawal_fee', '1.5'),
  ('daily_withdrawal_limit', '100000'),
  ('withdrawal_processing_time', '15–60 minutes during business hours'),
  ('deposit_enabled', 'true'),
  ('withdrawal_enabled', 'true'),
  ('registration_enabled', 'true'),
  ('commission_type', 'percentage'),
  ('level_1_commission', '7'),
  ('level_2_commission', '3'),
  ('min_qualifying_order', '100'),
  ('commission_cap', '50000'),
  ('commission_approval_mode', 'auto'),
  ('referral_enabled', 'true'),
  ('commission_enabled', 'true'),
  ('maintenance_mode', 'false'),
  ('invoice_prefix', 'GPBD-INV'),
  ('security_deposit_enabled', 'true'),
  ('security_deposit_1_account', '825'),
  ('security_deposit_2_accounts', '1825'),
  ('security_deposit_extra_account', '1000');

-- 3. Default Official Deposit Receiving Channels (editable in Admin Payment Settings)
INSERT IGNORE INTO `payment_settings`
  (`id`, `method_type`, `account_title`, `account_number`, `account_type`, `bank_name`, `branch_name`, `routing_number`, `instructions`, `min_deposit_paisa`, `max_deposit_paisa`, `is_active`, `display_order`)
VALUES
  ('pay_bkash', 'bKash', 'GO PAY BD Official bKash', '01711000001', 'personal', NULL, NULL, NULL, 'Send Money to this Personal bKash number and submit your 10-character Transaction ID (TrxID) with payment screenshot.', 10000, 25000000, 1, 1),
  ('pay_nagad', 'Nagad', 'GO PAY BD Official Nagad', '01811000002', 'personal', NULL, NULL, NULL, 'Send Money via Nagad App (*167#) and submit the exact sender number & TrxID.', 10000, 25000000, 1, 2),
  ('pay_rocket', 'Rocket', 'GO PAY BD Official Rocket', '019110000038', 'personal', NULL, NULL, NULL, 'Transfer via Dutch-Bangla Rocket and enter your 12-digit Rocket number and TrxID.', 10000, 25000000, 1, 3),
  ('pay_upay', 'Upay', 'GO PAY BD Official Upay', '01611000004', 'personal', NULL, NULL, NULL, 'Send Money via Upay app and upload screenshot proof.', 10000, 20000000, 1, 4),
  ('pay_bank', 'Bank Transfer', 'GO PAY BD Technologies Ltd', '1021200045891', 'bank', 'Dutch-Bangla Bank PLC', 'Gulshan Avenue Branch, Dhaka', '090261726', 'Deposit via NPSB/BEFTN/RTGS and enter your bank reference number & transfer slip.', 50000, 50000000, 1, 5);

-- 4. Default Service Catalog Products
INSERT IGNORE INTO `catalog_products`
  (`id`, `sku`, `name`, `category`, `description`, `price_paisa`, `commission_eligible`, `is_active`)
VALUES
  ('prod_starter', 'GP-PRO-01', 'GO PAY BD Starter Merchant Package', 'membership', 'Verified digital commerce access with priority deposit clearing and instant invoice tools.', 150000, 1, 1),
  ('prod_growth', 'GP-BIZ-02', 'Business Growth Digital Suite', 'package', 'Expanded transaction limits, automated billing statements, and dedicated partner support.', 450000, 1, 1),
  ('prod_enterprise', 'GP-ENT-03', 'Enterprise API & Settlement Plan', 'enterprise', 'Full enterprise financial settlement toolkit, priority payout routing, and multi-channel reports.', 1200000, 1, 1),
  ('prod_credit', 'GP-DIG-04', 'Digital Service Credit Bundle', 'digital', 'Prepaid commerce service credits usable across verified partner listings.', 80000, 1, 1);

-- 5. Default Atomic Invoice Counter
INSERT IGNORE INTO `counters` (`counter_key`, `current_value`) VALUES
  ('invoice_seq', 1000);
