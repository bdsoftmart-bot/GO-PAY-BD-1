import React, { createContext, useContext, useState } from 'react';

export type Language = 'en' | 'bn';

const translations: Record<Language, Record<string, string>> = {
  en: {
    brand: 'GO PAY BD',
    tagline: 'Manage. Earn. Connect.',
    nav_how_it_works: 'How it works',
    nav_commission: 'Your commission',
    nav_faq: 'FAQ',
    nav_features: 'Features',
    nav_referral: 'Referral',
    nav_security: 'Security',
    nav_about: 'About',
    nav_contact: 'Contact',
    nav_login: 'Sign in',
    nav_register: 'Create account',
    nav_dashboard: 'Dashboard',
    nav_admin: 'Admin',
    // User Sidebar
    menu_home: 'Home',
    menu_wallets: 'Wallets',
    menu_deposit: 'Deposit',
    menu_withdraw: 'Withdraw',
    menu_earnings: 'Earnings',
    menu_referrals: 'My Referrals',
    menu_referral_link: 'Referral Link',
    menu_orders: 'My Orders',
    menu_transactions: 'Transactions',
    menu_payment_methods: 'Payment Methods',
    menu_notifications: 'Notifications',
    menu_support: 'Support',
    menu_profile: 'Profile',
    menu_settings: 'Settings',
    menu_logout: 'Logout',
    // Financial Cards
    card_total_balance: 'Total Balance',
    card_available_balance: 'Available Balance',
    card_pending_balance: 'Pending Balance',
    card_total_deposit: 'Total Deposit',
    card_total_withdrawal: 'Total Withdrawal',
    card_total_earnings: 'Total Earnings',
    card_referral_commission: 'Referral Commission',
    card_total_orders: 'Total Orders',
    // Quick Actions
    qa_deposit: 'Deposit Money',
    qa_withdraw: 'Withdraw Money',
    qa_referrals: 'My Referrals',
    qa_wallet: 'My Wallet',
    qa_transactions: 'View Transactions',
    qa_ref_link: 'Create Referral Link',
    // Admin Sidebar
    adm_dashboard: 'Dashboard',
    adm_users: 'Users',
    adm_deposits: 'Deposits',
    adm_withdrawals: 'Withdrawals',
    adm_orders: 'Orders',
    adm_transactions: 'Transactions',
    adm_commissions: 'Commissions',
    adm_referrals: 'Referral Management',
    adm_wallets: 'Wallet Management',
    adm_payment_methods: 'Payment Methods',
    adm_payment_settings: 'Payment Settings',
    adm_invoices: 'Invoices',
    adm_reports: 'Reports & Numbers',
    adm_notifications: 'Notifications',
    adm_support: 'Support Tickets',
    adm_staff: 'Admin Staff',
    adm_audit: 'Audit & Activity Logs',
    adm_website_settings: 'Website Settings',
    adm_security_settings: 'Security Settings',
    // Common
    search: 'Search',
    filter: 'Filter',
    export_csv: 'Export CSV',
    save_changes: 'Save Changes',
    cancel: 'Cancel',
    submit: 'Submit',
    approve: 'Approve',
    reject: 'Reject',
    view: 'View',
    status: 'Status',
    amount: 'Amount',
    date: 'Date',
    actions: 'Actions',
    no_records: 'No records found yet.',
  },
  bn: {
    brand: 'GO PAY BD',
    tagline: 'ছোট পদক্ষেপ · স্পষ্ট অগ্রগতি',
    nav_how_it_works: 'কিভাবে কাজ করে',
    nav_commission: 'আপনার কমিশন',
    nav_faq: 'সাধারণ প্রশ্ন',
    nav_features: 'বৈশিষ্ট্য',
    nav_referral: 'রেফারেল',
    nav_security: 'নিরাপত্তা',
    nav_about: 'আমাদের সম্পর্কে',
    nav_contact: 'যোগাযোগ',
    nav_login: 'সাইন ইন',
    nav_register: 'অ্যাকাউন্ট তৈরি করুন',
    nav_dashboard: 'ড্যাশবোর্ড',
    nav_admin: 'অ্যাডমিন',
    // User Sidebar
    menu_home: 'হোম',
    menu_wallets: 'ওয়ালেট',
    menu_deposit: 'ডিপোজিট',
    menu_withdraw: 'উত্তোলন',
    menu_earnings: 'আয় ও কমিশন',
    menu_referrals: 'আমার রেফারেল',
    menu_referral_link: 'রেফারেল লিংক',
    menu_orders: 'আমার অর্ডার',
    menu_transactions: 'লেনদেন ইতিহাস',
    menu_payment_methods: 'পেমেন্ট মাধ্যম',
    menu_notifications: 'নোটিফিকেশন',
    menu_support: 'সাপোর্ট',
    menu_profile: 'প্রোফাইল',
    menu_settings: 'সেটিংস',
    menu_logout: 'লগআউট',
    // Financial Cards
    card_total_balance: 'মোট ব্যালেন্স',
    card_available_balance: 'ব্যবহারযোগ্য ব্যালেন্স',
    card_pending_balance: 'পেন্ডিং ব্যালেন্স',
    card_total_deposit: 'মোট ডিপোজিট',
    card_total_withdrawal: 'মোট উত্তোলন',
    card_total_earnings: 'মোট উপার্জন',
    card_referral_commission: 'রেফারেল কমিশন',
    card_total_orders: 'মোট অর্ডার',
    // Quick Actions
    qa_deposit: 'টাকা জমা দিন',
    qa_withdraw: 'টাকা উত্তোলন',
    qa_referrals: 'আমার রেফারেল',
    qa_wallet: 'আমার ওয়ালেট',
    qa_transactions: 'লেনদেন দেখুন',
    qa_ref_link: 'রেফারেল লিংক',
    // Admin Sidebar
    adm_dashboard: 'ড্যাশবোর্ড',
    adm_users: 'ব্যবহারকারী',
    adm_deposits: 'ডিপোজিটসমূহ',
    adm_withdrawals: 'উত্তোলনসমূহ',
    adm_orders: 'অর্ডারসমূহ',
    adm_transactions: 'সকল লেনদেন',
    adm_commissions: 'কমিশন ব্যবস্থাপনা',
    adm_referrals: 'রেফারেল ব্যবস্থাপনা',
    adm_wallets: 'ওয়ালেট ব্যবস্থাপনা',
    adm_payment_methods: 'পেমেন্ট অ্যাকাউন্ট',
    adm_payment_settings: 'পেমেন্ট সেটিংস',
    adm_invoices: 'ইনভয়েসসমূহ',
    adm_reports: 'রিপোর্ট ও নাম্বার বিশ্লেষণ',
    adm_notifications: 'নোটিফিকেশন',
    adm_support: 'সাপোর্ট টিকেট',
    adm_staff: 'অ্যাডমিন স্টাফ',
    adm_audit: 'অডিট ও অ্যাক্টিভিটি লগ',
    adm_website_settings: 'ওয়েবসাইট সেটিংস',
    adm_security_settings: 'নিরাপত্তা সেটিংস',
    // Common
    search: 'অনুসন্ধান',
    filter: 'ফিল্টার',
    export_csv: 'CSV ডাউনলোড',
    save_changes: 'সংরক্ষণ করুন',
    cancel: 'বাতিল',
    submit: 'জমা দিন',
    approve: 'অনুমোদন',
    reject: 'প্রত্যাখ্যান',
    view: 'দেখুন',
    status: 'অবস্থা',
    amount: 'পরিমাণ',
    date: 'তারিখ',
    actions: 'কার্যক্রম',
    no_records: 'এখনও কোনো তথ্য পাওয়া যায়নি।',
  },
};

interface LanguageContextType {
  lang: Language;
  setLang: (l: Language) => void;
  toggleLang: () => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

const LANG_STORAGE_KEY = 'gopaybd_lang';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY);
      if (saved === 'en' || saved === 'bn') return saved;
    } catch {
      // ignore storage access issues
    }
    return 'bn';
  });

  const setLang = (next: Language) => {
    setLangState(next);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      // ignore storage access issues
    }
  };

  const toggleLang = () => setLang(lang === 'en' ? 'bn' : 'en');
  const t = (key: string, fallback?: string) => translations[lang][key] || fallback || key;

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
