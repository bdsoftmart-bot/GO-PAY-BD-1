import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import { BrandLogo } from '../../components/BrandLogo';
import { btnPrimary, inputCls, labelCls } from '../../components/ui/Primitives';

export const AdminLoginPage: React.FC = () => {
  const {
    admin,
    adminVaultUnlocked,
    adminSetupRequired,
    signInAdminWithPasscode,
    setupInitialAdminPassword,
  } = useAuth();
  const { lang } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const isBn = lang === 'bn';

  const [passcode, setPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (admin && adminVaultUnlocked && location.pathname === '/admin/login') {
      navigate('/admin', { replace: true });
    }
  }, [admin, adminVaultUnlocked, location.pathname, navigate]);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const t = window.setTimeout(() => setLockoutSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [lockoutSeconds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0) return;
    setError('');
    setLoading(true);
    try {
      let adm;
      if (adminSetupRequired) {
        if (passcode.trim().length < 8) {
          throw new Error(
            isBn
              ? 'অ্যাডমিন পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।'
              : 'Initial Admin Password must be at least 8 characters long.'
          );
        }
        if (passcode !== confirmPasscode) {
          throw new Error(isBn ? 'পাসওয়ার্ড এবং কনফার্ম পাসওয়ার্ড মেলেনি।' : 'Passwords do not match.');
        }
        adm = await setupInitialAdminPassword(passcode);
      } else {
        adm = await signInAdminWithPasscode(passcode);
      }

      setFailedAttempts(0);
      toast(
        isBn
          ? `স্বাগতম, ${adm.full_name}। অ্যাডমিন প্যানেল আনলক হয়েছে।`
          : `Welcome back, ${adm.full_name}. Admin Control Center unlocked.`
      );
      if (location.pathname === '/admin/login') {
        navigate('/admin', { replace: true });
      }
    } catch (err: any) {
      if (err?.status === 401) {
        const nextAttempts = failedAttempts + 1;
        setFailedAttempts(nextAttempts);
        if (nextAttempts >= 3) {
          setLockoutSeconds(30);
          setFailedAttempts(0);
          setError(
            isBn
              ? '৩ বার ভুল পাসওয়ার্ড দেওয়া হয়েছে। নিরাপত্তার জন্য ৩০ সেকেন্ড অপেক্ষা করুন।'
              : '3 failed Admin Password attempts. Security cooldown active for 30 seconds.'
          );
        } else {
          setError(
            isBn
              ? `ভুল অ্যাডমিন পাসওয়ার্ড। (আরও ${3 - nextAttempts} বার চেষ্টা বাকি)`
              : `Invalid Admin Password. (${3 - nextAttempts} attempt(s) left before cooldown)`
          );
        }
      } else {
        setError(
          err?.message ||
            (isBn ? 'অ্যাডমিন প্যানেলে প্রবেশ করা যায়নি।' : 'Unable to unlock Admin Panel.')
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F172A] via-[#132238] to-[#0F4C5C] flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <Link to="/">
            <BrandLogo variant="horizontal" light />
          </Link>
        </div>

        <div className="bg-white border border-[#DCE4EF] rounded-2xl p-7 sm:p-8 shadow-2xl">
          <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#0D9488] mb-2">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>{isBn ? 'সুরক্ষিত প্রবেশ' : 'Restricted Access'}</span>
            </span>
            {admin && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#059669]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {admin.role_name}
              </span>
            )}
          </div>

          <h1 className="text-2xl font-bold text-[#0F172A]">
            {adminSetupRequired
              ? isBn
                ? 'অ্যাডমিন পাসওয়ার্ড সেটআপ করুন'
                : 'Initialize Admin Control Center'
              : isBn
              ? 'GO PAY BD অ্যাডমিন লগইন'
              : 'GO PAY BD Control Center'}
          </h1>
          <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">
            {adminSetupRequired
              ? isBn
                ? 'প্রথমবার অ্যাডমিন প্যানেল চালু করতে একটি শক্তিশালী পাসওয়ার্ড সেট করুন। পরবর্তীতে স্টাফরা এই পাসওয়ার্ড দিয়ে প্রবেশ করতে পারবেন।'
                : 'Set your permanent administrator password to initialize the Control Center for the first time.'
              : isBn
              ? 'শুধুমাত্র নির্ধারিত অ্যাডমিন পাসওয়ার্ড দিয়ে কন্ট্রোল সেন্টারে প্রবেশ করুন।'
              : 'Enter your administrator password to unlock the control center directly.'}
          </p>

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs font-medium text-[#DC2626] flex items-start gap-2 leading-relaxed">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className={labelCls}>
                {adminSetupRequired
                  ? isBn
                    ? 'নতুন অ্যাডমিন পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)'
                    : 'New Admin Password (min 8 chars)'
                  : isBn
                  ? 'অ্যাডমিন পাসওয়ার্ড'
                  : 'Admin Password'}
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  autoFocus
                  autoComplete={adminSetupRequired ? 'new-password' : 'current-password'}
                  disabled={lockoutSeconds > 0}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder={isBn ? 'অ্যাডমিন পাসওয়ার্ড লিখুন' : 'Enter Admin Password'}
                  className={`${inputCls} pl-9 pr-10 font-mono`}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0F172A] cursor-pointer"
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {adminSetupRequired && (
              <div>
                <label className={labelCls}>
                  {isBn ? 'পাসওয়ার্ড পুনরায় লিখুন' : 'Confirm Admin Password'}
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={confirmPasscode}
                    onChange={(e) => setConfirmPasscode(e.target.value)}
                    placeholder={isBn ? 'পাসওয়ার্ড নিশ্চিত করুন' : 'Re-enter Admin Password'}
                    className={`${inputCls} pl-9 font-mono`}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || lockoutSeconds > 0}
              className={`${btnPrimary} w-full py-3`}
            >
              <Lock className="w-4 h-4" />
              <span>
                {lockoutSeconds > 0
                  ? isBn
                    ? `নিরাপত্তা বিরতি (${lockoutSeconds}s)`
                    : `Security Cooldown (${lockoutSeconds}s)`
                  : loading
                  ? isBn
                    ? 'যাচাই করা হচ্ছে...'
                    : 'Verifying...'
                  : adminSetupRequired
                  ? isBn
                    ? 'পাসওয়ার্ড সেট করুন ও প্রবেশ করুন'
                    : 'Set Password & Unlock'
                  : isBn
                  ? 'প্রবেশ করুন'
                  : 'Unlock Control Center'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-[#DCE4EF] text-center">
            <Link to="/" className="text-xs text-[#64748B] hover:text-[#0F172A] font-medium">
              ← {isBn ? 'মূল ওয়েবসাইটে ফিরে যান' : 'Return to Public Website'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
