-- ============================================================================
-- GO PAY BD — Production MySQL Database Schema
-- Compatible with MySQL 8.0+ and MariaDB 10.6+ (cPanel Shared & VPS Hosting)
-- All monetary amounts are stored as BIGINT in paisa (100 paisa = 1.00 BDT)
-- Safe to run multiple times (idempotent CREATE TABLE IF NOT EXISTS)
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET foreign_key_checks = 1;

-- 1. Admin Roles (RBAC)
CREATE TABLE IF NOT EXISTS `admin_roles` (
  `id` INT NOT NULL PRIMARY KEY,
  `slug` VARCHAR(64) NOT NULL UNIQUE,
  `name` VARCHAR(120) NOT NULL,
  `description` VARCHAR(255) NOT NULL DEFAULT '',
  `permissions_json` TEXT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Admin Staff Accounts
CREATE TABLE IF NOT EXISTS `admins` (
  `id` VARCHAR(128) NOT NULL PRIMARY KEY,
  `admin_uid` VARCHAR(64) NOT NULL UNIQUE,
  `full_name` VARCHAR(160) NOT NULL,
  `email` VARCHAR(191) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `pin_hash` VARCHAR(255) NULL,
  `role_id` INT NOT NULL DEFAULT 1,
  `status` ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
  `failed_attempts` INT NOT NULL DEFAULT 0,
  `locked_until` DATETIME NULL,
  `last_login_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_admins_role_id` (`role_id`),
  KEY `idx_admins_status` (`status`),
  CONSTRAINT `fk_admins_role` FOREIGN KEY (`role_id`) REFERENCES `admin_roles`(`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Admin Security Vault (stores rotated shared Control Center password hash + brute-force lockout)
CREATE TABLE IF NOT EXISTS `admin_security_vault` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `passcode_salt` VARCHAR(128) NOT NULL,
  `passcode_hash` VARCHAR(255) NOT NULL,
  `failed_attempts` INT NOT NULL DEFAULT 0,
  `locked_until` DATETIME NULL,
  `updated_by_uid` VARCHAR(128) NULL,
  `updated_by_email` VARCHAR(191) NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Platform Users
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(128) NOT NULL PRIMARY KEY,
  `uid` VARCHAR(64) NOT NULL UNIQUE,
  `full_name` VARCHAR(160) NOT NULL,
  `username` VARCHAR(64) NOT NULL UNIQUE,
  `email` VARCHAR(191) NOT NULL UNIQUE,
  `phone` VARCHAR(32) NOT NULL DEFAULT '',
  `password_hash` VARCHAR(255) NULL,
  `password_reset_required` TINYINT(1) NOT NULL DEFAULT 0,
  `google_id` VARCHAR(191) NULL UNIQUE,
  `referral_code` VARCHAR(64) NOT NULL UNIQUE,
  `referred_by` VARCHAR(128) NULL,
  `sponsor_username` VARCHAR(64) NULL,
  `status` ENUM('active', 'suspended', 'pending') NOT NULL DEFAULT 'active',
  `role` VARCHAR(32) NOT NULL DEFAULT 'user',
  `preferred_language` VARCHAR(8) NOT NULL DEFAULT 'en',
  `avatar_url` MEDIUMTEXT NULL,
  `address` VARCHAR(255) NOT NULL DEFAULT '',
  `city` VARCHAR(120) NOT NULL DEFAULT '',
  `notification_email` TINYINT(1) NOT NULL DEFAULT 1,
  `notification_inapp` TINYINT(1) NOT NULL DEFAULT 1,
  `admin_note` TEXT NULL,
  `failed_attempts` INT NOT NULL DEFAULT 0,
  `locked_until` DATETIME NULL,
  `last_login_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_users_phone` (`phone`),
  KEY `idx_users_referred_by` (`referred_by`),
  KEY `idx_users_status` (`status`),
  KEY `idx_users_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. User Wallets (strict integer paisa accounting)
CREATE TABLE IF NOT EXISTS `wallets` (
  `user_id` VARCHAR(128) NOT NULL PRIMARY KEY,
  `balance_paisa` BIGINT NOT NULL DEFAULT 0,
  `locked_balance_paisa` BIGINT NOT NULL DEFAULT 0,
  `total_deposited_paisa` BIGINT NOT NULL DEFAULT 0,
  `total_withdrawn_paisa` BIGINT NOT NULL DEFAULT 0,
  `total_commission_paisa` BIGINT NOT NULL DEFAULT 0,
  `total_spent_paisa` BIGINT NOT NULL DEFAULT 0,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_wallets_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Wallet Ledger Transactions (immutable audit trail)
CREATE TABLE IF NOT EXISTS `wallet_transactions` (
  `id` VARCHAR(128) NOT NULL PRIMARY KEY,
  `tx_uid` VARCHAR(64) NOT NULL UNIQUE,
  `user_id` VARCHAR(128) NOT NULL,
  `type` VARCHAR(64) NOT NULL,
  `direction` ENUM('credit', 'debit') NOT NULL,
  `amount_paisa` BIGINT NOT NULL,
  `balance_before_paisa` BIGINT NOT NULL,
  `balance_after_paisa` BIGINT NOT NULL,
  `reference_type` VARCHAR(64) NULL,
  `reference_id` VARCHAR(128) NULL,
  `payment_method` VARCHAR(64) NULL,
  `sender_number` VARCHAR(64) NULL,
  `receiver_number` VARCHAR(64) NULL,
  `description` TEXT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'completed',
  `created_by_admin_id` VARCHAR(128) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_wtx_user_created` (`user_id`, `created_at`),
  KEY `idx_wtx_type` (`type`),
  KEY `idx_wtx_ref` (`reference_type`, `reference_id`),
  KEY `idx_wtx_sender` (`sender_number`),
  KEY `idx_wtx_receiver` (`receiver_number`),
  KEY `idx_wtx_created` (`created_at`),
  CONSTRAINT `fk_wtx_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Official Receiving Payment Settings (bKash, Nagad, Rocket, Upay, Bank)
CREATE TABLE IF NOT EXISTS `payment_settings` (
  `id` VARCHAR(128) NOT NULL PRIMARY KEY,
  `method_type` VARCHAR(64) NOT NULL,
  `account_title` VARCHAR(160) NOT NULL,
  `account_number` VARCHAR(64) NOT NULL,
  `account_type` VARCHAR(32) NOT NULL DEFAULT 'personal',
  `bank_name` VARCHAR(160) NULL,
  `branch_name` VARCHAR(160) NULL,
  `routing_number` VARCHAR(64) NULL,
  `instructions` TEXT NULL,
  `min_deposit_paisa` BIGINT NOT NULL DEFAULT 10000,
  `max_deposit_paisa` BIGINT NOT NULL DEFAULT 50000000,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `withdrawal_enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `display_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_payset_active_order` (`is_active`, `display_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Deposits
CREATE TABLE IF NOT EXISTS `deposits` (
  `id` VARCHAR(128) NOT NULL PRIMARY KEY,
  `deposit_uid` VARCHAR(64) NOT NULL UNIQUE,
  `user_id` VARCHAR(128) NOT NULL,
  `payment_method` VARCHAR(64) NOT NULL,
  `payment_setting_id` VARCHAR(128) NULL,
  `account_type` VARCHAR(32) NULL,
  `amount_paisa` BIGINT NOT NULL,
  `sender_number` VARCHAR(64) NOT NULL,
  `receiver_number` VARCHAR(64) NOT NULL,
  `transaction_id` VARCHAR(128) NOT NULL,
  `screenshot_url` MEDIUMTEXT NULL,
  `note` TEXT NULL,
  `status` ENUM('pending', 'processing', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  `admin_note` TEXT NULL,
  `processing_eta` VARCHAR(120) NULL,
  `reviewed_by` VARCHAR(128) NULL,
  `reviewed_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_dep_user_created` (`user_id`, `created_at`),
  KEY `idx_dep_status` (`status`),
  KEY `idx_dep_trx` (`transaction_id`),
  KEY `idx_dep_sender` (`sender_number`),
  KEY `idx_dep_receiver` (`receiver_number`),
  KEY `idx_dep_created` (`created_at`),
  CONSTRAINT `fk_dep_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Unique Deposit Transaction ID Lock (anti-replay / anti-duplicate TrxID protection)
CREATE TABLE IF NOT EXISTS `deposit_transaction_locks` (
  `transaction_id` VARCHAR(128) NOT NULL PRIMARY KEY,
  `deposit_id` VARCHAR(128) NOT NULL,
  `user_id` VARCHAR(128) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. User Saved Withdrawal Payment Methods
CREATE TABLE IF NOT EXISTS `payment_methods` (
  `id` VARCHAR(128) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(128) NOT NULL,
  `method_type` VARCHAR(64) NOT NULL,
  `account_label` VARCHAR(160) NOT NULL,
  `account_number` VARCHAR(64) NOT NULL,
  `account_holder_name` VARCHAR(160) NOT NULL,
  `account_type` VARCHAR(32) NOT NULL DEFAULT 'personal',
  `bank_name` VARCHAR(160) NULL,
  `branch_name` VARCHAR(160) NULL,
  `routing_number` VARCHAR(64) NULL,
  `notes` TEXT NULL,
  `is_default` TINYINT(1) NOT NULL DEFAULT 0,
  `verification_status` VARCHAR(32) NOT NULL DEFAULT 'active',
  `pin_hash` VARCHAR(255) NULL,
  `status` ENUM('active', 'inactive', 'deleted') NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_pm_user_status` (`user_id`, `status`),
  KEY `idx_pm_account_number` (`account_number`),
  CONSTRAINT `fk_pm_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Withdrawals
CREATE TABLE IF NOT EXISTS `withdrawals` (
  `id` VARCHAR(128) NOT NULL PRIMARY KEY,
  `withdrawal_uid` VARCHAR(64) NOT NULL UNIQUE,
  `user_id` VARCHAR(128) NOT NULL,
  `payment_method_id` VARCHAR(128) NULL,
  `payment_method` VARCHAR(64) NOT NULL,
  `account_number` VARCHAR(64) NOT NULL,
  `account_holder_name` VARCHAR(160) NOT NULL,
  `account_type` VARCHAR(32) NULL,
  `amount_paisa` BIGINT NOT NULL,
  `fee_paisa` BIGINT NOT NULL DEFAULT 0,
  `net_amount_paisa` BIGINT NOT NULL,
  `paid_amount_paisa` BIGINT NULL,
  `status` ENUM('pending', 'processing', 'approved', 'paid', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
  `payout_reference` VARCHAR(128) NULL,
  `admin_note` TEXT NULL,
  `reviewed_by` VARCHAR(128) NULL,
  `reviewed_at` DATETIME NULL,
  `paid_at` DATETIME NULL,
  `payment_date` DATE NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_wd_user_created` (`user_id`, `created_at`),
  KEY `idx_wd_status` (`status`),
  KEY `idx_wd_account` (`account_number`),
  KEY `idx_wd_created` (`created_at`),
  CONSTRAINT `fk_wd_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Catalog Products / Services
CREATE TABLE IF NOT EXISTS `catalog_products` (
  `id` VARCHAR(128) NOT NULL PRIMARY KEY,
  `sku` VARCHAR(64) NOT NULL UNIQUE,
  `name` VARCHAR(200) NOT NULL,
  `category` VARCHAR(64) NOT NULL,
  `description` TEXT NULL,
  `price_paisa` BIGINT NOT NULL,
  `commission_eligible` TINYINT(1) NOT NULL DEFAULT 1,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Orders
CREATE TABLE IF NOT EXISTS `orders` (
  `id` VARCHAR(128) NOT NULL PRIMARY KEY,
  `order_uid` VARCHAR(64) NOT NULL UNIQUE,
  `user_id` VARCHAR(128) NOT NULL,
  `product_id` VARCHAR(128) NULL,
  `product_name` VARCHAR(200) NOT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `unit_price_paisa` BIGINT NOT NULL,
  `subtotal_paisa` BIGINT NOT NULL,
  `discount_paisa` BIGINT NOT NULL DEFAULT 0,
  `fee_paisa` BIGINT NOT NULL DEFAULT 0,
  `total_amount_paisa` BIGINT NOT NULL,
  `payment_source` VARCHAR(32) NOT NULL DEFAULT 'wallet',
  `status` ENUM('pending', 'processing', 'completed', 'cancelled', 'refunded') NOT NULL DEFAULT 'completed',
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_ord_user_created` (`user_id`, `created_at`),
  KEY `idx_ord_status` (`status`),
  KEY `idx_ord_created` (`created_at`),
  CONSTRAINT `fk_ord_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Invoices
CREATE TABLE IF NOT EXISTS `invoices` (
  `id` VARCHAR(128) NOT NULL PRIMARY KEY,
  `invoice_number` VARCHAR(64) NOT NULL UNIQUE,
  `order_id` VARCHAR(128) NOT NULL,
  `user_id` VARCHAR(128) NOT NULL,
  `customer_name` VARCHAR(160) NOT NULL,
  `customer_email` VARCHAR(191) NOT NULL,
  `customer_phone` VARCHAR(32) NOT NULL DEFAULT '',
  `items_json` MEDIUMTEXT NOT NULL,
  `subtotal_paisa` BIGINT NOT NULL,
  `discount_paisa` BIGINT NOT NULL DEFAULT 0,
  `fee_paisa` BIGINT NOT NULL DEFAULT 0,
  `tax_paisa` BIGINT NOT NULL DEFAULT 0,
  `total_paisa` BIGINT NOT NULL,
  `payment_status` ENUM('paid', 'unpaid', 'refunded') NOT NULL DEFAULT 'paid',
  `invoice_status` ENUM('draft', 'issued', 'paid', 'void') NOT NULL DEFAULT 'paid',
  `issued_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `due_date` DATE NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_inv_user_issued` (`user_id`, `issued_at`),
  KEY `idx_inv_order` (`order_id`),
  KEY `idx_inv_status` (`payment_status`),
  CONSTRAINT `fk_inv_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_inv_order` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. Referrals (2-level sponsor tree)
CREATE TABLE IF NOT EXISTS `referrals` (
  `id` VARCHAR(128) NOT NULL PRIMARY KEY,
  `referrer_user_id` VARCHAR(128) NOT NULL,
  `referred_user_id` VARCHAR(128) NOT NULL,
  `level` TINYINT NOT NULL DEFAULT 1,
  `status` VARCHAR(32) NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_ref_pair_level` (`referrer_user_id`, `referred_user_id`, `level`),
  KEY `idx_ref_referred` (`referred_user_id`),
  CONSTRAINT `fk_ref_referrer` FOREIGN KEY (`referrer_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ref_referred` FOREIGN KEY (`referred_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. Public Referral Clicks & Lookup
CREATE TABLE IF NOT EXISTS `public_referrals` (
  `referral_code` VARCHAR(64) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(128) NOT NULL,
  `username` VARCHAR(64) NOT NULL,
  `full_name` VARCHAR(160) NOT NULL,
  `clicks` INT NOT NULL DEFAULT 0,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_pubref_user` (`user_id`),
  CONSTRAINT `fk_pubref_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. Commissions
CREATE TABLE IF NOT EXISTS `commissions` (
  `id` VARCHAR(128) NOT NULL PRIMARY KEY,
  `commission_uid` VARCHAR(64) NOT NULL UNIQUE,
  `earner_user_id` VARCHAR(128) NOT NULL,
  `source_user_id` VARCHAR(128) NOT NULL,
  `order_id` VARCHAR(128) NULL,
  `level` TINYINT NOT NULL DEFAULT 1,
  `rate_percent` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  `base_amount_paisa` BIGINT NOT NULL DEFAULT 0,
  `commission_amount_paisa` BIGINT NOT NULL DEFAULT 0,
  `status` ENUM('pending', 'approved', 'credited', 'reversed', 'cancelled') NOT NULL DEFAULT 'credited',
  `note` TEXT NULL,
  `credited_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_comm_earner_created` (`earner_user_id`, `created_at`),
  KEY `idx_comm_source` (`source_user_id`),
  KEY `idx_comm_order` (`order_id`),
  KEY `idx_comm_status` (`status`),
  CONSTRAINT `fk_comm_earner` FOREIGN KEY (`earner_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. User Notifications
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` VARCHAR(128) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(128) NOT NULL,
  `type` VARCHAR(64) NOT NULL DEFAULT 'system',
  `title` VARCHAR(200) NOT NULL,
  `message` TEXT NOT NULL,
  `link` VARCHAR(255) NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_notif_user_read` (`user_id`, `is_read`, `created_at`),
  CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 19. Admin Notifications
CREATE TABLE IF NOT EXISTS `admin_notifications` (
  `id` VARCHAR(128) NOT NULL PRIMARY KEY,
  `type` VARCHAR(64) NOT NULL DEFAULT 'system',
  `title` VARCHAR(200) NOT NULL,
  `message` TEXT NOT NULL,
  `link` VARCHAR(255) NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_adnotif_read` (`is_read`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 20. Support Tickets
CREATE TABLE IF NOT EXISTS `support_tickets` (
  `id` VARCHAR(128) NOT NULL PRIMARY KEY,
  `ticket_uid` VARCHAR(64) NOT NULL UNIQUE,
  `user_id` VARCHAR(128) NOT NULL,
  `subject` VARCHAR(200) NOT NULL,
  `category` VARCHAR(64) NOT NULL DEFAULT 'general',
  `priority` ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
  `status` ENUM('open', 'in_progress', 'answered', 'resolved', 'closed') NOT NULL DEFAULT 'open',
  `assigned_admin_id` VARCHAR(128) NULL,
  `internal_note` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_ticket_user` (`user_id`, `updated_at`),
  KEY `idx_ticket_status` (`status`),
  CONSTRAINT `fk_ticket_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 21. Support Messages
CREATE TABLE IF NOT EXISTS `support_messages` (
  `id` VARCHAR(128) NOT NULL PRIMARY KEY,
  `ticket_id` VARCHAR(128) NOT NULL,
  `sender_type` ENUM('user', 'admin') NOT NULL,
  `sender_id` VARCHAR(128) NOT NULL,
  `sender_name` VARCHAR(160) NOT NULL,
  `message` TEXT NOT NULL,
  `attachment_url` MEDIUMTEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_smsg_ticket` (`ticket_id`, `created_at`),
  CONSTRAINT `fk_smsg_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 22. Platform Dynamic Settings (key-value store)
CREATE TABLE IF NOT EXISTS `platform_settings` (
  `setting_key` VARCHAR(128) NOT NULL PRIMARY KEY,
  `setting_value` TEXT NOT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 23. Atomic Counters (invoice numbers, etc.)
CREATE TABLE IF NOT EXISTS `counters` (
  `counter_key` VARCHAR(64) NOT NULL PRIMARY KEY,
  `current_value` BIGINT NOT NULL DEFAULT 0,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 24. Immutable Audit & Activity Logs
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` VARCHAR(128) NOT NULL PRIMARY KEY,
  `actor_type` VARCHAR(32) NOT NULL,
  `actor_id` VARCHAR(128) NULL,
  `actor_name` VARCHAR(160) NOT NULL,
  `action` VARCHAR(128) NOT NULL,
  `entity_type` VARCHAR(64) NOT NULL,
  `entity_id` VARCHAR(128) NULL,
  `old_values` MEDIUMTEXT NULL,
  `new_values` MEDIUMTEXT NULL,
  `ip_address` VARCHAR(64) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_audit_actor` (`actor_type`, `created_at`),
  KEY `idx_audit_entity` (`entity_type`, `entity_id`),
  KEY `idx_audit_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 25. Public Contact Form Messages
CREATE TABLE IF NOT EXISTS `contact_messages` (
  `id` VARCHAR(128) NOT NULL PRIMARY KEY,
  `name` VARCHAR(160) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(32) NULL,
  `subject` VARCHAR(200) NOT NULL,
  `message` TEXT NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'new',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 26. Persistent Database-Backed Sessions (zero in-memory session loss on restart)
CREATE TABLE IF NOT EXISTS `sessions` (
  `id` VARCHAR(128) NOT NULL PRIMARY KEY,
  `token_hash` CHAR(64) NOT NULL UNIQUE,
  `actor_type` ENUM('user', 'admin') NOT NULL,
  `actor_id` VARCHAR(128) NOT NULL,
  `ip_address` VARCHAR(64) NULL,
  `user_agent` VARCHAR(255) NULL,
  `expires_at` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_sessions_actor` (`actor_type`, `actor_id`),
  KEY `idx_sessions_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 27. Password Reset Tokens (also used for seamless Firebase-migrated user reactivation)
CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `id` VARCHAR(128) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(128) NOT NULL,
  `token_hash` CHAR(64) NOT NULL UNIQUE,
  `expires_at` DATETIME NOT NULL,
  `used_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_prt_user` (`user_id`, `expires_at`),
  CONSTRAINT `fk_prt_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 28. Login Attempt & Security History Logs
CREATE TABLE IF NOT EXISTS `login_logs` (
  `id` VARCHAR(128) NOT NULL PRIMARY KEY,
  `actor_type` ENUM('user', 'admin') NOT NULL,
  `actor_id` VARCHAR(128) NULL,
  `identifier` VARCHAR(191) NOT NULL,
  `success` TINYINT(1) NOT NULL DEFAULT 0,
  `ip_address` VARCHAR(64) NULL,
  `user_agent` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_llog_actor` (`actor_type`, `actor_id`, `created_at`),
  KEY `idx_llog_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
