import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Eye,
  EyeOff,
  Mail,
  Phone,
  Lock,
  User,
  Gift,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import { btnPrimary, btnSecondary, inputCls, labelCls } from '../../components/ui/Primitives';

export const LoginPage: React.FC = () => {
  const { user, signInWithEmail, signInWithGoogle, googleOAuthEnabled } = useAuth();
  const { lang } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isBn = lang === 'bn';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmail(email, password);
      toast(isBn ? 'আপনার GO PAY BD অ্যাকাউন্টে সাইন ইন সম্পন্ন হয়েছে।' : 'Signed in to your GO PAY BD wallet.');
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.message || (isBn ? 'সাইন ইন করা যায়নি। আবার চেষ্টা করুন।' : 'Sign in failed.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      toast(isBn ? 'Google অ্যাকাউন্ট দিয়ে সাইন ইন সম্পন্ন হয়েছে।' : 'Signed in with Google.');
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Google Sign-In failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-14">
      <div className="bg-white border border-[#DCE4EF] rounded-2xl p-7 sm:p-8 shadow-sm">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0D9488] mb-2">
          <ShieldCheck className="w-4 h-4" />
          <span>{isBn ? 'নিরাপদ মেম্বার লগইন' : 'Secure Member Sign In'}</span>
        </div>
        <h1 className="text-2xl font-bold text-[#0F172A]">
          {isBn ? 'GO PAY BD-তে সাইন ইন করুন' : 'Sign in to GO PAY BD'}
        </h1>
        <p className="text-sm text-[#475569] mt-1">
          {isBn
            ? 'আপনার ইমেইল ও পাসওয়ার্ড দিয়ে ওয়ালেট, কমিশন এবং লেনদেনে প্রবেশ করুন।'
            : 'Use your email and password to access your BDT wallet, linked accounts, and commissions.'}
        </p>

        {error && (
          <div className="mt-4 p-3.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs font-medium text-[#DC2626] leading-relaxed">
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleEmailLogin} className="mt-6 space-y-4">
          <div>
            <label className={labelCls}>{isBn ? 'ইমেইল বা ইউজারনেম' : 'Email or Username'}</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@gmail.com"
                className={`${inputCls} pl-9`}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[#334155]">
                {isBn ? 'পাসওয়ার্ড' : 'Password'}
              </label>
              <Link to="/forgot-password" className="text-xs font-semibold text-[#0D9488] hover:underline">
                {isBn ? 'পাসওয়ার্ড ভুলে গেছেন?' : 'Forgot password?'}
              </Link>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPass ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`${inputCls} pl-9 pr-10`}
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

          <button type="submit" disabled={loading} className={`${btnPrimary} w-full py-3`}>
            <span>{loading ? (isBn ? 'সাইন ইন হচ্ছে...' : 'Signing in...') : isBn ? 'সাইন ইন করুন' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {googleOAuthEnabled && (
          <div className="mt-4">
            <div className="relative my-4 flex items-center justify-center">
              <div className="border-t border-[#DCE4EF] w-full" />
              <span className="bg-white px-2.5 text-[11px] font-medium text-[#64748B] uppercase">or</span>
              <div className="border-t border-[#DCE4EF] w-full" />
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={handleGoogleLogin}
              className={`${btnSecondary} w-full py-2.5`}
            >
              <span>{isBn ? 'Google দিয়ে সাইন ইন করুন' : 'Continue with Google'}</span>
            </button>
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-[#DCE4EF] flex items-center justify-between text-xs text-[#64748B]">
          <span>{isBn ? 'নতুন ব্যবহারকারী?' : 'New to GO PAY BD?'}</span>
          <Link to="/register" className="font-semibold text-[#0D9488] hover:underline">
            {isBn ? 'অ্যাকাউন্ট তৈরি করুন' : 'Create Free Account'}
          </Link>
        </div>
      </div>
    </div>
  );
};

export const RegisterPage: React.FC = () => {
  const { user, signUpWithEmail, signInWithGoogle, googleOAuthEnabled } = useAuth();
  const { lang } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isBn = lang === 'bn';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [referralCode, setReferralCode] = useState((searchParams.get('ref') || '').toUpperCase());
  const [acceptTerms, setAcceptTerms] = useState(true);
  const [sponsorInfo, setSponsorInfo] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      api
        .publicPost('/api/public/referral-click', { code: ref })
        .then((res) => {
          if (res.data?.sponsor_name) {
            setSponsorInfo(`Referred by ${res.data.sponsor_name} (@${res.data.sponsor_username})`);
          }
        })
        .catch(() => {});
    }
  }, [searchParams]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.replace(/[\s-]/g, '');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError(isBn ? 'সঠিক ইমেইল অ্যাড্রেস লিখুন।' : 'Please enter a valid email address.');
      return;
    }
    if (!/^(\+?88)?01[3-9]\d{8}$/.test(cleanPhone)) {
      setError(
        isBn
          ? 'সঠিক ১১ ডিজিটের বাংলাদেশি মোবাইল নাম্বার দিন (যেমন: 017XXXXXXXX)।'
          : 'Please enter a valid 11-digit Bangladesh mobile number (e.g., 017XXXXXXXX).'
      );
      return;
    }
    if (password.length < 8) {
      setError(
        isBn ? 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।' : 'Password must be at least 8 characters long.'
      );
      return;
    }
    if (password !== confirmPassword) {
      setError(isBn ? 'পাসওয়ার্ড এবং কনফার্ম পাসওয়ার্ড মেলেনি।' : 'Password and Confirm Password do not match.');
      return;
    }
    if (!acceptTerms) {
      setError(
        isBn
          ? 'এগিয়ে যেতে শর্তাবলি ও গোপনীয়তা নীতি গ্রহণ করুন।'
          : 'Please accept the Terms & Conditions and Privacy Policy to continue.'
      );
      return;
    }

    setLoading(true);
    try {
      await signUpWithEmail({
        fullName: fullName.trim(),
        email: cleanEmail,
        phone: cleanPhone,
        password,
        referralCode: referralCode.trim().toUpperCase() || undefined,
      });
      toast(
        isBn
          ? 'অ্যাকাউন্ট তৈরি সম্পন্ন! আপনার BDT ওয়ালেট ও রেফারেল কোড অ্যাক্টিভ হয়েছে।'
          : 'Account created! Your BDT wallet and referral code are now active.'
      );
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.message || (isBn ? 'অ্যাকাউন্ট তৈরি করা যায়নি।' : 'Account creation failed.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <div className="bg-white border border-[#DCE4EF] rounded-2xl p-7 sm:p-8 shadow-sm">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0D9488] mb-2">
          <ShieldCheck className="w-4 h-4" />
          <span>{isBn ? 'সহজ ও দ্রুত অ্যাকাউন্ট রেজিস্ট্রেশন' : 'Simple & Fast Account Setup'}</span>
        </div>

        <h1 className="text-2xl font-bold text-[#0F172A]">
          {isBn ? 'GO PAY BD অ্যাকাউন্ট তৈরি করুন' : 'Create your GO PAY BD account'}
        </h1>
        <p className="text-sm text-[#475569] mt-1">
          {isBn
            ? 'আপনার ইমেইল (Gmail), মোবাইল নাম্বার এবং পাসওয়ার্ড দিয়ে সরাসরি অ্যাকাউন্ট খুলুন।'
            : 'Register directly with your email, mobile number, and password to activate your BDT wallet.'}
        </p>

        {sponsorInfo && (
          <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-[#ECFDF5] border border-[#A7F3D0] text-xs font-medium text-[#047857]">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{sponsorInfo}</span>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs font-medium text-[#DC2626] leading-relaxed">
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleRegister} className="mt-6 space-y-4">
          <div>
            <label className={labelCls}>{isBn ? 'ইমেইল অ্যাড্রেস (Gmail)' : 'Email Address (Gmail)'}</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@gmail.com"
                className={`${inputCls} pl-9`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{isBn ? 'মোবাইল নাম্বার' : 'Mobile Number'}</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="017XXXXXXXX"
                  className={`${inputCls} pl-9 font-mono`}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>{isBn ? 'আপনার নাম (ঐচ্ছিক)' : 'Full Name (Optional)'}</label>
              <div className="relative">
                <User className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={isBn ? 'আপনার নাম' : 'e.g., Rahim Ahmed'}
                  className={`${inputCls} pl-9`}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{isBn ? 'পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)' : 'Password (min 8 chars)'}</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`${inputCls} pl-9 pr-9`}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0F172A] cursor-pointer"
                  aria-label="Toggle password"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className={labelCls}>{isBn ? 'কনফার্ম পাসওয়ার্ড' : 'Confirm Password'}</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`${inputCls} pl-9`}
                />
              </div>
            </div>
          </div>

          <div>
            <label className={labelCls}>
              {isBn ? 'রেফারেল কোড (ঐচ্ছিক / Optional)' : 'Sponsor Referral Code (Optional)'}
            </label>
            <div className="relative">
              <Gift className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                placeholder="e.g., GP8F3K9A"
                className={`${inputCls} pl-9 font-mono uppercase`}
              />
            </div>
          </div>

          <label className="flex items-start gap-2.5 text-xs text-[#475569] cursor-pointer">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-0.5 rounded border-[#CBD5E1] accent-[#0D9488]"
            />
            <span>
              {isBn ? (
                <>
                  আমি{' '}
                  <Link to="/terms" className="text-[#0D9488] font-semibold hover:underline">
                    শর্তাবলি
                  </Link>{' '}
                  এবং{' '}
                  <Link to="/privacy" className="text-[#0D9488] font-semibold hover:underline">
                    গোপনীয়তা নীতি
                  </Link>{' '}
                  মেনে নিচ্ছি। আমি জানি GO PAY BD কখনোই আসল bKash বা Nagad পিন সংগ্রহ করে না।
                </>
              ) : (
                <>
                  I accept the{' '}
                  <Link to="/terms" className="text-[#0D9488] font-semibold hover:underline">
                    Terms &amp; Conditions
                  </Link>{' '}
                  and{' '}
                  <Link to="/privacy" className="text-[#0D9488] font-semibold hover:underline">
                    Privacy Policy
                  </Link>
                  . I understand GO PAY BD never collects third-party mobile banking PINs.
                </>
              )}
            </span>
          </label>

          <button type="submit" disabled={loading} className={`${btnPrimary} w-full py-3`}>
            <span>
              {loading
                ? isBn
                  ? 'অ্যাকাউন্ট তৈরি হচ্ছে...'
                  : 'Creating Account...'
                : isBn
                ? 'অ্যাকাউন্ট তৈরি করুন'
                : 'Create Account'}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {googleOAuthEnabled && (
          <div className="mt-4">
            <button
              type="button"
              disabled={loading}
              onClick={async () => {
                setError('');
                setLoading(true);
                try {
                  await signInWithGoogle(referralCode.trim().toUpperCase() || undefined);
                  navigate('/dashboard');
                } catch (err: any) {
                  setError(err?.message || 'Google Sign-Up failed.');
                } finally {
                  setLoading(false);
                }
              }}
              className={`${btnSecondary} w-full py-2.5`}
            >
              <span>{isBn ? 'Google দিয়ে অ্যাকাউন্ট খুলুন' : 'Sign up with Google'}</span>
            </button>
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-[#DCE4EF] flex items-center justify-between text-xs text-[#64748B]">
          <span>{isBn ? 'ইতিমধ্যে অ্যাকাউন্ট আছে?' : 'Already registered?'}</span>
          <Link to="/login" className="font-semibold text-[#0D9488] hover:underline">
            {isBn ? 'সাইন ইন করুন' : 'Sign in instead'}
          </Link>
        </div>
      </div>
    </div>
  );
};

export const ForgotPasswordPage: React.FC = () => {
  const { sendResetEmail } = useAuth();
  const { lang } = useLanguage();
  const isBn = lang === 'bn';
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await sendResetEmail(email);
      setSent(true);
    } catch (err: any) {
      setError(err?.message || 'Unable to submit password reset request.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="bg-white border border-[#DCE4EF] rounded-2xl p-7 shadow-sm">
        <h1 className="text-2xl font-bold text-[#0F172A]">
          {isBn ? 'পাসওয়ার্ড রিসেট করুন' : 'Reset Your Password'}
        </h1>
        <p className="text-sm text-[#475569] mt-2 leading-relaxed">
          {isBn
            ? 'আপনার রেজিস্টার্ড ইমেইল অ্যাড্রেস লিখুন। আমরা আপনার পাসওয়ার্ড রিসেট নির্দেশনা পাঠাব।'
            : 'Enter your registered email address and we will issue password reset instructions.'}
        </p>

        {sent ? (
          <div className="mt-5 p-4 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-xs text-[#065F46] space-y-2">
            <div className="font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#059669]" />
              <span>{isBn ? 'রিসেট অনুরোধ গৃহীত হয়েছে!' : 'Password Reset Requested!'}</span>
            </div>
            <p>
              {isBn
                ? `${email} এর জন্য রিসেট অনুরোধ তৈরি করা হয়েছে। আপনার ইনবক্স চেক করুন অথবা রিসেট টোকেন থাকলে নিচের লিংকে গিয়ে নতুন পাসওয়ার্ড সেট করুন।`
                : `If ${email} is registered, a reset token has been generated. Check your inbox or use your reset link/token to set a new password.`}
            </p>
            <div className="pt-1">
              <Link to="/reset-password" className="font-semibold text-[#0D9488] hover:underline">
                {isBn ? 'রিসেট টোকেন দিয়ে নতুন পাসওয়ার্ড দিন →' : 'Already have a reset token? Set new password →'}
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs font-medium text-[#DC2626]">
                {error}
              </div>
            )}
            <div>
              <label className={labelCls}>{isBn ? 'ইমেইল অ্যাড্রেস' : 'Email Address'}</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@gmail.com"
                className={inputCls}
              />
            </div>
            <button type="submit" disabled={busy} className={`${btnPrimary} w-full py-2.5`}>
              {busy ? (isBn ? 'পাঠানো হচ্ছে...' : 'Submitting...') : isBn ? 'রিসেট লিংক পাঠান' : 'Request Password Reset'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link to="/login" className="text-xs font-semibold text-[#0D9488] hover:underline">
            ← {isBn ? 'সাইন ইন পেজে ফিরে যান' : 'Return to Sign In'}
          </Link>
        </div>
      </div>
    </div>
  );
};

export const ResetPasswordPage: React.FC = () => {
  const { resetPasswordWithToken } = useAuth();
  const { lang } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isBn = lang === 'bn';

  const [token, setToken] = useState(searchParams.get('token') || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError(isBn ? 'নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।' : 'New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(isBn ? 'পাসওয়ার্ড মেলেনি।' : 'Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await resetPasswordWithToken(token, newPassword, confirmPassword);
      toast(isBn ? 'পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে। এখন সাইন ইন করুন।' : 'Password updated! Please sign in.');
      navigate('/login');
    } catch (err: any) {
      setError(err?.message || 'Unable to reset password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="bg-white border border-[#DCE4EF] rounded-2xl p-7 shadow-sm">
        <h1 className="text-2xl font-bold text-[#0F172A]">
          {isBn ? 'নতুন পাসওয়ার্ড সেট করুন' : 'Set a New Password'}
        </h1>
        <p className="text-sm text-[#475569] mt-2 leading-relaxed">
          {isBn
            ? 'আপনার রিসেট টোকেন এবং নতুন পাসওয়ার্ড লিখুন।'
            : 'Enter your password reset token and choose a new password (min 8 characters).'}
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs font-medium text-[#DC2626]">
              {error}
            </div>
          )}
          <div>
            <label className={labelCls}>{isBn ? 'রিসেট টোকেন' : 'Reset Token'}</label>
            <input
              type="text"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste reset token"
              className={`${inputCls} font-mono`}
            />
          </div>
          <div>
            <label className={labelCls}>{isBn ? 'নতুন পাসওয়ার্ড' : 'New Password'}</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>{isBn ? 'কনফার্ম পাসওয়ার্ড' : 'Confirm New Password'}</label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className={inputCls}
            />
          </div>
          <button type="submit" disabled={busy} className={`${btnPrimary} w-full py-2.5`}>
            {busy ? (isBn ? 'আপডেট হচ্ছে...' : 'Updating...') : isBn ? 'পাসওয়ার্ড আপডেট করুন' : 'Update Password'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/forgot-password" className="text-xs font-semibold text-[#0D9488] hover:underline">
            {isBn ? 'নতুন রিসেট টোকেন অনুরোধ করুন' : 'Need a new reset token?'}
          </Link>
        </div>
      </div>
    </div>
  );
};
