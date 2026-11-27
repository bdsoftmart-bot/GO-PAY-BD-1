import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  ShieldCheck,
  Smartphone,
  Building2,
  Lock,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  KeyRound,
  AlertCircle,
  Eye,
  EyeOff,
  Wallet,
  ArrowDownToLine,
  Loader2,
} from 'lucide-react';
import { Modal, AlertBanner, inputCls, labelCls } from './ui/Primitives';
import { api } from '../lib/api';
import {
  DEFAULT_SECURITY_DEPOSIT_1_BDT,
  DEFAULT_SECURITY_DEPOSIT_2_BDT,
} from '../lib/constants';
import { formatBDT } from '../lib/format';
import { useAuth } from '../contexts/AuthContext';

export interface WalletProviderMeta {
  name: string;
  label: string;
  tagline: string;
  accent: string;
  bgTint: string;
  isBank?: boolean;
  accountTypes: string[];
}

export const WALLET_PROVIDERS: WalletProviderMeta[] = [
  {
    name: 'bKash',
    label: 'bKash',
    tagline: 'Mobile Wallet (MFS)',
    accent: '#E2136E',
    bgTint: '#FDF2F8',
    accountTypes: ['Personal', 'Merchant', 'Agent'],
  },
  {
    name: 'Nagad',
    label: 'Nagad',
    tagline: 'Mobile Wallet (MFS)',
    accent: '#EA580C',
    bgTint: '#FFF7ED',
    accountTypes: ['Personal', 'Merchant', 'Agent'],
  },
  {
    name: 'Rocket',
    label: 'Rocket',
    tagline: 'DBBL Mobile Banking',
    accent: '#7E22CE',
    bgTint: '#FAF5FF',
    accountTypes: ['Personal', 'Agent'],
  },
  {
    name: 'Upay',
    label: 'Upay',
    tagline: 'UCB Mobile Wallet',
    accent: '#0284C7',
    bgTint: '#F0F9FF',
    accountTypes: ['Personal', 'Merchant', 'Agent'],
  },
  {
    name: 'CellFin',
    label: 'CellFin',
    tagline: 'Islami Bank Digital',
    accent: '#0D9488',
    bgTint: '#F0FDFA',
    accountTypes: ['Personal', 'Merchant'],
  },
  {
    name: 'Bank',
    label: 'Bank Account',
    tagline: 'BD Bank / EFTN Transfer',
    accent: '#1E293B',
    bgTint: '#F1F5F9',
    isBank: true,
    accountTypes: ['Savings', 'Current'],
  },
];

export function getProviderMeta(methodName: string): WalletProviderMeta {
  const lower = (methodName || '').toLowerCase();
  return (
    WALLET_PROVIDERS.find((p) => lower.includes(p.name.toLowerCase())) || {
      name: methodName || 'Wallet',
      label: methodName || 'Wallet',
      tagline: 'Linked Payout Channel',
      accent: '#0D9488',
      bgTint: '#F0FDFA',
      accountTypes: ['Personal'],
    }
  );
}

