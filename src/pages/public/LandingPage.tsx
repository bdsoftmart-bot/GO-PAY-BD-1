import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  ArrowDown,
  Check,
  Plus,
  Minus,
  Wallet,
  ReceiptText,
  TrendingUp,
  ListChecks,
  ArrowRightLeft,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatBDT } from '../../lib/format';

export const LandingPage: React.FC = () => {
  const { publicSettings, user } = useAuth();
  const { lang } = useLanguage();
  const isBn = lang === 'bn';
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const l1Rate = Number(publicSettings.level_1_commission || 5).toFixed(2);
  const l2Rate = Number(publicSettings.level_2_commission || 2).toFixed(2);
  const minWithdrawal = formatBDT(publicSettings.min_withdrawal || 500);
  const minOrder = formatBDT(publicSettings.min_qualifying_order || 200);
  const maxWithdrawal = formatBDT(publicSettings.max_withdrawal || 50000);

  const copy = isBn
    ? {
        heroKicker: 'ছোট পদক্ষেপ · স্পষ্ট অগ্রগতি',
        heroLine1: 'আপনার',
        heroLine2: 'ওয়ালেট।',
        heroLine3: 'আয়ের আরও',
        heroLine4: 'পরিষ্কার পথ।',
        heroDesc:
          'আপনার bKash, Nagad, Rocket, Upay বা Bank ওয়ালেট যুক্ত করুন। সম্পন্ন পেমেন্ট দেখুন, কমিশনের হিসাব বুঝুন এবং একই জায়গা থেকে উত্তোলন পরিচালনা করুন।',
        heroPrimaryCta: user ? 'ড্যাশবোর্ডে প্রবেশ করুন' : 'আপনার অ্যাকাউন্ট তৈরি করুন',
        heroSecondaryCta: 'কিভাবে কাজ করে দেখুন',
        supportedLabel: 'যেসব ওয়ালেট চলে',
        previewTopNote: 'প্রতিদিন, আরও একটু স্বচ্ছতা।',
        previewCardTag: 'GO PAY BD / ওয়ালেট',
        previewCardSub: 'সবকিছু এক জায়গায়',
        previewCardTitle: 'আপনার ওয়ালেট, স্পষ্টভাবে।',
        previewCardFooter: 'ব্যালেন্স · কমিশন · উত্তোলনের অবস্থা',
        previewRow1Title: 'প্রতিটি সম্পন্ন পেমেন্ট দেখুন',
        previewRow1Desc: 'অর্ডার থেকে কমিশন পর্যন্ত স্পষ্ট রেকর্ড।',
        previewRow2Title: 'উত্তোলনের অবস্থা জানুন',
        previewRow2Desc: 'যখন প্রয়োজন, অগ্রগতি দেখুন।',
        previewCalloutTitle: 'স্পষ্ট রেকর্ড। কম অনিশ্চয়তা।',
        previewCalloutDesc: 'আপনার কার্যক্রম সবসময় হাতের কাছে।',
        previewBottomNote: 'নমুনা চিত্র · সরাসরি অ্যাকাউন্টের তথ্য নয়',
        stripTitle: 'দৈনন্দিন কাজ আরও সহজ।',
        stripItems: [
          'ওয়ালেটের কার্যক্রম এক নজরে',
          'কমিশনের হিসাব বুঝুন',
          'উত্তোলনের অগ্রগতি এক নজরে',
        ],
        stepsTitle: 'তিন ধাপ। একটি স্পষ্ট চিত্র।',
        stepsRightNote: 'সেটআপ করুন, তারপর অগ্রগতি দেখুন।',
        steps: [
          {
            num: '01',
            title: 'নিজের জায়গা তৈরি করুন',
            body: 'ইমেইল, মোবাইল নাম্বার ও পাসওয়ার্ড দিয়ে GO PAY BD অ্যাকাউন্ট তৈরি করুন। এখানেই আপনার ওয়ালেটের সব কার্যক্রম ও লেনদেন একসঙ্গে থাকবে।',
          },
          {
            num: '02',
            title: 'ওয়ালেট যুক্ত করুন',
            body: 'bKash, Nagad, Rocket, Upay, CellFin বা Bank ওয়ালেট যুক্ত করুন, ৬-ডিজিট ফোন কোড দিয়ে যাচাই করুন এবং অ্যাক্টিভ করুন।',
          },
          {
            num: '03',
            title: 'প্রতিটি অগ্রগতি দেখুন',
            body: 'সম্পন্ন অর্ডার দেখুন, কমিশন পর্যালোচনা করুন এবং যোগ্য হলে সরাসরি আপনার অ্যাক্টিভ ওয়ালেটে উত্তোলনের অনুরোধ করুন।',
          },
        ],
        commKicker: 'আপনার কমিশন',
        commTitle: 'কমিশনের হিসাবে অনিশ্চয়তা নয়।',
        commRightNote: 'প্ল্যাটফর্মের বর্তমান রেট স্পষ্টভাবে দেখুন।',
        commCards: [
          {
            label: 'bKash · ডিপোজিট ফি',
            value: '0.00%',
            desc: null,
          },
          {
            label: 'bKash · লেভেল ১ অর্ডার কমিশন',
            value: `${l1Rate}%`,
            desc: null,
          },
          {
            label: 'bKash · ন্যূনতম উত্তোলন সীমা',
            value: minWithdrawal,
            desc: 'ভেরিফায়েড ও অ্যাক্টিভ bKash ওয়ালেটে সরাসরি উত্তোলন করতে পারবেন। অনুরোধ জমা দেওয়ার পর ব্যালেন্স সুরক্ষিত থাকে এবং নির্ধারিত সময়ে পেমেন্ট সম্পন্ন হয়।',
          },
          {
            label: 'Nagad · ডিপোজিট ফি',
            value: '0.00%',
            desc: null,
          },
          {
            label: 'Nagad · লেভেল ২ নেটওয়ার্ক কমিশন',
            value: `${l2Rate}%`,
            desc: null,
          },
          {
            label: 'সকল ওয়ালেট · ন্যূনতম যোগ্য অর্ডার',
            value: minOrder,
            desc: `রেফারেল কমিশন শুধুমাত্র সম্পন্ন হওয়া যোগ্য অর্ডারের ওপর প্রযোজ্য। Nagad, Rocket, Upay, CellFin বা Bank ওয়ালেট অ্যাক্টিভ থাকলেই ${maxWithdrawal} পর্যন্ত উত্তোলন করা যায়।`,
          },
        ],
        commFootnote:
          'আপনার অ্যাকাউন্টে প্রযোজ্য রেট, ফি এবং উত্তোলনের শর্ত দেখানো হয়। সম্পন্ন যোগ্য অর্ডারের ভিত্তিতে কমিশন হিসাব হয়।',
        placeTitle: 'সবকিছুর নিজের জায়গা।',
        placeRightNote: 'যখন প্রয়োজন, প্রয়োজনীয় তথ্য পান।',
        placeCards: [
          {
            title: 'সব ওয়ালেট একসঙ্গে',
            body: 'এক অ্যাকাউন্ট থেকে প্রতিটি যুক্ত ওয়ালেটের ব্যালেন্স, OTP ভেরিফিকেশন এবং কার্যক্রমের অবস্থা দেখুন।',
          },
          {
            title: 'আয়ের হিসাব দেখুন',
            body: 'সম্পন্ন অর্ডারের রেকর্ড, পিডিএফ ইনভয়েস এবং প্রতিটি কমিশনের রেটের হিসাব স্পষ্টভাবে দেখুন।',
          },
          {
            title: 'প্রতি ধাপের অগ্রগতি',
            body: 'যোগ্য উত্তোলনের অনুরোধ জমা দিন এবং প্রক্রিয়াকরণ থেকে পেমেন্ট সম্পন্ন হওয়া পর্যন্ত প্রতিটি ধাপ দেখুন।',
          },
        ],
        faqKicker: 'সাধারণ প্রশ্ন',
        faqTitle: 'কিছু বিষয় জেনে নিন।',
        faqSub: 'ওয়ালেট যুক্ত করার আগে নিয়মগুলো বুঝে নিন।',
        faqs: [
          {
            q: 'কোন কোন ওয়ালেট যুক্ত করতে পারি?',
            a: 'আপনি আপনার GO PAY BD অ্যাকাউন্টে bKash, Nagad, Rocket, Upay, CellFin এবং Bank Account যুক্ত করতে পারবেন। ওয়ালেট অ্যাড করার পর ৬-ডিজিট ফোন কোড (OTP) দিয়ে যাচাই করলেই সেটি Active হিসেবে যুক্ত হয়ে যাবে।',
          },
          {
            q: 'ওয়ালেট যুক্ত করার সময় কি আসল bKash বা Nagad পিন দিতে হয়?',
            a: 'কখনোই না। GO PAY BD কখনোই আপনার আসল bKash, Nagad বা ব্যাংকিং পিন চায় না। ওয়ালেট লিংক করার সময় শুধুমাত্র এই অ্যাপের নিজস্ব নিরাপত্তার জন্য আলাদা একটি App Security PIN সেট করতে হয় (যা SHA-256 হ্যাশ করে সুরক্ষিত রাখা হয়)।',
          },
          {
            q: 'কমিশন কীভাবে হিসাব করা হয়?',
            a: `শুধুমাত্র সম্পন্ন হওয়া যোগ্য পণ্য বা সার্ভিস অর্ডার (ন্যূনতম ${minOrder}) থেকেই কমিশন তৈরি হয়—সাইন-আপ বা ডিপোজিট থেকে নয়। লেভেল ১ রেফারেল থেকে ${l1Rate}% এবং লেভেল ২ রেফারেল থেকে ${l2Rate}% কমিশন সরাসরি আপনার ওয়ালেটে যুক্ত হয়।`,
          },
          {
            q: 'উত্তোলন কীভাবে কাজ করে?',
            a: `আপনার ব্যবহারযোগ্য ব্যালেন্স থেকে ${minWithdrawal} থেকে ${maxWithdrawal} পর্যন্ত যেকোনো অ্যাক্টিভ যুক্ত ওয়ালেটে উত্তোলনের অনুরোধ করতে পারবেন। প্রক্রিয়াকরণ সময়: ${publicSettings.withdrawal_processing_time}।`,
          },
        ],
        ctaKicker: 'আপনার পরের পদক্ষেপ',
        ctaTitle: 'প্রতিদিন একটু অগ্রগতি।',
        ctaSub: 'GO PAY BD-তে ওয়ালেটের কার্যক্রম স্পষ্টভাবে দেখুন।',
        ctaBtn: user ? 'ড্যাশবোর্ডে যান' : 'আপনার অ্যাকাউন্ট তৈরি করুন',
      }
    : {
        heroKicker: 'Small steps · Clear progress',
        heroLine1: 'Your',
        heroLine2: 'Wallet.',
        heroLine3: 'A clearer path',
        heroLine4: 'to earning.',
        heroDesc:
          'Link your bKash, Nagad, Rocket, Upay, or Bank wallet. Review completed payments, understand exact commission rates, and manage withdrawals from one clean workspace.',
        heroPrimaryCta: user ? 'Open your dashboard' : 'Create your account',
        heroSecondaryCta: 'See how it works',
        supportedLabel: 'Supported wallets',
        previewTopNote: 'Every day, a little more clarity.',
        previewCardTag: 'GO PAY BD / Wallet',
        previewCardSub: 'Everything in one place',
        previewCardTitle: 'Your wallet, clearly.',
        previewCardFooter: 'Balance · Commission · Withdrawal status',
        previewRow1Title: 'Track every completed payment',
        previewRow1Desc: 'Clear ledger records from order to commission.',
        previewRow2Title: 'Know your withdrawal status',
        previewRow2Desc: 'Follow payout progress whenever you need.',
        previewCalloutTitle: 'Clear records. Less guesswork.',
        previewCalloutDesc: 'Your entire activity stays within reach.',
        previewBottomNote: 'Illustrative preview · Not live account data',
        stripTitle: 'Everyday tasks made simpler.',
        stripItems: [
          'Wallet activity at a glance',
          'Understand commission rates',
          'Withdrawal progress at a glance',
        ],
        stepsTitle: 'Three steps. One clear picture.',
        stepsRightNote: 'Set up once, then track progress.',
        steps: [
          {
            num: '01',
            title: 'Create your space',
            body: 'Create your GO PAY BD account with your email, mobile number, and password. All your wallet balances, orders, and records stay organized together.',
          },
          {
            num: '02',
            title: 'Link your wallet',
            body: 'Connect bKash, Nagad, Rocket, Upay, CellFin, or Bank accounts, confirm with a 6-digit phone verification code, and activate instantly.',
          },
          {
            num: '03',
            title: 'Follow every step',
            body: 'Review completed orders, monitor live order commissions, and request withdrawals directly to your active linked wallets.',
          },
        ],
        commKicker: 'Your commission',
        commTitle: 'No guesswork in your commission.',
        commRightNote: 'View current platform rates clearly.',
        commCards: [
          {
            label: 'bKash · Deposit fee',
            value: '0.00%',
            desc: null,
          },
          {
            label: 'bKash · Level 1 order commission',
            value: `${l1Rate}%`,
            desc: null,
          },
          {
            label: 'bKash · Minimum withdrawal',
            value: minWithdrawal,
            desc: 'Withdraw directly to your OTP-verified active bKash wallet. Requested balances are reserved safely until payout confirmation is complete.',
          },
          {
            label: 'Nagad · Deposit fee',
            value: '0.00%',
            desc: null,
          },
          {
            label: 'Nagad · Level 2 network commission',
            value: `${l2Rate}%`,
            desc: null,
          },
          {
            label: 'All wallets · Minimum qualifying order',
            value: minOrder,
            desc: `Referral commissions apply strictly to completed qualifying orders. Active Nagad, Rocket, Upay, CellFin, or Bank accounts support payouts up to ${maxWithdrawal}.`,
          },
        ],
        commFootnote:
          'Applicable rates, fees, and withdrawal rules are always visible in your account. Commissions are earned strictly from completed qualifying orders.',
        placeTitle: 'Everything in its own place.',
        placeRightNote: 'Get the exact details when you need them.',
        placeCards: [
          {
            title: 'All wallets together',
            body: 'Check balances, OTP verification status, and activity across every linked wallet from one account.',
          },
          {
            title: 'Clear earnings ledger',
            body: 'Review completed order records, downloadable PDF invoices, and exact commission breakdowns.',
          },
          {
            title: 'Progress at every step',
            body: 'Submit eligible withdrawal requests and track processing through final payout completion.',
          },
        ],
        faqKicker: 'Common questions',
        faqTitle: 'A few things to know.',
        faqSub: 'Review the key rules before linking your wallet.',
        faqs: [
          {
            q: 'Which wallets can I link?',
            a: 'You can link bKash, Nagad, Rocket, Upay, CellFin, and Bank Accounts inside GO PAY BD. Complete the 6-digit phone verification code (OTP) step and your wallet immediately becomes Active for withdrawals.',
          },
          {
            q: 'Do I ever enter my real bKash or Nagad banking PIN?',
            a: 'Never. GO PAY BD never asks for or stores third-party banking PINs or passwords. You only set an isolated GO PAY BD App Security PIN (SHA-256 hashed) to protect your payout settings.',
          },
          {
            q: 'How is commission calculated?',
            a: `Commissions are earned strictly from completed qualifying product or service orders (minimum ${minOrder})—never from sign-ups or deposits. Level 1 earns ${l1Rate}% and Level 2 earns ${l2Rate}%.`,
          },
          {
            q: 'How do withdrawals work?',
            a: `Request withdrawals between ${minWithdrawal} and ${maxWithdrawal} from your available balance to any Active linked wallet. Standard processing window: ${publicSettings.withdrawal_processing_time}.`,
          },
        ],
        ctaKicker: 'Your next step',
        ctaTitle: 'A little progress every day.',
        ctaSub: 'See all your wallet activity clearly on GO PAY BD.',
        ctaBtn: user ? 'Open Dashboard' : 'Create your account',
      };

  const placeIcons = [Wallet, ReceiptText, TrendingUp];

  return (
    <div className="bg-[#F4F7FB] text-[#0F172A]">
      {/* 1. HERO SECTION */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-14 lg:pt-16 lg:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
          {/* Left Editorial Statement */}
          <div className="lg:col-span-6">
            <p className="text-xs font-semibold tracking-wide text-[#0D9488] mb-5">
              {copy.heroKicker}
            </p>

            <h1 className="text-[2.6rem] sm:text-[3.5rem] lg:text-[4rem] font-bold tracking-tight text-[#0F172A] leading-[1.08] [text-wrap:balance]">
              <span className="block">{copy.heroLine1}</span>
              <span className="block">{copy.heroLine2}</span>
              <span className="block">{copy.heroLine3}</span>
              <span className="relative inline-block">
                <span className="relative z-10">{copy.heroLine4}</span>
                <span
                  aria-hidden="true"
                  className="absolute left-0 right-0 bottom-1.5 h-3 bg-[#99F6E4]/80 -z-0 rounded-xs"
                />
              </span>
            </h1>

            <p className="mt-6 text-[15px] sm:text-base text-[#475569] max-w-lg leading-[1.7]">
              {copy.heroDesc}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-5">
              <Link
                to={user ? '/dashboard' : '/register'}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg text-sm font-semibold bg-[#0D9488] text-white hover:bg-[#0F766E] transition-colors shadow-xs whitespace-nowrap"
              >
                {copy.heroPrimaryCta}
                <ArrowUpRight className="w-4 h-4" />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0F172A] hover:text-[#0D9488] transition-colors whitespace-nowrap"
              >
                {copy.heroSecondaryCta}
                <ArrowDown className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Supported Wallets Clean Typographic Row */}
            <div className="mt-9 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
              <span className="text-[#64748B] mr-1">{copy.supportedLabel}</span>
              <span className="font-bold text-[#E2136E]">bKash</span>
              <span className="text-[#CBD5E1]">/</span>
              <span className="font-bold text-[#EA580C]">Nagad</span>
              <span className="text-[#CBD5E1]">/</span>
              <span className="font-bold text-[#7C3AED]">Rocket</span>
              <span className="text-[#CBD5E1]">/</span>
              <span className="font-bold text-[#0284C7]">Upay</span>
              <span className="text-[#CBD5E1]">/</span>
              <span className="font-bold text-[#0F766E]">CellFin</span>
              <span className="text-[#CBD5E1]">/</span>
              <span className="font-bold text-[#0F172A]">Bank</span>
            </div>
          </div>

          {/* Right Architectural Wallet Preview Stage */}
          <div className="lg:col-span-6">
            <div className="relative bg-[#E7EFF7] border border-[#D4E0EE] rounded-[24px] p-6 sm:p-8 overflow-hidden">
              {/* Subtle Architectural Concentric Arcs */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-24 -top-12 w-80 h-80 rounded-full border border-[#CBD9E9]/80"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-12 top-6 w-64 h-64 rounded-full border border-[#CBD9E9]/60"
              />

              <p className="relative z-10 text-xs font-medium text-[#475569] mb-5">
                {copy.previewTopNote}
              </p>

              {/* Tilted Wallet UI Mockup Card */}
              <div className="relative z-10 bg-white rounded-2xl border border-[#D4E0EE] shadow-xl overflow-hidden transform -rotate-[1.5deg] hover:rotate-0 transition-transform duration-300">
                {/* Dark Navy Top Face */}
                <div className="bg-gradient-to-br from-[#0F172A] via-[#132238] to-[#0E3A47] text-white px-6 py-6">
                  <div className="text-[11px] font-semibold text-[#5EEAD4]">
                    {copy.previewCardTag}
                  </div>
                  <div className="mt-4 text-xs text-[#94A3B8]">{copy.previewCardSub}</div>
                  <div className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-white">
                    {copy.previewCardTitle}
                  </div>
                  <div className="mt-4 text-[11px] text-[#94A3B8]">
                    {copy.previewCardFooter}
                  </div>
                </div>

                {/* Crisp White Checklist Body */}
                <div className="divide-y divide-[#EDF2F7] px-6 py-2">
                  <div className="py-4 flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#F0FDFA] text-[#0D9488] flex items-center justify-center shrink-0 mt-0.5">
                        <ListChecks className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[#0F172A]">
                          {copy.previewRow1Title}
                        </div>
                        <div className="text-xs text-[#64748B] mt-0.5">
                          {copy.previewRow1Desc}
                        </div>
                      </div>
                    </div>
                    <Check className="w-4 h-4 text-[#0D9488] shrink-0" />
                  </div>

                  <div className="py-4 flex items-center justify-between gap-4 pb-10 sm:pb-8">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#F0F9FF] text-[#0284C7] flex items-center justify-center shrink-0 mt-0.5">
                        <ArrowRightLeft className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[#0F172A]">
                          {copy.previewRow2Title}
                        </div>
                        <div className="text-xs text-[#64748B] mt-0.5">
                          {copy.previewRow2Desc}
                        </div>
                      </div>
                    </div>
                    <Check className="w-4 h-4 text-[#0284C7] shrink-0" />
                  </div>
                </div>
              </div>

              {/* Bottom Floating Accent Callout + Disclaimer */}
              <div className="relative z-20 mt-4 sm:-mt-7 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <p className="text-[11px] text-[#64748B] order-2 sm:order-1">
                  {copy.previewBottomNote}
                </p>

                <div className="order-1 sm:order-2 sm:mr-2 bg-[#0D9488] text-white rounded-xl px-4 py-3 shadow-lg flex items-start gap-2.5 max-w-[270px]">
                  <CheckCircle2 className="w-4 h-4 text-[#CCFBF1] shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold leading-snug">
                      {copy.previewCalloutTitle}
                    </div>
                    <div className="text-[11px] text-[#CCFBF1] mt-0.5 leading-snug">
                      {copy.previewCalloutDesc}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. HORIZONTAL FEATURE HIGHLIGHT STRIP */}
      <section className="border-y border-[#DCE4EF] bg-white/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center text-xs sm:text-[13px]">
            <div className="font-bold text-[#0F172A]">{copy.stripTitle}</div>
            {copy.stripItems.map((item, index) => (
              <div key={index} className="flex items-center gap-2 text-[#475569]">
                <span className="text-[#0D9488] font-mono text-[11px]">0{index + 1}</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. THREE STEPS SECTION */}
      <section id="how-it-works" className="scroll-mt-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-7 border-b border-[#DCE4EF]">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A]">
            {copy.stepsTitle}
          </h2>
          <p className="text-xs sm:text-sm text-[#64748B]">{copy.stepsRightNote}</p>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          {copy.steps.map((step) => (
            <div key={step.num} className="flex items-start gap-4">
              <span className="font-mono text-2xl font-medium text-[#94A3B8] leading-none pt-0.5 tabular-nums">
                {step.num}
              </span>
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">{step.title}</h3>
                <p className="mt-2 text-sm text-[#475569] leading-[1.65]">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. COMMISSION & TRANSPARENCY GRID */}
      <section id="commission" className="scroll-mt-20 bg-[#E9F0F8]/75 border-y border-[#DCE4EF] py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold text-[#0D9488] mb-2">{copy.commKicker}</p>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-9">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A]">
              {copy.commTitle}
            </h2>
            <p className="text-xs sm:text-sm text-[#64748B]">{copy.commRightNote}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {copy.commCards.map((card, i) => (
              <div
                key={i}
                className="bg-white border border-[#DCE4EF] rounded-2xl p-6 flex flex-col justify-between min-h-[172px]"
              >
                <div>
                  <div className="text-xs font-medium text-[#64748B]">{card.label}</div>
                  <div className="mt-3 font-mono text-3xl font-bold tracking-tight text-[#0F172A] tabular-nums">
                    {card.value}
                  </div>
                </div>
                {card.desc && (
                  <p className="mt-4 text-xs text-[#475569] leading-[1.65]">{card.desc}</p>
                )}
              </div>
            ))}
          </div>

          <p className="mt-6 text-xs text-[#64748B]">{copy.commFootnote}</p>
        </div>
      </section>

      {/* 5. EVERYTHING IN ITS PLACE */}
      <section id="features" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-9">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A]">
            {copy.placeTitle}
          </h2>
          <p className="text-xs sm:text-sm text-[#64748B]">{copy.placeRightNote}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {copy.placeCards.map((card, i) => {
            const Icon = placeIcons[i];
            return (
              <div
                key={card.title}
                className="bg-white border border-[#DCE4EF] rounded-2xl p-6 hover:border-[#0D9488]/40 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-[#F0FDFA] border border-[#CCFBF1] text-[#0D9488] flex items-center justify-center mb-5">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-[#0F172A]">{card.title}</h3>
                <p className="mt-2 text-sm text-[#475569] leading-[1.65]">{card.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. SPLIT EDITORIAL FAQ SECTION */}
      <section id="faq" className="scroll-mt-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 border-t border-[#DCE4EF]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
          {/* Left Sticky Title */}
          <div className="lg:col-span-4">
            <p className="text-xs font-semibold text-[#0D9488] mb-2">{copy.faqKicker}</p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A]">
              {copy.faqTitle}
            </h2>
            <p className="mt-3 text-sm text-[#64748B] leading-relaxed">{copy.faqSub}</p>
            <div className="mt-6 inline-flex items-center gap-2 text-xs font-medium text-[#475569]">
              <ShieldCheck className="w-4 h-4 text-[#0D9488]" />
              <span>
                {isBn
                  ? 'আসল ব্যাংকিং পিন ছাড়াই নিরাপদ ভেরিফিকেশন'
                  : 'Safe verification without banking PINs'}
              </span>
            </div>
          </div>

          {/* Right Minimal Hairline Accordion */}
          <div className="lg:col-span-8 divide-y divide-[#DCE4EF] border-y border-[#DCE4EF]">
            {copy.faqs.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={idx}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full py-5 flex items-center justify-between gap-4 text-left cursor-pointer group"
                  >
                    <span className="text-sm sm:text-[15px] font-semibold text-[#0F172A] group-hover:text-[#0D9488] transition-colors">
                      {item.q}
                    </span>
                    <span className="text-[#64748B] group-hover:text-[#0F172A] shrink-0">
                      {isOpen ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="pb-5 pr-8 text-sm text-[#475569] leading-[1.7]">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 7. DARK BOTTOM CTA BANNER */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 pt-4">
        <div className="bg-gradient-to-r from-[#0F172A] via-[#132238] to-[#0E3A47] rounded-2xl px-7 py-9 sm:px-12 sm:py-11 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-lg">
          <div>
            <p className="text-xs font-semibold text-[#2DD4BF] mb-2">{copy.ctaKicker}</p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {copy.ctaTitle}
            </h2>
            <p className="mt-2 text-sm text-[#CBD5E1]">{copy.ctaSub}</p>
          </div>
          <Link
            to={user ? '/dashboard' : '/register'}
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg text-sm font-semibold bg-[#0D9488] text-white hover:bg-[#14B8A6] transition-colors shrink-0 whitespace-nowrap"
          >
            {copy.ctaBtn}
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
};
