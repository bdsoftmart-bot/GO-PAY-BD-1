import React, { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Menu, X, ArrowUpRight, Headphones } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

export const PublicLayout: React.FC = () => {
  const { user, publicSettings } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const isBn = lang === 'bn';

  const navLinks = [
    { to: '/#how-it-works', label: t('nav_how_it_works') },
    { to: '/#commission', label: t('nav_commission') },
    { to: '/#faq', label: t('nav_faq') },
    { to: '/contact', label: t('nav_contact') },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F7FB] text-[#0F172A]">
      {/* Clean Editorial Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#F4F7FB]/95 backdrop-blur-md border-b border-[#DCE4EF] no-print">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between gap-6">
          {/* Left: Brand Wordmark */}
          <Link to="/" className="shrink-0 whitespace-nowrap">
            <BrandLogo variant="horizontal" />
          </Link>

          {/* Center: Clean Single-Line Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#475569]">
            {navLinks.map((item) =>
              item.to.startsWith('/#') ? (
                <a
                  key={item.to}
                  href={item.to}
                  className="hover:text-[#0F172A] transition-colors whitespace-nowrap shrink-0"
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`hover:text-[#0F172A] transition-colors whitespace-nowrap shrink-0 ${
                    location.pathname === item.to ? 'text-[#0D9488] font-semibold' : ''
                  }`}
                >
                  {item.label}
                </Link>
              )
            )}
          </nav>

          {/* Right: EN / BN Switcher + Sign In + Primary Action */}
          <div className="hidden md:flex items-center gap-4 shrink-0">
            <div
              role="group"
              aria-label="Language switcher"
              className="inline-flex items-center p-0.5 rounded-lg bg-white border border-[#DCE4EF]"
            >
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  lang === 'en'
                    ? 'bg-[#0F172A] text-white'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLang('bn')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  lang === 'bn'
                    ? 'bg-[#0F172A] text-white'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                BN
              </button>
            </div>

            {user ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#0F172A] text-white hover:bg-[#1E293B] transition-colors whitespace-nowrap shrink-0"
              >
                {t('nav_dashboard')}
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-semibold text-[#0F172A] hover:text-[#0D9488] transition-colors whitespace-nowrap shrink-0 px-1"
                >
                  {t('nav_login')}
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#0F172A] text-white hover:bg-[#1E293B] transition-colors whitespace-nowrap shrink-0"
                >
                  {t('nav_register')}
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              </>
            )}
          </div>

          {/* Mobile Controls */}
          <div className="md:hidden flex items-center gap-2">
            <div className="inline-flex items-center p-0.5 rounded-lg bg-white border border-[#DCE4EF]">
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2 py-1 text-xs font-semibold rounded-md ${
                  lang === 'en' ? 'bg-[#0F172A] text-white' : 'text-[#64748B]'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLang('bn')}
                className={`px-2 py-1 text-xs font-semibold rounded-md ${
                  lang === 'bn' ? 'bg-[#0F172A] text-white' : 'text-[#64748B]'
                }`}
              >
                BN
              </button>
            </div>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 rounded-lg text-[#0F172A] hover:bg-white border border-transparent hover:border-[#DCE4EF]"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <div className="md:hidden bg-white border-t border-[#DCE4EF] px-4 py-4 space-y-1.5">
            {navLinks.map((item) =>
              item.to.startsWith('/#') ? (
                <a
                  key={item.to}
                  href={item.to}
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2.5 text-sm font-medium text-[#0F172A] rounded-lg hover:bg-[#F4F7FB]"
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2.5 text-sm font-medium text-[#0F172A] rounded-lg hover:bg-[#F4F7FB]"
                >
                  {item.label}
                </Link>
              )
            )}
            <div className="pt-3 mt-2 border-t border-[#DCE4EF] flex items-center gap-2.5">
              {user ? (
                <Link
                  to="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="flex-1 text-center px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#0F172A] text-white"
                >
                  {t('nav_dashboard')}
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 text-center px-4 py-2.5 rounded-lg text-sm font-semibold border border-[#DCE4EF] text-[#0F172A]"
                  >
                    {t('nav_login')}
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 text-center px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#0F172A] text-white"
                  >
                    {t('nav_register')}
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      {/* Clean Minimal Editorial Footer matching Reference */}
      <footer className="bg-[#F4F7FB] border-t border-[#DCE4EF] no-print">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex flex-wrap items-center gap-4">
              <Link to="/" className="shrink-0">
                <BrandLogo variant="horizontal" />
              </Link>
              <span className="text-xs text-[#64748B]">
                {isBn ? 'ছোট পদক্ষেপ · স্পষ্ট অগ্রগতি।' : 'Small steps · Clear progress.'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-[#475569]">
              <a href="/#faq" className="hover:text-[#0F172A] transition-colors">
                {isBn ? 'সাধারণ প্রশ্ন' : 'FAQ'}
              </a>
              <Link to="/about" className="hover:text-[#0F172A] transition-colors">
                {isBn ? 'আমাদের সম্পর্কে' : 'About'}
              </Link>
              <Link to="/terms" className="hover:text-[#0F172A] transition-colors">
                {isBn ? 'শর্তাবলি' : 'Terms'}
              </Link>
              <Link to="/privacy" className="hover:text-[#0F172A] transition-colors">
                {isBn ? 'গোপনীয়তা নীতি' : 'Privacy'}
              </Link>
              <Link to="/login" className="hover:text-[#0F172A] transition-colors">
                {isBn ? 'সাইন ইন' : 'Sign in'}
              </Link>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-[#DCE4EF]/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-[#64748B]">
            <span>
              © {new Date().getFullYear()} {publicSettings.site_name} · {publicSettings.support_email}
            </span>
            <span>
              {isBn
                ? 'মুদ্রা: BDT (৳) · আপনার আসল bKash বা Nagad পিন কখনোই কারো সাথে শেয়ার করবেন না।'
                : 'Currency: BDT (৳) · Never share your real bKash or Nagad banking PIN/OTP.'}
            </span>
          </div>
        </div>
      </footer>

      {/* Floating Support Quick Link matching Reference Bottom-Right */}
      <Link
        to="/contact"
        aria-label={isBn ? 'সাপোর্ট ও যোগাযোগ' : 'Support & Contact'}
        className="fixed bottom-5 right-5 z-30 w-12 h-12 rounded-full bg-[#0F172A] text-white shadow-lg hover:bg-[#0D9488] transition-colors flex items-center justify-center no-print"
      >
        <Headphones className="w-5 h-5" />
      </Link>
    </div>
  );
};
