import React, { useState, useEffect } from 'react';
import { Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ArrowDownCircle,
  ArrowUpCircle,
  ShoppingBag,
  ReceiptText,
  Percent,
  Network,
  Wallet,
  CreditCard,
  SlidersHorizontal,
  FileText,
  BarChart3,
  Bell,
  LifeBuoy,
  ShieldCheck,
  ScrollText,
  Globe,
  Lock,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { AdminLoginPage } from '../pages/admin/AdminLoginPage';

export const AdminLayout: React.FC = () => {
  const { authLoading, admin, adminVaultUnlocked, adminUnread, logoutAdmin, lockAdminVault, refreshAdmin, hasAdminPermission } = useAuth();
  const { lang, toggleLang, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (admin && adminVaultUnlocked) {
      refreshAdmin();
    }
  }, [authLoading, admin, adminVaultUnlocked, location.pathname, refreshAdmin]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center text-sm font-medium text-[#94A3B8]">
        Verifying administrator session...
      </div>
    );
  }

  if (!admin || !adminVaultUnlocked) return <AdminLoginPage />;

  const navItems = [
    { to: '/admin', label: t('adm_dashboard'), icon: LayoutDashboard, perm: 'dashboard', end: true },
    { to: '/admin/users', label: t('adm_users'), icon: Users, perm: 'users' },
    { to: '/admin/deposits', label: t('adm_deposits'), icon: ArrowDownCircle, perm: 'deposits' },
    { to: '/admin/withdrawals', label: t('adm_withdrawals'), icon: ArrowUpCircle, perm: 'withdrawals' },
    { to: '/admin/orders', label: t('adm_orders'), icon: ShoppingBag, perm: 'orders' },
    { to: '/admin/transactions', label: t('adm_transactions'), icon: ReceiptText, perm: 'transactions' },
    { to: '/admin/commissions', label: t('adm_commissions'), icon: Percent, perm: 'commissions' },
    { to: '/admin/referrals', label: t('adm_referrals'), icon: Network, perm: 'referrals' },
    { to: '/admin/wallets', label: t('adm_wallets'), icon: Wallet, perm: 'wallets' },
    { to: '/admin/payment-methods', label: t('adm_payment_methods'), icon: CreditCard, perm: 'payment_settings' },
    { to: '/admin/payment-settings', label: t('adm_payment_settings'), icon: SlidersHorizontal, perm: 'payment_settings' },
    { to: '/admin/invoices', label: t('adm_invoices'), icon: FileText, perm: 'invoices' },
    { to: '/admin/reports', label: t('adm_reports'), icon: BarChart3, perm: 'reports' },
    { to: '/admin/notifications', label: t('adm_notifications'), icon: Bell, perm: 'notifications', badge: adminUnread },
    { to: '/admin/support', label: t('adm_support'), icon: LifeBuoy, perm: 'support' },
    { to: '/admin/staff', label: t('adm_staff'), icon: ShieldCheck, perm: 'staff' },
    { to: '/admin/audit-logs', label: t('adm_audit'), icon: ScrollText, perm: 'audit' },
    { to: '/admin/website-settings', label: t('adm_website_settings'), icon: Globe, perm: 'settings' },
    { to: '/admin/security-settings', label: t('adm_security_settings'), icon: Lock, perm: 'settings' },
  ].filter((item) => hasAdminPermission(item.perm));

  const handleLogout = async () => {
    await logoutAdmin();
    navigate('/admin');
  };

  const renderSidebar = (isMobile = false) => (
    <div className="flex flex-col h-full bg-[#0F172A] text-[#F8FAFC]">
      <div className="h-16 px-4 flex items-center justify-between border-b border-[#1E293B]">
        <Link to="/admin">
          <BrandLogo variant="horizontal" light />
        </Link>
        {isMobile && (
          <button onClick={() => setMobileOpen(false)} className="p-1.5 text-[#94A3B8]">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="px-4 py-3 border-b border-[#1E293B]">
        <div className="text-xs font-semibold text-white truncate">{admin.full_name}</div>
        <div className="text-[11px] text-[#2DD4BF]">{admin.role_name} · {admin.admin_uid}</div>
      </div>

      <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => isMobile && setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-[#0D9488] text-white font-semibold shadow-xs'
                    : 'text-[#CBD5E1] hover:bg-[#1E293B] hover:text-white'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge ? (
                <span className="text-[10px] font-bold bg-[#DC2626] text-white px-1.5 py-0.5 rounded tabular-nums">
                  {item.badge}
                </span>
              ) : null}
            </NavLink>
          );
        })}

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-[#FCA5A5] hover:bg-[#1E293B] mt-3 cursor-pointer"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>{t('menu_logout')}</span>
        </button>
      </nav>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F4F7FB] text-[#0F172A]">
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen no-print">
        {renderSidebar(false)}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-[#0F172A]/60" onClick={() => setMobileOpen(false)} />
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl">{renderSidebar(true)}</div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-md border-b border-[#DCE4EF] px-4 sm:px-6 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg text-[#0F172A] hover:bg-[#EDF2F7]"
              aria-label="Open admin menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-xs font-medium text-[#64748B] truncate">
              Admin Control Center · <span className="text-[#0F172A] font-semibold">{admin.role_name}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => {
                lockAdminVault();
                navigate('/admin');
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#FECACA] bg-[#FEF2F2] text-xs font-semibold text-[#B91C1C] hover:bg-[#FEE2E2] cursor-pointer"
              title="Lock Admin Security Vault"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lock Vault</span>
            </button>
            <button
              onClick={toggleLang}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#DCE4EF] text-xs font-medium text-[#0F172A] hover:bg-[#F4F7FB] cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-[#0D9488]" />
              <span>{lang === 'en' ? 'বাংলা' : 'EN'}</span>
            </button>
            <Link
              to="/admin/reports"
              className="hidden sm:inline-flex px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#F0FDFA] border border-[#99F6E4] text-[#0F766E] hover:bg-[#CCFBF1]"
            >
              Payment Number Search
            </Link>
            <Link
              to="/"
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#64748B] hover:text-[#0F172A]"
            >
              Public Site
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