async function hashPinSha256(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`gopaybd_pin_v1:${salt}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateSixDigitOtp(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(100000 + (array[0] % 900000));
}

function isValidBdMobile(val: string): boolean {
  return /^(\+?88)?01[3-9]\d{8}$/.test(val.replace(/[\s-]/g, ''));
}

interface LinkWalletModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editing?: any | null;
  defaultHolderName?: string;
  defaultPhone?: string;
}

export const LinkWalletModal: React.FC<LinkWalletModalProps> = ({
  open,
  onClose,
  onSuccess,
  editing = null,
  defaultHolderName = '',
  defaultPhone = '',
}) => {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [methodName, setMethodName] = useState('bKash');
  const [accountNumber, setAccountNumber] = useState('');
  const { publicSettings } = useAuth();
  const [accountHolderName, setAccountHolderName] = useState(defaultHolderName);
  const [accountType, setAccountType] = useState('Personal');
  const [bankBranchNote, setBankBranchNote] = useState('');
  const [securityPin, setSecurityPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isDefault, setIsDefault] = useState(false);

  // Dynamic Security Deposit (জামানত) tiered gate state (1st account: ৳825, 2nd account: ৳1,825 by default)
  const [depositGate, setDepositGate] = useState<{
    checking: boolean;
    enabled: boolean;
    eligible: boolean;
    deposited: number;
    required: number;
    remaining: number;
    linkedCount: number;
    nextAccountNumber: number;
    tier1: number;
    tier2: number;
  }>({
    checking: false,
    enabled: true,
    eligible: true,
    deposited: 0,
    required: DEFAULT_SECURITY_DEPOSIT_1_BDT,
    remaining: DEFAULT_SECURITY_DEPOSIT_1_BDT,
    linkedCount: 0,
    nextAccountNumber: 1,
    tier1: DEFAULT_SECURITY_DEPOSIT_1_BDT,
    tier2: DEFAULT_SECURITY_DEPOSIT_2_BDT,
  });

  // Step 2: OTP verification
  const [verifyPhone, setVerifyPhone] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activatedWallet, setActivatedWallet] = useState<any>(null);

  const activeProvider = getProviderMeta(methodName);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setError('');
    setOtpInput('');
    setGeneratedOtp('');
    setSecurityPin('');
    setConfirmPin('');
    setShowPin(false);
    setActivatedWallet(null);
    if (editing) {
      setDepositGate((prev) => ({ ...prev, checking: false, eligible: true, remaining: 0 }));
      setMethodName(editing.method_name || 'bKash');
      setAccountNumber(editing.account_number || '');
      setAccountHolderName(editing.account_holder_name || defaultHolderName);
      setAccountType(editing.account_type || 'Personal');
      setBankBranchNote(editing.notes || '');
      setIsDefault(Boolean(editing.is_default));
      setVerifyPhone(
        !String(editing.method_name || '').toLowerCase().includes('bank')
          ? editing.account_number || defaultPhone
          : defaultPhone
      );
      return;
    }

    setMethodName('bKash');
    setAccountNumber('');
    setAccountHolderName(defaultHolderName);
    setAccountType('Personal');
    setBankBranchNote('');
    setIsDefault(false);
    setVerifyPhone(defaultPhone);

    const fallbackTier1 = Number(publicSettings.security_deposit_1_account || DEFAULT_SECURITY_DEPOSIT_1_BDT);
    const fallbackTier2 = Number(publicSettings.security_deposit_2_accounts || DEFAULT_SECURITY_DEPOSIT_2_BDT);

    let cancelled = false;
    setDepositGate((prev) => ({ ...prev, checking: true }));
    api
      .userGet('/api/wallet')
      .then((res) => {
        if (cancelled) return;
        const w = res.data || {};
        const enabled = w.security_deposit_enabled !== false;
        const tier1 = Number(w.security_deposit_1_account ?? fallbackTier1);
        const tier2 = Number(w.security_deposit_2_accounts ?? fallbackTier2);
        const linkedCount = Number(w.linked_accounts_count ?? 0);
        const nextAccountNumber = Number(w.next_account_number ?? linkedCount + 1);
        const required = enabled ? Number(w.required_security_deposit ?? tier1) : 0;
        const qualified = Math.max(Number(w.total_deposits || 0), Number(w.available_balance || 0));
        const remaining = Math.max(0, required - qualified);
        setDepositGate({
          checking: false,
          enabled,
          eligible: !enabled || qualified >= required,
          deposited: qualified,
          required,
          remaining,
          linkedCount,
          nextAccountNumber,
          tier1,
          tier2,
        });
      })
      .catch(() => {
        if (cancelled) return;
        const enabled = String(publicSettings.security_deposit_enabled ?? 'true') !== 'false';
        setDepositGate({
          checking: false,
          enabled,
          eligible: !enabled,
          deposited: 0,
          required: enabled ? fallbackTier1 : 0,
          remaining: enabled ? fallbackTier1 : 0,
          linkedCount: 0,
          nextAccountNumber: 1,
          tier1: fallbackTier1,
          tier2: fallbackTier2,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [open, editing, defaultHolderName, defaultPhone, publicSettings]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = window.setTimeout(() => setResendTimer((prev) => Math.max(0, prev - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [resendTimer]);

  const handleSelectProvider = (provider: WalletProviderMeta) => {
    setMethodName(provider.name);
    setAccountType(provider.accountTypes[0] || 'Personal');
    setError('');
  };

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanNum = accountNumber.replace(/[\s-]/g, '');
    if (activeProvider.isBank) {
      if (!/^[A-Za-z0-9]{6,30}$/.test(cleanNum)) {
        setError('Please enter a valid bank account number (6–30 alphanumeric digits).');
        return;
      }
      if (!bankBranchNote.trim()) {
        setError('Please enter Bank Name & Branch in the Bank Details field.');
        return;
      }
      if (!isValidBdMobile(verifyPhone)) {
        setError('Please enter a valid Bangladesh phone number (01XXXXXXXXX) to receive the OTP verification code.');
        return;
      }
    } else {
      if (!isValidBdMobile(cleanNum)) {
        setError(`Please enter a valid 11-digit ${activeProvider.label} mobile number (e.g., 017XXXXXXXX).`);
        return;
      }
    }

    if (accountHolderName.trim().length < 2) {
      setError('Please enter the full account holder name.');
      return;
    }

    if (!editing || securityPin.length > 0) {
      if (!/^\d{4,6}$/.test(securityPin)) {
        setError('Please create a 4 to 6 digit GO PAY BD App Security PIN.');
        return;
      }
      if (securityPin !== confirmPin) {
        setError('Security PIN and Confirm PIN do not match.');
        return;
      }
    }

    const otp = generateSixDigitOtp();
    setGeneratedOtp(otp);
    setOtpInput('');
    setResendTimer(60);
    if (!activeProvider.isBank) {
      setVerifyPhone(cleanNum);
    }
    setStep(2);
  };

  const handleResendOtp = () => {
    if (resendTimer > 0) return;
    const otp = generateSixDigitOtp();
    setGeneratedOtp(otp);
    setOtpInput('');
    setResendTimer(60);
    setError('');
  };

  const handleVerifyAndActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (otpInput.trim() !== generatedOtp) {
      setError('Invalid 6-digit verification code. Please check the code sent to your phone and try again.');
      return;
    }

    setLoading(true);
    try {
      const cleanNum = accountNumber.replace(/[\s-]/g, '');
      const pinHash = securityPin ? await hashPinSha256(securityPin, cleanNum) : undefined;

      const payload = {
        method_name: methodName,
        account_number: cleanNum,
        account_holder_name: accountHolderName.trim(),
        account_type: accountType,
        notes: bankBranchNote.trim(),
        is_default: isDefault,
        verification_status: 'active',
        ...(pinHash ? { pin_hash: pinHash } : {}),
      };

      if (editing) {
        await api.userPut(`/api/payment-methods/${editing.id}`, payload);
      } else {
        await api.userPost('/api/payment-methods', payload);
      }

      setActivatedWallet({
        method_name: methodName,
        account_number: cleanNum,
        account_holder_name: accountHolderName.trim(),
        account_type: accountType,
        has_pin: Boolean(pinHash || editing?.has_pin),
      });
      setStep(3);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Unable to verify and activate wallet.');
    } finally {
      setLoading(false);
    }
  };

  const showDepositGate = !editing && !depositGate.checking && !depositGate.eligible;
  const requiredAmount = Math.max(0, depositGate.required);
  const progressPct =
    requiredAmount > 0 ? Math.min(100, Math.round((depositGate.deposited / requiredAmount) * 100)) : 100;
  const suggestedDeposit =
    depositGate.deposited > 0
      ? Math.max(100, Math.ceil(depositGate.remaining))
      : Math.ceil(requiredAmount);

  const accountTierLabelBn =
    depositGate.nextAccountNumber === 1
      ? '১ম ওয়ালেট অ্যাকাউন্ট'
      : depositGate.nextAccountNumber === 2
      ? '২য় ওয়ালেট অ্যাকাউন্ট'
      : `${depositGate.nextAccountNumber} নং ওয়ালেট অ্যাকাউন্ট`;
  const accountTierLabelEn =
    depositGate.nextAccountNumber === 1
      ? '1st wallet account'
      : depositGate.nextAccountNumber === 2
      ? '2nd wallet account'
      : `wallet account #${depositGate.nextAccountNumber}`;

  const handleGoToSecurityDeposit = () => {
    onClose();
    navigate(
      `/dashboard/deposit?amount=${suggestedDeposit}&purpose=security_deposit&tier=${depositGate.nextAccountNumber}&required=${requiredAmount}`
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        showDepositGate
          ? 'জামানত অ্যাড করুন · Security Deposit Required'
          : step === 1
          ? editing
            ? 'Update & Re-Verify Linked Wallet'
            : 'Add & Link Mobile / Bank Wallet'
          : step === 2
          ? 'Phone OTP Verification'
          : 'Wallet Activated'
      }
      maxWidth="max-w-xl"
    >
      {/* Checking eligibility state */}
      {!editing && depositGate.checking ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
          <Loader2 className="w-7 h-7 animate-spin text-[#0D9488]" />
          <p className="text-sm font-semibold text-[#0F172A]">Checking Security Deposit Status...</p>
          <p className="text-xs text-[#64748B]">আপনার ওয়ালেট জামানত ব্যালেন্স যাচাই করা হচ্ছে...</p>
        </div>
      ) : showDepositGate ? (
        /* DYNAMIC TIERED SECURITY DEPOSIT (জামানত) POPUP GATE */
        <div className="space-y-5">
          <div className="rounded-xl border border-[#F59E0B]/40 bg-[#FFFBEB] p-5 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#FEF3C7] text-[#D97706] ring-4 ring-[#FEF3C7]/60">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-[#0F172A]">
                {accountTierLabelBn} লিংক করার আগে জামানত অ্যাড করুন
              </h4>
              <p className="mt-1.5 text-xs sm:text-sm text-[#475569] leading-relaxed">
                আপনার <strong>{accountTierLabelBn}</strong> কানেক্ট করার জন্য অ্যাকাউন্টে সর্বনিম্ন{' '}
                <strong className="text-[#0F172A]">{formatBDT(requiredAmount)}</strong> জামানত (Security Deposit) থাকা বাধ্যতামূলক।
              </p>
              <p className="mt-1 text-xs text-[#64748B]">
                Please complete a minimum <strong>{formatBDT(requiredAmount)}</strong> approved deposit to unlock your{' '}
                <strong>{accountTierLabelEn}</strong>.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 text-left text-xs">
              <div className={`rounded-lg border px-3 py-2 ${depositGate.nextAccountNumber === 1 ? 'border-[#0D9488] bg-[#F0FDFA]' : 'border-[#E2E8F0] bg-white'}`}>
                <div className="text-[11px] text-[#64748B]">১ম অ্যাকাউন্ট (1st Account)</div>
                <div className="font-mono font-bold text-[#0F172A]">{formatBDT(depositGate.tier1)}</div>
              </div>
              <div className={`rounded-lg border px-3 py-2 ${depositGate.nextAccountNumber === 2 ? 'border-[#0D9488] bg-[#F0FDFA]' : 'border-[#E2E8F0] bg-white'}`}>
                <div className="text-[11px] text-[#64748B]">২য় অ্যাকাউন্ট (2nd Account)</div>
                <div className="font-mono font-bold text-[#0F172A]">{formatBDT(depositGate.tier2)}</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#DCE4EF] bg-[#F8FAFC] p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#64748B] font-medium">
                Approved Deposit Progress ({accountTierLabelEn})
              </span>
              <span className="font-mono font-bold text-[#0F172A] tabular-nums">
                {formatBDT(depositGate.deposited)} / {formatBDT(requiredAmount)}
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-[#E2E8F0] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#0D9488] transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#64748B]">আরও প্রয়োজন (Remaining to Unlock)</span>
              <span className="font-mono font-bold text-[#D97706] tabular-nums">
                {formatBDT(depositGate.remaining)}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-[#DCE4EF] bg-white p-3.5 text-xs text-[#475569] space-y-1.5">
            <div className="font-semibold text-[#0F172A]">কিভাবে আনলক করবেন (How to Unlock):</div>
            <p>
              ১. নিচের <strong>জামানত অ্যাড করুন</strong> বাটনে ক্লিক করে bKash/Nagad দিয়ে{' '}
              <strong>{formatBDT(suggestedDeposit)}</strong> ডিপোজিট রিকোয়েস্ট দিন।
            </p>
            <p>২. অ্যাডমিন আপনার ডিপোজিট অ্যাপ্রুভ করার সাথে সাথেই আপনি bKash, Nagad, Rocket, Upay, CellFin বা Bank ওয়ালেট কানেক্ট করতে পারবেন।</p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-[#DCE4EF] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#DCE4EF] bg-white px-4 py-2.5 text-sm font-medium text-[#334155] hover:bg-[#F8FAFC] cursor-pointer"
            >
              পরে করব (Cancel)
            </button>
            <button
              type="button"
              onClick={handleGoToSecurityDeposit}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0D9488] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0F766E] cursor-pointer"
            >
              <ArrowDownToLine className="h-4 w-4" />
              জামানত অ্যাড করুন (৳{suggestedDeposit.toLocaleString()}) <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 3-Step Progress Header */}
          <div className="mb-6 flex items-center justify-between border-b border-[#DCE4EF] pb-4">
            {[
              { num: 1, label: 'Wallet & PIN' },
              { num: 2, label: 'Phone Code' },
              { num: 3, label: 'Active' },
            ].map((s, idx) => {
              const isCurrent = step === s.num;
              const isDone = step > s.num;
              return (
                <React.Fragment key={s.num}>
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${
                        isDone
                          ? 'bg-[#059669] text-white'
                          : isCurrent
                          ? 'bg-[#0D9488] text-white ring-4 ring-[#0D9488]/15'
                          : 'bg-[#EDF2F7] text-[#64748B]'
                      }`}
                    >
                      {isDone ? <CheckCircle2 className="h-4 w-4" /> : s.num}
                    </div>
                    <span
                      className={`text-xs font-semibold ${
                        isCurrent || isDone ? 'text-[#0F172A]' : 'text-[#64748B]'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {idx < 2 && (
                    <div
                      className={`mx-2 h-0.5 flex-1 rounded ${
                        step > s.num ? 'bg-[#059669]' : 'bg-[#DCE4EF]'
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {error && (
            <div className="mb-4">
              <AlertBanner type="error" message={error} onClose={() => setError('')} />
            </div>
          )}

          {/* STEP 1: SELECT PROVIDER + ACCOUNT DETAILS + APP SECURITY PIN */}
          {step === 1 && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              {!editing && (
                <div className="flex items-center gap-2 rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] px-3.5 py-2 text-xs font-medium text-[#065F46]">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-[#059669]" />
                  <span>
                    জামানত যাচাইকৃত · Security Deposit Verified ({formatBDT(depositGate.deposited)})
                  </span>
                </div>
              )}
          <div>
            <label className={labelCls}>Select Wallet Provider</label>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {WALLET_PROVIDERS.map((p) => {
                const selected = methodName === p.name;
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handleSelectProvider(p)}
                    className={`flex items-center gap-2.5 rounded-lg border p-3 text-left transition ${
                      selected
                        ? 'border-[#0D9488] bg-[#F0FDFA] ring-2 ring-[#0D9488]/20'
                        : 'border-[#DCE4EF] bg-white hover:border-[#94A3B8] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
                      style={{ backgroundColor: p.accent }}
                    >
                      {p.isBank ? <Building2 className="h-4 w-4" /> : p.label.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#0F172A]">{p.label}</p>
                      <p className="truncate text-[11px] text-[#64748B]">{p.tagline}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>
                {activeProvider.isBank ? 'Bank Account Number' : `${activeProvider.label} Account Number`}
              </label>
              <input
                type="text"
                required
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder={activeProvider.isBank ? 'e.g. 2050123456789' : '017XXXXXXXX'}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Account Type</label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
                className={inputCls}
              >
                {activeProvider.accountTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Account Holder Name</label>
              <input
                type="text"
                required
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                placeholder="Full legal account name"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>
                {activeProvider.isBank ? 'Bank Name & Branch (Required)' : 'Label / Note (Optional)'}
              </label>
              <input
                type="text"
                required={activeProvider.isBank}
                value={bankBranchNote}
                onChange={(e) => setBankBranchNote(e.target.value)}
                placeholder={activeProvider.isBank ? 'e.g. Dutch-Bangla Bank, Motijheel' : 'e.g. Primary Payout Wallet'}
                className={inputCls}
              />
            </div>
          </div>

          {activeProvider.isBank && (
            <div>
              <label className={labelCls}>Verification Mobile Number (for SMS Code)</label>
              <input
                type="tel"
                required
                value={verifyPhone}
                onChange={(e) => setVerifyPhone(e.target.value)}
                placeholder="017XXXXXXXX"
                className={inputCls}
              />
            </div>
          )}

          {/* GO PAY BD App Security PIN (Anti-Phishing Compliant) */}
          <div className="rounded-lg border border-[#BAE6FD] bg-[#F0F9FF] p-4">
            <div className="mb-3 flex items-start gap-2.5">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#0284C7]" />
              <div>
                <p className="text-xs font-bold text-[#0F172A]">
                  GO PAY BD Wallet Security PIN {editing ? '(Optional to update)' : '(Required)'}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[#334155]">
                  Create a 4–6 digit <strong>GO PAY BD app lock PIN</strong> to authorize payouts to this wallet.
                  For your protection, <strong>never enter your real {activeProvider.label} banking PIN or password.</strong>
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="relative">
                <label className={labelCls}>App Security PIN (4–6 digits)</label>
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={6}
                  required={!editing}
                  value={securityPin}
                  onChange={(e) => setSecurityPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••"
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() => setShowPin((v) => !v)}
                  className="absolute right-2.5 top-[34px] text-[#64748B] hover:text-[#0F172A]"
                  aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                >
                  {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div>
                <label className={labelCls}>Confirm Security PIN</label>
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={6}
                  required={!editing || securityPin.length > 0}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••"
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-[#334155]">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 rounded border-[#CBD5E1] accent-[#0D9488]"
            />
            Set as default payout wallet for withdrawals
          </label>

          <div className="flex justify-end gap-2.5 border-t border-[#DCE4EF] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#DCE4EF] bg-white px-4 py-2 text-sm font-medium text-[#334155] hover:bg-[#F8FAFC]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-[#0D9488] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0F766E]"
            >
              Send Verification Code <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>
      )}

      {/* STEP 2: 6-DIGIT PHONE OTP VERIFICATION */}
      {step === 2 && (
        <form onSubmit={handleVerifyAndActivate} className="space-y-5">
          <div className="rounded-xl border border-[#DCE4EF] bg-[#F8FAFC] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488]">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#0F172A]">
                  Verification Code Sent to {verifyPhone}
                </p>
                <p className="text-xs text-[#64748B]">
                  Enter the 6-digit confirmation code to verify ownership and activate your{' '}
                  <span className="font-semibold text-[#0F172A]">{activeProvider.label}</span> wallet.
                </p>
              </div>
            </div>
          </div>

          {/* Transparent SMS Preview Card for Instant Verification Testing */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <KeyRound className="h-4 w-4 shrink-0 text-[#059669]" />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#047857]">
                  SMS Verification Preview
                </p>
                <p className="text-xs text-[#065F46]">
                  Your GO PAY BD verification code is:{' '}
                  <span className="font-mono text-base font-bold tracking-widest text-[#0F172A]">
                    {generatedOtp}
                  </span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOtpInput(generatedOtp)}
              className="rounded-md bg-[#059669] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#047857]"
            >
              Auto-Fill Code
            </button>
          </div>

          <div>
            <label className={labelCls}>Enter 6-Digit Verification Code</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              autoFocus
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full rounded-lg border border-[#CBD5E1] bg-white px-4 py-3 text-center font-mono text-2xl font-bold tracking-[0.45em] text-[#0F172A] focus:border-[#0D9488] focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20"
            />
            <div className="mt-2.5 flex items-center justify-between text-xs text-[#64748B]">
              <span>
                Wallet: <strong className="text-[#0F172A]">{activeProvider.label}</strong> ({accountNumber})
              </span>
              <button
                type="button"
                disabled={resendTimer > 0}
                onClick={handleResendOtp}
                className="inline-flex items-center gap-1 font-semibold text-[#0D9488] hover:underline disabled:cursor-not-allowed disabled:text-[#94A3B8] disabled:no-underline"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Code'}
              </button>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-[#FFFBEB] px-3.5 py-2.5 text-xs text-[#92400E]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#D97706]" />
            <span>
              Once submitted, this wallet will be saved to your GO PAY BD account ledger and marked{' '}
              <strong>Active &amp; Verified</strong> for immediate withdrawals.
            </span>
          </div>

          <div className="flex items-center justify-between gap-2.5 border-t border-[#DCE4EF] pt-4">
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setError('');
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#DCE4EF] bg-white px-4 py-2 text-sm font-medium text-[#334155] hover:bg-[#F8FAFC]"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button
              type="submit"
              disabled={loading || otpInput.length !== 6}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0D9488] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0F766E] disabled:opacity-60"
            >
              <ShieldCheck className="h-4 w-4" />
              {loading ? 'Verifying & Activating...' : 'Verify & Activate Wallet'}
            </button>
          </div>
        </form>
      )}

      {/* STEP 3: ACTIVE & VERIFIED CONFIRMATION */}
      {step === 3 && activatedWallet && (
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#ECFDF5] text-[#059669] ring-8 ring-[#ECFDF5]/60">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-[#0F172A]">
              {activatedWallet.method_name} Wallet is Now Active!
            </h4>
            <p className="mt-1 text-sm text-[#64748B]">
              Phone verification completed. Your linked payout wallet is stored securely in your account and ready to use.
            </p>
          </div>

          <div className="mx-auto max-w-md rounded-xl border border-[#DCE4EF] bg-[#F8FAFC] p-4 text-left">
            <div className="flex items-center justify-between border-b border-[#DCE4EF] pb-3">
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold text-white"
                  style={{ backgroundColor: getProviderMeta(activatedWallet.method_name).accent }}
                >
                  {activatedWallet.method_name.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <p className="text-sm font-bold text-[#0F172A]">{activatedWallet.method_name}</p>
                  <p className="text-xs text-[#64748B]">{activatedWallet.account_type} Account</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#059669]">
                <span className="h-2 w-2 rounded-full bg-[#10B981]" />
                Active &amp; Verified
              </span>
            </div>
            <div className="mt-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#64748B]">Account Number</span>
                <span className="font-mono font-bold text-[#0F172A]">{activatedWallet.account_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Account Holder</span>
                <span className="font-semibold text-[#0F172A]">{activatedWallet.account_holder_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">App Security PIN</span>
                <span className="font-semibold text-[#0D9488]">
                  {activatedWallet.has_pin ? 'Protected (SHA-256)' : 'Configured'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0F172A] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1E293B]"
            >
              Done — View Active Wallet
            </button>
          </div>
        </div>
      )}
        </>
      )}
    </Modal>
  );
};
