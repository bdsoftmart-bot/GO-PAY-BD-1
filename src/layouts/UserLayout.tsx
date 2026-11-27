import React, { useState, useEffect } from 'react';
import { Link, NavLink, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  Users,
  Link2,
  ShoppingBag,
  ReceiptText,
  CreditCard,
  Bell,
  LifeBuoy,
  User,
  Settings,
  LogOut,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Globe,
  ChevronDown,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

export const UserLayout: React.FC = () => {
  const { authLoading, user, userUnread, logoutUser, refreshUser } = useAuth();
  const { lang, toggleLang, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileMenu, setProfileMenu] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login', { replace: true });
    } else {
      refreshUser();
    }
  }, [authLoading, user, location.pathname, navigate, refreshUser]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F4F7FB] flex items-center justify-center text-sm font-medium text-[#64748B]">
        Loading your GO PAY BD workspace...
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const navItems = [
    { to: '/dashboard', label: t('menu_home'), icon: Home, end: true },
    { to: '/dashboard/wallet', label: t('menu_wallets'), icon: Wallet },
    { to: '/dashboard/deposit', label: t('menu_deposit'), icon: ArrowDownCircle },
    { to: '/dashboard/withdraw', label: t('menu_withdraw'), icon: ArrowUpCircle },
    { to: '/dashboard/earnings', label: t('menu_earnings'), icon: TrendingUp },
    { to: '/dashboard/referrals', label: t('menu_referrals'), icon: Users },
    { to: '/dashboard/referral-link', label: t('menu_referral_link'), icon: Link2 },
    { to: '/dashboard/orders', label: t('menu_orders'), icon: ShoppingBag },
    { to: '/dashboard/transactions', label: t('menu_transactions'), icon: ReceiptText },
    { to: '/dashboard/payment-methods', label: t('menu_payment_methods'), icon: CreditCard },
    { to: '/dashboard/notifications', label: t('menu_notifications'), icon: Bell, badge: userUnread },
    { to: '/dashboard/support', label: t('menu_support'), icon: LifeBuoy },
    { to: '/dashboard/profile', label: t('menu_profile'), icon: User },
    { to: '/dashboard/settings', label: t('menu_settings'), icon: Settings },
  ];

  const handleLogout = async () => {
    await logoutUser();
    navigate('/login');
  };

  const renderLinks = (isMobile = false) => (
    <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => isMobile && setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#0D9488] text-white shadow-xs'
                  : 'text-[#334155] hover:bg-[#EDF2F7] hover:text-[#0F172A]'
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {(!collapsed || isMobile) && (
              <span className="flex-1 truncate">{item.label}</span>
            )}
            {(!collapsed || isMobile) && item.badge ? (
              <span className="text-[11px] font-bold tabular-nums text-white bg-[#0F172A] px-1.5 py-0.5 rounded">
                {item.badge}
              </span>
            ) : null}
          </NavLink>
        );
      })}
      <button
        onClick={handleLogout}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#DC2626] hover:bg-[#FEF2F2] transition-colors mt-3 cursor-pointer"
      >
        <LogOut className="w-4 h-4 shrink-0" />
        {(!collapsed || isMobile) && <span>{t('menu_logout')}</span>}
      </button>
    </nav>
  );

  return (
    <div className="min-h-screen flex bg-[#F4F7FB] text-[#0F172A]">
      {/* Desktop Collapsible Sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-white border-r border-[#DCE4EF] sticky top-0 h-screen transition-all duration-200 no-print ${
          collapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        <div className="h-16 px-4 flex items-center justify-between border-b border-[#DCE4EF]">
          <Link to="/dashboard">
            <BrandLogo variant={collapsed ? 'icon' : 'horizontal'} />
          </Link>
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="p-1.5 rounded-md text-[#64748B] hover:text-[#0F172A] hover:bg-[#EDF2F7]"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>
        {collapsed && (
          <div className="px-3 pt-3 flex justify-center">
            <button
              onClick={() => setCollapsed(false)}
              className="p-2 rounded-md text-[#64748B] hover:text-[#0F172A] hover:bg-[#EDF2F7]"
              title="Expand sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        )}
        {renderLinks(false)}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-[#0F172A]/60" onClick={() => setMobileOpen(false)} />
          <div className="relative w-72 max-w-[85vw] bg-white h-full flex flex-col shadow-xl">
            <div className="h-16 px-4 flex items-center justify-between border-b border-[#DCE4EF]">
              <BrandLogo variant="mobile" />
              <button onClick={() => setMobileOpen(false)} className="p-1.5 text-[#64748B]">
                <X className="w-5 h-5" />
              </button>
            </div>
            {renderLinks(true)}
          </div>
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0">
        <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-md border-b border-[#DCE4EF] px-4 sm:px-6 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg text-[#0F172A] hover:bg-[#EDF2F7]"
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="lg:hidden">
              <BrandLogo variant="mobile" />
            </span>
            <span className="hidden lg:inline text-xs font-medium text-[#64748B] truncate">
              GO PAY BD · Account ID <span className="font-mono font-semibold text-[#0F172A]">{user.uid}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={toggleLang}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#DCE4EF] text-xs font-medium text-[#0F172A] hover:bg-[#F4F7FB] cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-[#0D9488]" />
              <span>{lang === 'en' ? 'বাংলা' : 'EN'}</span>
            </button>

            <Link
              to="/dashboard/notifications"
              className="relative p-2 rounded-lg border border-[#DCE4EF] text-[#0F172A] hover:bg-[#F4F7FB]"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {userUnread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#DC2626] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {userUnread}
                </span>
              )}
            </Link>

            <div className="relative">
              <button
                onClick={() => setProfileMenu(!profileMenu)}
                className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-lg border border-[#DCE4EF] hover:bg-[#F4F7FB] cursor-pointer"
              >
                <span className="w-6 h-6 rounded-md bg-[#0F172A] text-[#2DD4BF] text-xs font-bold flex items-center justify-center">
                  {user.full_name.charAt(0).toUpperCase()}
                </span>
                <span className="hidden sm:inline text-xs font-semibold text-[#0F172A] max-w-[110px] truncate">
                  {user.full_name}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
              </button>

              {profileMenu && (
                <div
                  className="absolute right-0 mt-1.5 w-52 bg-white border border-[#DCE4EF] rounded-xl shadow-lg py-1.5 z-50"
                  onMouseLeave={() => setProfileMenu(false)}
                >
                  <div className="px-3.5 py-2 border-b border-[#DCE4EF]">
                    <p className="text-xs font-semibold text-[#0F172A] truncate">{user.full_name}</p>
                    <p className="text-[11px] text-[#64748B] truncate">@{user.username}</p>
                  </div>
                  <Link
                    to="/dashboard/profile"
                    onClick={() => setProfileMenu(false)}
                    className="block px-3.5 py-2 text-xs text-[#334155] hover:bg-[#F4F7FB] hover:text-[#0F172A]"
                  >
                    Profile & Security
                  </Link>
                  <Link
                    to="/dashboard/settings"
                    onClick={() => setProfileMenu(false)}
                    className="block px-3.5 py-2 text-xs text-[#334155] hover:bg-[#F4F7FB] hover:text-[#0F172A]"
                  >
                    Account Settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3.5 py-2 text-xs font-medium text-[#DC2626] hover:bg-[#FEF2F2] cursor-pointer"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Compact Mobile Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 h-14 bg-white border-t border-[#DCE4EF] grid grid-cols-5 no-print">
        {[
          { to: '/dashboard', label: 'Home', icon: Home, end: true },
          { to: '/dashboard/wallet', label: 'Wallet', icon: Wallet },
          { to: '/dashboard/deposit', label: 'Deposit', icon: ArrowDownCircle },
          { to: '/dashboard/referrals', label: 'Referrals', icon: Users },
          { to: '/dashboard/orders', label: 'Orders', icon: ShoppingBag },
        ].map((m) => {
          const Icon = m.icon;
          return (
            <NavLink
              key={m.to}
              to={m.to}
              end={m.end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                  isActive ? 'text-[#0D9488] font-semibold' : 'text-[#64748B]'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span>{m.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};
