import React, { useState } from 'react';
import { Mail, Phone, Send, MessageSquare } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { btnPrimary, inputCls, labelCls } from '../../components/ui/Primitives';

export const AboutPage: React.FC = () => {
  const { publicSettings } = useAuth();
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <p className="text-xs font-semibold text-[#0D9488] mb-2">About {publicSettings.site_name}</p>
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#0F172A]">
        Financial record discipline for Bangladesh digital commerce.
      </h1>
      <p className="mt-4 text-base text-[#64748B] leading-relaxed">
        {publicSettings.site_name} is a structured BDT wallet, manual payment verification, order invoicing, and two-level referral commission management platform engineered for clarity, security, and operational auditability.
      </p>

      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-[#DCE4EF] rounded-xl p-6">
          <h2 className="text-base font-bold text-[#0F172A]">Ledger-First Design</h2>
          <p className="text-sm text-[#64748B] mt-2 leading-relaxed">
            Every taka entering or leaving a member wallet is recorded in an immutable double-checked ledger with previous and new balances, reference IDs, and administrator verification stamps.
          </p>
        </div>
        <div className="bg-white border border-[#DCE4EF] rounded-xl p-6">
          <h2 className="text-base font-bold text-[#0F172A]">Honest Commerce Referrals</h2>
          <p className="text-sm text-[#64748B] mt-2 leading-relaxed">
            We strictly tie referral commissions to completed, eligible product and service orders. We never issue recruitment payouts or commissions on deposits, keeping incentives transparent and sustainable.
          </p>
        </div>
      </div>
    </div>
  );
};

export const ContactPage: React.FC = () => {
  const { publicSettings } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.publicPost('/api/public/contact', form);
      toast(res.message);
      setForm({ name: '', email: '', phone: '', subject: '', message: '' });
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-5 space-y-6">
          <div>
            <p className="text-xs font-semibold text-[#0D9488] mb-2">Contact Support</p>
            <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">Get in touch with our team</h1>
            <p className="text-sm text-[#64748B] mt-2 leading-relaxed">
              Questions about deposit verification, invoices, or merchant accounts? Reach out via our official channels.
            </p>
          </div>

          <div className="bg-white border border-[#DCE4EF] rounded-xl p-6 space-y-4 text-sm">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-[#0D9488]" />
              <span>{publicSettings.support_email}</span>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-[#0D9488]" />
              <span>{publicSettings.support_phone}</span>
            </div>
            {publicSettings.telegram_link && (
              <div className="flex items-center gap-3">
                <Send className="w-4 h-4 text-[#0D9488]" />
                <a href={publicSettings.telegram_link} target="_blank" rel="noreferrer" className="text-[#0D9488] hover:underline">
                  Official Telegram Support
                </a>
              </div>
            )}
            {publicSettings.whatsapp_link && (
              <div className="flex items-center gap-3">
                <MessageSquare className="w-4 h-4 text-[#0D9488]" />
                <a href={publicSettings.whatsapp_link} target="_blank" rel="noreferrer" className="text-[#0D9488] hover:underline">
                  WhatsApp Desk
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-7 bg-white border border-[#DCE4EF] rounded-xl p-7">
          <h2 className="text-lg font-bold text-[#0F172A]">Send a Message</h2>
          <form onSubmit={handleSubmit} className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Full Name</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email Address</label>
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Phone (Optional)</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Subject</label>
              <input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Message</label>
              <textarea required rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" disabled={loading} className={btnPrimary}>
                {loading ? 'Sending...' : 'Submit Inquiry'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export const TermsPage: React.FC = () => (
  <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
    <h1 className="text-3xl font-bold text-[#0F172A]">Terms & Conditions</h1>
    <div className="mt-6 bg-white border border-[#DCE4EF] rounded-xl p-7 space-y-5 text-sm text-[#64748B] leading-relaxed">
      <section>
        <h2 className="text-base font-bold text-[#0F172A] mb-1">1. Account Eligibility & Security</h2>
        <p>Users must provide accurate registration details and maintain confidentiality of their GO PAY BD password. GO PAY BD never asks for external mobile banking PINs or OTPs.</p>
      </section>
      <section>
        <h2 className="text-base font-bold text-[#0F172A] mb-1">2. Manual Deposit & Withdrawal Verification</h2>
        <p>Deposits submitted via bKash or Nagad require valid unique Transaction IDs and are credited only after administrative verification. Duplicate or fraudulent Transaction IDs are rejected and logged. Withdrawal requests reserve the requested amount until processed and marked Paid.</p>
      </section>
      <section>
        <h2 className="text-base font-bold text-[#0F172A] mb-1">3. Two-Level Commerce Referral Commissions</h2>
        <p>Referral relationships are permanent upon registration; self-referrals and circular referral chains are strictly prohibited. Commissions are earned exclusively from completed eligible orders and are reversed automatically if an order is cancelled or refunded.</p>
      </section>
    </div>
  </div>
);

export const PrivacyPage: React.FC = () => (
  <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
    <h1 className="text-3xl font-bold text-[#0F172A]">Privacy Policy</h1>
    <div className="mt-6 bg-white border border-[#DCE4EF] rounded-xl p-7 space-y-5 text-sm text-[#64748B] leading-relaxed">
      <section>
        <h2 className="text-base font-bold text-[#0F172A] mb-1">1. Data We Collect</h2>
        <p>We collect account identity details (name, username, email, phone), saved payout receiving numbers, deposit references/screenshots, and order/invoice records necessary to maintain your BDT financial ledger.</p>
      </section>
      <section>
        <h2 className="text-base font-bold text-[#0F172A] mb-1">2. Zero Mobile Banking Credentials</h2>
        <p>GO PAY BD strictly never collects or stores bKash PINs, Nagad PINs, OTP codes, or third-party account passwords.</p>
      </section>
      <section>
        <h2 className="text-base font-bold text-[#0F172A] mb-1">3. Access Control & Audit Protection</h2>
        <p>User payment methods and uploaded payment receipts are restricted to the account owner and authorized Finance Administrators under role-based access control and immutable audit logging.</p>
      </section>
    </div>
  </div>
);
