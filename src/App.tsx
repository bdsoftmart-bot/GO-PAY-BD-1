import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LanguageProvider } from './contexts/LanguageContext';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider } from './contexts/AuthContext';

import { PublicLayout } from './layouts/PublicLayout';
import { UserLayout } from './layouts/UserLayout';
import { AdminLayout } from './layouts/AdminLayout';

import { LandingPage } from './pages/public/LandingPage';
import { LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage } from './pages/public/AuthPages';
import { AboutPage, ContactPage, TermsPage, PrivacyPage } from './pages/public/StaticPages';

import { UserDashboardPage } from './pages/user/UserDashboardPage';
import { WalletPage, TransactionsPage } from './pages/user/WalletAndTransactionsPage';
import { DepositPage } from './pages/user/DepositPage';
import { WithdrawPage, PaymentMethodsPage } from './pages/user/WithdrawAndPaymentMethodsPage';
import { ReferralsPage, ReferralLinkPage, EarningsPage } from './pages/user/ReferralsAndEarningsPage';
import { OrdersPage, OrderDetailsPage, InvoicePage } from './pages/user/OrdersAndInvoicePage';
import {
  NotificationsPage,
  SupportPage,
  ProfilePage,
  SettingsPage,
} from './pages/user/NotificationsSupportProfilePages';

import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminUsersPage, AdminUserDetailPage } from './pages/admin/AdminUsersPage';
import { AdminDepositsPage, AdminWithdrawalsPage } from './pages/admin/AdminFinanceQueuePages';
import {
  AdminOrdersPage,
  AdminCommissionsPage,
  AdminReferralsPage,
  AdminWalletsPage,
  AdminTransactionsPage,
  AdminInvoicesPage,
} from './pages/admin/AdminCommercePages';
import { AdminReportsAndPaymentNumbersPage } from './pages/admin/AdminReportsAndPaymentNumbersPage';
import {
  AdminPaymentSettingsPage,
  AdminUserPaymentMethodsPage,
  AdminNotificationsPage,
  AdminSupportPage,
  AdminStaffPage,
  AdminAuditLogsPage,
  AdminWebsiteSettingsPage,
  AdminSecuritySettingsPage,
} from './pages/admin/AdminOperationsAndSettingsPages';

export default function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <ToastProvider>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                {/* Public Routes */}
                <Route element={<PublicLayout />}>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/contact" element={<ContactPage />} />
                  <Route path="/terms" element={<TermsPage />} />
                  <Route path="/privacy" element={<PrivacyPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                </Route>

                {/* User Dashboard Routes */}
                <Route path="/dashboard" element={<UserLayout />}>
                  <Route index element={<UserDashboardPage />} />
                  <Route path="wallet" element={<WalletPage />} />
                  <Route path="deposit" element={<DepositPage />} />
                  <Route path="withdraw" element={<WithdrawPage />} />
                  <Route path="earnings" element={<EarningsPage />} />
                  <Route path="referrals" element={<ReferralsPage />} />
                  <Route path="referral-link" element={<ReferralLinkPage />} />
                  <Route path="orders" element={<OrdersPage />} />
                  <Route path="orders/:id" element={<OrderDetailsPage />} />
                  <Route path="invoices/:id" element={<InvoicePage />} />
                  <Route path="transactions" element={<TransactionsPage />} />
                  <Route path="payment-methods" element={<PaymentMethodsPage />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="support" element={<SupportPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>

                {/* Admin Portal Routes */}
                <Route path="/admin/login" element={<AdminLoginPage />} />
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<AdminDashboardPage />} />
                  <Route path="users" element={<AdminUsersPage />} />
                  <Route path="users/:id" element={<AdminUserDetailPage />} />
                  <Route path="deposits" element={<AdminDepositsPage />} />
                  <Route path="withdrawals" element={<AdminWithdrawalsPage />} />
                  <Route path="orders" element={<AdminOrdersPage />} />
                  <Route path="transactions" element={<AdminTransactionsPage />} />
                  <Route path="commissions" element={<AdminCommissionsPage />} />
                  <Route path="referrals" element={<AdminReferralsPage />} />
                  <Route path="wallets" element={<AdminWalletsPage />} />
                  <Route path="payment-methods" element={<AdminUserPaymentMethodsPage />} />
                  <Route path="payment-settings" element={<AdminPaymentSettingsPage />} />
                  <Route path="invoices" element={<AdminInvoicesPage />} />
                  <Route path="invoices/:id" element={<InvoicePage isAdmin />} />
                  <Route path="reports" element={<AdminReportsAndPaymentNumbersPage />} />
                  <Route path="notifications" element={<AdminNotificationsPage />} />
                  <Route path="support" element={<AdminSupportPage />} />
                  <Route path="staff" element={<AdminStaffPage />} />
                  <Route path="audit-logs" element={<AdminAuditLogsPage />} />
                  <Route path="website-settings" element={<AdminWebsiteSettingsPage />} />
                  <Route path="security-settings" element={<AdminSecuritySettingsPage />} />
                </Route>

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </ToastProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}
