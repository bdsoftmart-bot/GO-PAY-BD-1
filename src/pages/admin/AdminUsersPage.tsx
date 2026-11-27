import React, { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Search,
  ArrowLeft,
  Wallet,
  KeyRound,
  Edit2,
  Users,
  Plus,
  Minus,
  SlidersHorizontal,
  Percent,
  ArrowUpDown,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../../lib/api';
import { formatBDT, formatDateTime } from '../../lib/format';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  PageHeader,
  StatCard,
  StatusText,
  EmptyState,
  SkeletonRows,
  PaginationBar,
  Modal,
  btnPrimary,
  btnSecondary,
  btnDanger,
  inputCls,
  labelCls,
} from '../../components/ui/Primitives';

const QUICK_AMOUNTS = [500, 1000, 2000, 3000, 5000, 10000];

export const AdminUsersPage: React.FC = () => {
  const { toast } = useToast();
  const { lang } = useLanguage();
  const isBn = lang === 'bn';

  const [items, setItems] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', status: 'all', date_from: '', min_balance: '', page: 1 });

  // Quick Balance Modal directly from User List
  const [quickTarget, setQuickTarget] = useState<any | null>(null);
  const [quickForm, setQuickForm] = useState({
    direction: 'credit' as 'credit' | 'debit' | 'set',
    amount: '',
    as_commission: false,
    reason: '',
  });
  const [quickBusy, setQuickBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v && v !== 'all') params.set(k, String(v));
    });
    try {
      const res = await api.adminGet(`/api/admin/users?${params.toString()}`);
      setItems(res.data?.items || []);
      setPagination(res.data?.pagination || { page: 1, total_pages: 1, total: 0 });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const handleQuickAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTarget) return;
    setQuickBusy(true);
    try {
      const res = await api.adminPost(`/api/admin/users/${quickTarget.id}/balance-adjust`, {
        direction: quickForm.direction,
        amount: quickForm.amount,
        as_commission: quickForm.as_commission,
        reason: quickForm.reason.trim() || (quickForm.as_commission ? 'Admin commission adjustment' : 'Admin balance adjustment'),
        confirmed: true,
      });
      toast(res.message);
      setQuickTarget(null);
      setQuickForm({ direction: 'credit', amount: '', as_commission: false, reason: '' });
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setQuickBusy(false);
    }
  };

  const quickPreviewBalance = (() => {
    if (!quickTarget) return null;
    const cur = Number(quickTarget.wallet_balance || 0);
    const amt = Number(quickForm.amount || 0);
    if (isNaN(amt) || amt < 0) return null;
    if (quickForm.direction === 'set') return amt;
    if (quickForm.direction === 'debit') return Math.max(0, cur - amt);
    return cur + amt;
  })();

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Admin Panel / Users"
        title={isBn ? 'ইউজার ম্যানেজমেন্ট ও ব্যালেন্স কন্ট্রোল' : 'User Management & Balance Control'}
        subtitle={
          isBn
            ? 'যেকোনো ইউজার আইডি ইনসপেক্ট করুন এবং সরাসরি ব্যালেন্স ও কমিশন আপ-ডাউন এডিট করুন।'
            : 'Inspect any member ID, edit commissions, and adjust wallet balances up or down with full audit trails.'
        }
      />

      <div className="bg-white border border-[#DCE4EF] rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-2 relative">
          <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
            placeholder={isBn ? 'নাম, ইউজারনেম, ইমেইল, ফোন বা User ID...' : 'Name, username, email, phone, or User ID...'}
            className={`${inputCls} pl-9`}
          />
        </div>
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })} className={inputCls}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="pending">Pending</option>
        </select>
        <input
          type="number"
          placeholder="Min balance (BDT)"
          value={filters.min_balance}
          onChange={(e) => setFilters({ ...filters, min_balance: e.target.value, page: 1 })}
          className={inputCls}
        />
        <input
          type="date"
          value={filters.date_from}
          onChange={(e) => setFilters({ ...filters, date_from: e.target.value, page: 1 })}
          className={inputCls}
        />
      </div>

      {loading ? (
        <SkeletonRows rows={6} cols={7} />
      ) : items.length === 0 ? (
        <EmptyState icon={<Users className="w-5 h-5" />} title="No users found" description="Registered member accounts will appear here." />
      ) : (
        <div className="bg-white border border-[#DCE4EF] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F8FAFC] text-xs text-[#64748B] border-b border-[#DCE4EF]">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">User ID</th>
                  <th className="text-left font-semibold px-4 py-3">Member</th>
                  <th className="text-left font-semibold px-4 py-3">Contact</th>
                  <th className="text-left font-semibold px-4 py-3">Ref Code / Sponsor</th>
                  <th className="text-right font-semibold px-4 py-3">Wallet</th>
                  <th className="text-right font-semibold px-4 py-3">Commission</th>
                  <th className="text-left font-semibold px-4 py-3">Status</th>
                  <th className="text-right font-semibold px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE4EF]">
                {items.map((u) => (
                  <tr key={u.id} className="hover:bg-[#F8FAFC]">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-[#0F172A]">{u.uid}</td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-semibold text-[#0F172A]">{u.full_name}</div>
                      <div className="text-[11px] text-[#64748B]">@{u.username}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div>{u.email}</div>
                      <div className="font-mono text-[11px] text-[#64748B]">{u.phone}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-mono text-[#0D9488]">{u.referral_code}</div>
                      <div className="text-[11px] text-[#64748B]">{u.sponsor_username ? `Sponsor: @${u.sponsor_username}` : 'Direct'}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-bold tabular-nums text-[#0F172A]">
                      {formatBDT(u.wallet_balance)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold tabular-nums text-[#059669]">
                      {formatBDT(u.total_commission)}
                    </td>
                    <td className="px-4 py-3"><StatusText status={u.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setQuickTarget(u);
                            setQuickForm({ direction: 'credit', amount: '', as_commission: false, reason: '' });
                          }}
                          className="px-2.5 py-1 rounded-md text-xs font-semibold bg-[#F0FDFA] border border-[#99F6E4] text-[#0F766E] hover:bg-[#CCFBF1] cursor-pointer whitespace-nowrap"
                        >
                          {isBn ? '± ব্যালেন্স' : '± Balance'}
                        </button>
                        <Link
                          to={`/admin/users/${u.id}`}
                          className="px-2.5 py-1 rounded-md text-xs font-semibold bg-[#0F172A] text-white hover:bg-[#1E293B] whitespace-nowrap"
                        >
                          {isBn ? 'ইনসপেক্ট →' : 'Inspect →'}
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar
            page={pagination.page}
            totalPages={pagination.total_pages}
            total={pagination.total}
            onPageChange={(p) => setFilters({ ...filters, page: p })}
          />
        </div>
      )}

      {/* Quick Balance Up/Down Modal from User Table */}
      <Modal
        open={Boolean(quickTarget)}
        onClose={() => setQuickTarget(null)}
        title={quickTarget ? `${isBn ? 'ব্যালেন্স আপ-ডাউন' : 'Adjust Balance'}: ${quickTarget.full_name} (${quickTarget.uid})` : ''}
        subtitle={quickTarget ? `${isBn ? 'বর্তমান ব্যালেন্স' : 'Current Available Balance'}: ${formatBDT(quickTarget.wallet_balance)}` : ''}
      >
        <form onSubmit={handleQuickAdjust} className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['credit', isBn ? '+ বাড়ান (Add)' : '+ Add Balance'],
                ['debit', isBn ? '- কমান (Deduct)' : '- Deduct'],
                ['set', isBn ? '= সেট করুন (Set)' : '= Set Exact'],
              ] as const
            ).map(([dir, lbl]) => (
              <button
                key={dir}
                type="button"
                onClick={() => setQuickForm({ ...quickForm, direction: dir })}
                className={`py-2 px-2 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                  quickForm.direction === dir
                    ? dir === 'debit'
                      ? 'bg-[#DC2626] text-white border-[#DC2626]'
                      : 'bg-[#0F172A] text-white border-[#0F172A]'
                    : 'bg-white text-[#475569] border-[#DCE4EF] hover:bg-[#F8FAFC]'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>

          <div>
            <label className={labelCls}>
              {quickForm.direction === 'set'
                ? isBn
                  ? 'নতুন মোট ব্যালেন্স (BDT ৳)'
                  : 'New Exact Balance (BDT ৳)'
                : isBn
                ? 'টাকার পরিমাণ (BDT ৳)'
                : 'Amount (BDT ৳)'}
            </label>
            <input
              type="number"
              step="0.01"
              min={quickForm.direction === 'set' ? '0' : '0.01'}
              required
              autoFocus
              value={quickForm.amount}
              onChange={(e) => setQuickForm({ ...quickForm, amount: e.target.value })}
              placeholder="e.g. 2000 or 3000"
              className={`${inputCls} font-mono text-base`}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setQuickForm({ ...quickForm, amount: String(amt) })}
                  className="px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold bg-[#F1F5F9] text-[#0F172A] hover:bg-[#0D9488] hover:text-white transition-colors cursor-pointer"
                >
                  ৳{amt.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {quickTarget && quickForm.amount !== '' && quickPreviewBalance !== null && (
            <div className="p-3 rounded-lg bg-[#F0FDFA] border border-[#99F6E4] flex items-center justify-between text-xs">
              <span className="text-[#0F766E] font-medium">{isBn ? 'আপডেটের পর নতুন ব্যালেন্স:' : 'New Balance Preview:'}</span>
              <span className="font-mono font-bold text-[#0F172A]">
                {formatBDT(quickTarget.wallet_balance)} → {formatBDT(quickPreviewBalance)}
              </span>
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-[#0F172A] cursor-pointer">
            <input
              type="checkbox"
              checked={quickForm.as_commission}
              onChange={(e) => setQuickForm({ ...quickForm, as_commission: e.target.checked })}
              className="accent-[#0D9488]"
            />
            <span>{isBn ? 'কমিশন আয় হিসেবেও যুক্ত/সমন্বয় করুন' : 'Also count toward Total Commission & Earnings'}</span>
          </label>

          <div>
            <label className={labelCls}>{isBn ? 'কারণ / নোট (ঐচ্ছিক)' : 'Reason / Note (Optional)'}</label>
            <input
              value={quickForm.reason}
              onChange={(e) => setQuickForm({ ...quickForm, reason: e.target.value })}
              placeholder={isBn ? 'যেমন: কমিশন বোনাস বা ব্যালেন্স সমন্বয়' : 'e.g., Commission bonus or manual adjustment'}
              className={inputCls}
            />
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setQuickTarget(null)} className={btnSecondary}>
              {isBn ? 'বাতিল' : 'Cancel'}
            </button>
            <button type="submit" disabled={quickBusy} className={quickForm.direction === 'debit' ? btnDanger : btnPrimary}>
              {quickBusy ? (isBn ? 'সেভ হচ্ছে...' : 'Updating...') : isBn ? 'ব্যালেন্স আপডেট করুন' : 'Update Balance'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export const AdminUserDetailPage: React.FC = () => {
  const { id } = useParams();
  const { toast } = useToast();
  const { lang } = useLanguage();
  const isBn = lang === 'bn';

  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState('overview');

  // Modals
  const [editOpen, setEditOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [walletEditOpen, setWalletEditOpen] = useState(false);
  const [commGrantOpen, setCommGrantOpen] = useState(false);
  const [commEditTarget, setCommEditTarget] = useState<any | null>(null);
  const [pwOpen, setPwOpen] = useState(false);

  const [busy, setBusy] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: '', email: '', phone: '', status: 'active', admin_note: '' });
  const [adjustForm, setAdjustForm] = useState({
    direction: 'credit' as 'credit' | 'debit' | 'set',
    amount: '',
    as_commission: false,
    reason: '',
    admin_note: '',
  });
  const [walletDirectForm, setWalletDirectForm] = useState({
    available_balance: '',
    total_commission: '',
    pending_commission: '',
    total_earnings: '',
    total_deposits: '',
    total_withdrawals: '',
    pending_withdrawal: '',
    reason: '',
  });
  const [commGrantForm, setCommGrantForm] = useState({
    amount: '',
    referral_level: 1,
    status: 'credited' as 'credited' | 'pending',
    admin_note: '',
  });
  const [commEditForm, setCommEditForm] = useState({ commission_amount: '', admin_note: '' });
  const [newPassword, setNewPassword] = useState('');

  const load = useCallback(async () => {
    const res = await api.adminGet(`/api/admin/users/${id}`);
    setData(res.data);
    setEditForm({
      full_name: res.data.user.full_name,
      email: res.data.user.email,
      phone: res.data.user.phone,
      status: res.data.user.status,
      admin_note: res.data.user.admin_note || '',
    });
    const w = res.data.wallet || {};
    setWalletDirectForm({
      available_balance: String(w.available_balance ?? 0),
      total_commission: String(w.total_commission ?? 0),
      pending_commission: String(w.pending_commission ?? 0),
      total_earnings: String(w.total_earnings ?? 0),
      total_deposits: String(w.total_deposits ?? 0),
      total_withdrawals: String(w.total_withdrawals ?? 0),
      pending_withdrawal: String(w.pending_withdrawal ?? 0),
      reason: '',
    });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.adminPut(`/api/admin/users/${id}`, editForm);
      toast(isBn ? 'ইউজার প্রোফাইল আপডেট হয়েছে।' : 'User updated and audit log recorded.');
      setEditOpen(false);
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.adminPost(`/api/admin/users/${id}/balance-adjust`, {
        ...adjustForm,
        reason: adjustForm.reason.trim() || (adjustForm.as_commission ? 'Admin commission adjustment' : 'Admin balance adjustment'),
        confirmed: true,
      });
      toast(res.message);
      setAdjustOpen(false);
      setAdjustForm({ direction: 'credit', amount: '', as_commission: false, reason: '', admin_note: '' });
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleWalletDirectSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.adminPut(`/api/admin/users/${id}/wallet-direct`, walletDirectForm);
      toast(res.message);
      setWalletEditOpen(false);
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleGrantCommission = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.adminPost(`/api/admin/users/${id}/commission-adjust`, commGrantForm);
      toast(res.message);
      setCommGrantOpen(false);
      setCommGrantForm({ amount: '', referral_level: 1, status: 'credited', admin_note: '' });
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleEditCommission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commEditTarget) return;
    setBusy(true);
    try {
      const res = await api.adminPut(`/api/admin/commissions/${commEditTarget.id}`, commEditForm);
      toast(res.message);
      setCommEditTarget(null);
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleCommissionAction = async (commId: string, action: 'credit' | 'reverse' | 'cancel') => {
    try {
      const res = await api.adminPost(`/api/admin/commissions/${commId}/action`, { action, admin_note: `Admin ${action}` });
      toast(res.message);
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleResetPw = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.adminPost(`/api/admin/users/${id}/reset-password`, { new_password: newPassword });
      toast('Password reset and active user sessions revoked.');
      setPwOpen(false);
      setNewPassword('');
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  if (!data) return <div className="p-8 text-sm text-[#64748B]">Loading user profile...</div>;
  const { user, wallet, transactions, deposits, withdrawals, orders, referrals, commissions, activity_logs, audit_logs } = data;

  const currentAvail = Number(wallet?.available_balance || 0);
  const previewAvail = (() => {
    const amt = Number(adjustForm.amount || 0);
    if (adjustForm.amount === '' || isNaN(amt) || amt < 0) return null;
    if (adjustForm.direction === 'set') return amt;
    if (adjustForm.direction === 'debit') return Math.max(0, currentAvail - amt);
    return currentAvail + amt;
  })();

  const tabs = [
    'overview',
    'profile',
    'wallet',
    'commission',
    'transactions',
    'deposits',
    'withdrawals',
    'orders',
    'referrals',
    'activity',
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={`Admin Panel / Users / ${user.uid}`}
        title={`${user.full_name} (@${user.username})`}
        subtitle={`${user.email} · ${user.phone} · UID: ${user.uid} · Joined ${formatDateTime(user.created_at)}`}
        actions={
          <>
            <Link to="/admin/users" className={btnSecondary}>
              <ArrowLeft className="w-4 h-4" /> {isBn ? 'সব ইউজার' : 'All Users'}
            </Link>
            <button onClick={() => setEditOpen(true)} className={btnSecondary}>
              <Edit2 className="w-4 h-4" /> {isBn ? 'প্রোফাইল এডিট' : 'Edit Profile'}
            </button>
            <button onClick={() => setWalletEditOpen(true)} className={btnSecondary}>
              <SlidersHorizontal className="w-4 h-4" /> {isBn ? 'ওয়ালেট ও কমিশন এডিট' : 'Edit Wallet & Commissions'}
            </button>
            <button onClick={() => setCommGrantOpen(true)} className={btnSecondary}>
              <Percent className="w-4 h-4" /> {isBn ? '+ কমিশন যোগ করুন' : '+ Add Commission'}
            </button>
            <button onClick={() => setAdjustOpen(true)} className={btnPrimary}>
              <ArrowUpDown className="w-4 h-4" /> {isBn ? 'ব্যালেন্স আপ / ডাউন' : 'Balance Up / Down'}
            </button>
          </>
        }
      />

      {/* 10 Inspection Tabs */}
      <div className="flex items-center gap-1 p-1 bg-white border border-[#DCE4EF] rounded-xl overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap cursor-pointer ${
              tab === t ? 'bg-[#0F172A] text-[#F8FAFC]' : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard accent="primary" label="Available Balance" value={formatBDT(wallet?.available_balance)} subtext={`Reserved: ${formatBDT(wallet?.pending_withdrawal)}`} />
            <StatCard label="Total Commissions" value={formatBDT(wallet?.total_commission)} subtext={`Pending: ${formatBDT(wallet?.pending_commission)}`} />
            <StatCard label="Total Deposits" value={formatBDT(wallet?.total_deposits)} subtext={`${deposits.length} requests`} />
            <StatCard label="Total Withdrawals" value={formatBDT(wallet?.total_withdrawals)} subtext={`${withdrawals.length} requests`} />
          </div>

          {/* Inline Fast Balance Up/Down & Commission Control Panel */}
          <div className="bg-white border border-[#DCE4EF] rounded-2xl p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DCE4EF]">
              <div>
                <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-[#0D9488]" />
                  <span>{isBn ? 'দ্রুত ব্যালেন্স আপ-ডাউন ও কমিশন কন্ট্রোল' : 'Quick Balance Up / Down & Commission Control'}</span>
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  {isBn
                    ? `ইউজার ${user.uid}-এর ব্যালেন্স বাড়ান (+৳২,০০০ / +৳৩,০০০), কমান বা সরাসরি নতুন ব্যালেন্স সেট করুন।`
                    : `Increase (+৳2,000 / +৳3,000), deduct, or directly set exact balance for ${user.uid}.`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setCommGrantOpen(true)} className={btnSecondary}>
                  <Percent className="w-3.5 h-3.5" /> {isBn ? '+ কমিশন বোনাস' : '+ Grant Commission'}
                </button>
                <button type="button" onClick={() => setWalletEditOpen(true)} className={btnSecondary}>
                  <SlidersHorizontal className="w-3.5 h-3.5" /> {isBn ? 'সব সংখ্যা এডিট' : 'Edit All Counters'}
                </button>
              </div>
            </div>

            <form onSubmit={handleAdjust} className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
              <div className="lg:col-span-4">
                <label className={labelCls}>{isBn ? 'অপারেশন বেছে নিন' : 'Operation Mode'}</label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAdjustForm({ ...adjustForm, direction: 'credit' })}
                    className={`py-2 px-2 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1 cursor-pointer ${
                      adjustForm.direction === 'credit'
                        ? 'bg-[#059669] text-white border-[#059669]'
                        : 'bg-white text-[#334155] border-[#DCE4EF] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" /> {isBn ? 'বাড়ান' : 'Add'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustForm({ ...adjustForm, direction: 'debit' })}
                    className={`py-2 px-2 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1 cursor-pointer ${
                      adjustForm.direction === 'debit'
                        ? 'bg-[#DC2626] text-white border-[#DC2626]'
                        : 'bg-white text-[#334155] border-[#DCE4EF] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <Minus className="w-3.5 h-3.5" /> {isBn ? 'কমান' : 'Deduct'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustForm({ ...adjustForm, direction: 'set' })}
                    className={`py-2 px-2 rounded-lg text-xs font-semibold border cursor-pointer ${
                      adjustForm.direction === 'set'
                        ? 'bg-[#0F172A] text-white border-[#0F172A]'
                        : 'bg-white text-[#334155] border-[#DCE4EF] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    {isBn ? '= সেট' : '= Set'}
                  </button>
                </div>
              </div>

              <div className="lg:col-span-3">
                <label className={labelCls}>
                  {adjustForm.direction === 'set'
                    ? isBn
                      ? 'নতুন মোট ব্যালেন্স (৳)'
                      : 'Target Balance (৳)'
                    : isBn
                    ? 'পরিমাণ (BDT ৳)'
                    : 'Amount (BDT ৳)'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={adjustForm.direction === 'set' ? '0' : '0.01'}
                  required
                  value={adjustForm.amount}
                  onChange={(e) => setAdjustForm({ ...adjustForm, amount: e.target.value })}
                  placeholder="2000"
                  className={`${inputCls} font-mono`}
                />
              </div>

              <div className="lg:col-span-3">
                <label className={labelCls}>{isBn ? 'নোট / কারণ (ঐচ্ছিক)' : 'Reason / Note (Optional)'}</label>
                <input
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  placeholder={isBn ? 'যেমন: কমিশন / ব্যালেন্স আপডেট' : 'e.g., Commission / bonus update'}
                  className={inputCls}
                />
              </div>

              <div className="lg:col-span-2">
                <button
                  type="submit"
                  disabled={busy}
                  className={`${adjustForm.direction === 'debit' ? btnDanger : btnPrimary} w-full py-2.5`}
                >
                  {busy ? (isBn ? 'সেভ হচ্ছে...' : 'Saving...') : isBn ? 'আপডেট করুন' : 'Apply'}
                </button>
              </div>

              <div className="lg:col-span-12 flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-medium text-[#64748B] mr-1">
                    {isBn ? 'কুইক অ্যামাউন্ট:' : 'Quick presets:'}
                  </span>
                  {QUICK_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAdjustForm({ ...adjustForm, amount: String(amt) })}
                      className="px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold bg-[#F1F5F9] text-[#0F172A] hover:bg-[#0D9488] hover:text-white transition-colors cursor-pointer"
                    >
                      ৳{amt.toLocaleString()}
                    </button>
                  ))}
                </div>

                <label className="flex items-center gap-2 text-xs text-[#334155] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adjustForm.as_commission}
                    onChange={(e) => setAdjustForm({ ...adjustForm, as_commission: e.target.checked })}
                    className="accent-[#0D9488]"
                  />
                  <span>{isBn ? 'কমিশন আয় হিসেবেও গণনা করুন' : 'Also count as Commission Earning'}</span>
                </label>
              </div>

              {previewAvail !== null && (
                <div className="lg:col-span-12 p-3 rounded-xl bg-[#F0FDFA] border border-[#99F6E4] flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[#0F766E]">
                    <CheckCircle2 className="w-4 h-4 text-[#0D9488]" />
                    {isBn ? 'নতুন ব্যালেন্স প্রিভিউ:' : 'Live Balance Preview:'}
                  </span>
                  <span className="font-mono font-bold text-[#0F172A]">
                    {formatBDT(currentAvail)} → {formatBDT(previewAvail)}{' '}
                    <span className={previewAvail >= currentAvail ? 'text-[#059669]' : 'text-[#DC2626]'}>
                      ({previewAvail >= currentAvail ? '+' : '-'}
                      {formatBDT(Math.abs(previewAvail - currentAvail))})
                    </span>
                  </span>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {tab === 'profile' && (
        <div className="bg-white border border-[#DCE4EF] rounded-xl p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div><span className="text-xs text-[#64748B]">User ID</span><div className="font-mono font-semibold">{user.uid}</div></div>
          <div><span className="text-xs text-[#64748B]">Account Status</span><div className="mt-0.5"><StatusText status={user.status} /></div></div>
          <div><span className="text-xs text-[#64748B]">Referral Code</span><div className="font-mono font-semibold">{user.referral_code}</div></div>
          <div><span className="text-xs text-[#64748B]">Sponsor</span><div>{user.sponsor_username ? `@${user.sponsor_username} (${user.sponsor_uid})` : 'None'}</div></div>
          <div className="sm:col-span-2"><span className="text-xs text-[#64748B]">Admin Note</span><div className="text-xs mt-1">{user.admin_note || 'No admin notes recorded.'}</div></div>
          <div className="sm:col-span-2 pt-2 flex flex-wrap gap-2">
            <button onClick={() => setEditOpen(true)} className={btnSecondary}><Edit2 className="w-4 h-4" /> Edit Profile</button>
            <button onClick={() => setPwOpen(true)} className={btnSecondary}><KeyRound className="w-4 h-4" /> Reset Password</button>
          </div>
        </div>
      )}

      {tab === 'wallet' && (
        <div className="bg-white border border-[#DCE4EF] rounded-xl p-6 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#DCE4EF]">
              <span className="text-[#64748B]">Available Balance</span>
              <div className="font-mono text-lg font-bold text-[#0F172A] mt-1">{formatBDT(wallet?.available_balance)}</div>
            </div>
            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#DCE4EF]">
              <span className="text-[#64748B]">Total Commission</span>
              <div className="font-mono text-lg font-bold text-[#059669] mt-1">{formatBDT(wallet?.total_commission)}</div>
            </div>
            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#DCE4EF]">
              <span className="text-[#64748B]">Pending Commission</span>
              <div className="font-mono text-lg font-bold text-[#D97706] mt-1">{formatBDT(wallet?.pending_commission)}</div>
            </div>
            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#DCE4EF]">
              <span className="text-[#64748B]">Total Earnings</span>
              <div className="font-mono text-lg font-bold text-[#0D9488] mt-1">{formatBDT(wallet?.total_earnings)}</div>
            </div>
            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#DCE4EF]">
              <span className="text-[#64748B]">Total Deposits</span>
              <div className="font-mono text-lg font-bold mt-1">{formatBDT(wallet?.total_deposits)}</div>
            </div>
            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#DCE4EF]">
              <span className="text-[#64748B]">Total Withdrawals</span>
              <div className="font-mono text-lg font-bold mt-1">{formatBDT(wallet?.total_withdrawals)}</div>
            </div>
            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#DCE4EF]">
              <span className="text-[#64748B]">Pending Withdrawal</span>
              <div className="font-mono text-lg font-bold mt-1">{formatBDT(wallet?.pending_withdrawal)}</div>
            </div>
            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#DCE4EF]">
              <span className="text-[#64748B]">Total Spent</span>
              <div className="font-mono text-lg font-bold mt-1">{formatBDT(wallet?.total_spent)}</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button onClick={() => setAdjustOpen(true)} className={btnPrimary}>
              <ArrowUpDown className="w-4 h-4" /> {isBn ? 'ব্যালেন্স বাড়ান / কমান' : 'Add / Deduct / Set Balance'}
            </button>
            <button onClick={() => setWalletEditOpen(true)} className={btnSecondary}>
              <SlidersHorizontal className="w-4 h-4" /> {isBn ? 'সব ওয়ালেট ও কমিশন সংখ্যা এডিট করুন' : 'Edit All Wallet & Commission Counters'}
            </button>
          </div>
        </div>
      )}

      {tab === 'commission' && (
        <div className="space-y-4">
          <div className="bg-white border border-[#DCE4EF] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-[#0F172A]">
                {isBn ? 'কমিশন রেকর্ড ও ম্যানুয়াল কমিশন এডিট' : 'User Commission Records & Manual Adjustments'}
              </div>
              <div className="text-xs text-[#64748B]">
                Total Credited Commission: <span className="font-mono font-bold text-[#059669]">{formatBDT(wallet?.total_commission)}</span> · Pending:{' '}
                <span className="font-mono font-bold text-[#D97706]">{formatBDT(wallet?.pending_commission)}</span>
              </div>
            </div>
            <button onClick={() => setCommGrantOpen(true)} className={btnPrimary}>
              <Plus className="w-4 h-4" /> {isBn ? 'নতুন কমিশন যোগ করুন' : 'Add / Grant Commission'}
            </button>
          </div>

          <div className="bg-white border border-[#DCE4EF] rounded-xl overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#F8FAFC] border-b border-[#DCE4EF] text-[#64748B]">
                <tr>
                  <th className="text-left px-4 py-3">Commission ID</th>
                  <th className="text-left px-4 py-3">Order / Ref</th>
                  <th className="text-left px-4 py-3">Level</th>
                  <th className="text-right px-4 py-3">Amount</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE4EF]">
                {commissions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[#64748B]">
                      {isBn ? 'এখনো কোনো কমিশন রেকর্ড নেই। উপরের বাটন থেকে সরাসরি কমিশন যোগ করুন।' : 'No commission records yet. Use "Add / Grant Commission" above to credit one.'}
                    </td>
                  </tr>
                ) : (
                  commissions.map((c: any) => (
                    <tr key={c.id}>
                      <td className="px-4 py-3 font-mono">{c.commission_uid}</td>
                      <td className="px-4 py-3 font-mono">{c.order_number}</td>
                      <td className="px-4 py-3">Level {c.referral_level}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-[#059669]">{formatBDT(c.commission_amount)}</td>
                      <td className="px-4 py-3"><StatusText status={c.status} /></td>
                      <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setCommEditTarget(c);
                            setCommEditForm({
                              commission_amount: String(c.commission_amount ?? 0),
                              admin_note: c.admin_note || '',
                            });
                          }}
                          className="text-xs font-semibold text-[#0284C7] hover:underline cursor-pointer"
                        >
                          {isBn ? 'এডিট' : 'Edit Amount'}
                        </button>
                        {['pending', 'approved'].includes(c.status) && (
                          <button
                            type="button"
                            onClick={() => handleCommissionAction(c.id, 'credit')}
                            className="text-xs font-semibold text-[#059669] hover:underline cursor-pointer"
                          >
                            Credit
                          </button>
                        )}
                        {c.status === 'credited' && (
                          <button
                            type="button"
                            onClick={() => handleCommissionAction(c.id, 'reverse')}
                            className="text-xs font-semibold text-[#DC2626] hover:underline cursor-pointer"
                          >
                            Reverse
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'transactions' && (
        <div className="bg-white border border-[#DCE4EF] rounded-xl overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#F8FAFC] border-b border-[#DCE4EF] text-[#64748B]">
              <tr><th className="text-left px-4 py-3">TxID</th><th className="text-left px-4 py-3">Type</th><th className="text-right px-4 py-3">Amount</th><th className="text-right px-4 py-3">Prev → New</th><th className="text-left px-4 py-3">Description</th><th className="text-left px-4 py-3">Date</th></tr>
            </thead>
            <tbody className="divide-y divide-[#DCE4EF]">
              {transactions.map((t: any) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 font-mono">{t.tx_uid}</td>
                  <td className="px-4 py-3 capitalize">{String(t.tx_type).replace(/_/g, ' ')}</td>
                  <td className={`px-4 py-3 text-right font-mono font-semibold ${t.direction === 'credit' ? 'text-[#059669]' : 'text-[#DC2626]'}`}>{t.direction === 'credit' ? '+' : '-'}{formatBDT(t.amount)}</td>
                  <td className="px-4 py-3 text-right font-mono text-[#64748B]">{formatBDT(t.previous_balance)} → {formatBDT(t.new_balance)}</td>
                  <td className="px-4 py-3 text-[#64748B]">{t.description}</td>
                  <td className="px-4 py-3 text-[#64748B]">{formatDateTime(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'deposits' && (
        <div className="bg-white border border-[#DCE4EF] rounded-xl overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#F8FAFC] border-b border-[#DCE4EF] text-[#64748B]">
              <tr><th className="text-left px-4 py-3">Deposit ID</th><th className="text-left px-4 py-3">Method</th><th className="text-left px-4 py-3">Sender</th><th className="text-left px-4 py-3">TrxID</th><th className="text-right px-4 py-3">Amount</th><th className="text-left px-4 py-3">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-[#DCE4EF]">
              {deposits.map((d: any) => (
                <tr key={d.id}>
                  <td className="px-4 py-3 font-mono">{d.deposit_uid}</td>
                  <td className="px-4 py-3">{d.payment_method}</td>
                  <td className="px-4 py-3 font-mono">{d.sender_number}</td>
                  <td className="px-4 py-3 font-mono">{d.transaction_id}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">{formatBDT(d.amount)}</td>
                  <td className="px-4 py-3"><StatusText status={d.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'withdrawals' && (
        <div className="bg-white border border-[#DCE4EF] rounded-xl overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#F8FAFC] border-b border-[#DCE4EF] text-[#64748B]">
              <tr><th className="text-left px-4 py-3">Withdrawal ID</th><th className="text-left px-4 py-3">Method & Account</th><th className="text-right px-4 py-3">Requested</th><th className="text-right px-4 py-3">Net</th><th className="text-left px-4 py-3">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-[#DCE4EF]">
              {withdrawals.map((w: any) => (
                <tr key={w.id}>
                  <td className="px-4 py-3 font-mono">{w.withdrawal_uid}</td>
                  <td className="px-4 py-3">{w.payment_method} · {w.account_number}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatBDT(w.amount)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">{formatBDT(w.net_amount)}</td>
                  <td className="px-4 py-3"><StatusText status={w.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'orders' && (
        <div className="bg-white border border-[#DCE4EF] rounded-xl overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#F8FAFC] border-b border-[#DCE4EF] text-[#64748B]">
              <tr><th className="text-left px-4 py-3">Order #</th><th className="text-left px-4 py-3">Product</th><th className="text-right px-4 py-3">Total</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Date</th></tr>
            </thead>
            <tbody className="divide-y divide-[#DCE4EF]">
              {orders.map((o: any) => (
                <tr key={o.id}>
                  <td className="px-4 py-3 font-mono">{o.order_number}</td>
                  <td className="px-4 py-3">{o.product_name} (x{o.quantity})</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">{formatBDT(o.total)}</td>
                  <td className="px-4 py-3"><StatusText status={o.order_status} /></td>
                  <td className="px-4 py-3 text-[#64748B]">{formatDateTime(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'referrals' && (
        <div className="bg-white border border-[#DCE4EF] rounded-xl overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#F8FAFC] border-b border-[#DCE4EF] text-[#64748B]">
              <tr><th className="text-left px-4 py-3">Referred UID</th><th className="text-left px-4 py-3">Member</th><th className="text-left px-4 py-3">Level</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Date</th></tr>
            </thead>
            <tbody className="divide-y divide-[#DCE4EF]">
              {referrals.map((r: any) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-mono">{r.user_uid}</td>
                  <td className="px-4 py-3">{r.full_name} (@{r.username})</td>
                  <td className="px-4 py-3 font-semibold">Level {r.level}</td>
                  <td className="px-4 py-3"><StatusText status={r.user_status} /></td>
                  <td className="px-4 py-3 text-[#64748B]">{formatDateTime(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'activity' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-[#DCE4EF] rounded-xl p-5">
            <h3 className="text-xs font-bold text-[#0F172A] mb-3">Login History</h3>
            <div className="divide-y divide-[#DCE4EF] text-xs">
              {activity_logs.map((l: any) => (
                <div key={l.id} className="py-2 flex justify-between">
                  <span className="font-mono">{l.ip_address}</span>
                  <span className="text-[#64748B]">{formatDateTime(l.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white border border-[#DCE4EF] rounded-xl p-5">
            <h3 className="text-xs font-bold text-[#0F172A] mb-3">Admin Audit Trail</h3>
            <div className="divide-y divide-[#DCE4EF] text-xs">
              {audit_logs.map((a: any) => (
                <div key={a.id} className="py-2">
                  <div className="font-semibold">{a.action} · by {a.actor_name}</div>
                  <div className="text-[11px] text-[#64748B]">{formatDateTime(a.created_at)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit User Profile Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit User Account">
        <form onSubmit={handleEdit} className="space-y-4">
          <div><label className={labelCls}>Full Name</label><input required value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} className={inputCls} /></div>
          <div><label className={labelCls}>Email</label><input type="email" required value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className={inputCls} /></div>
          <div><label className={labelCls}>Phone</label><input required value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className={inputCls} /></div>
          <div>
            <label className={labelCls}>Account Status</label>
            <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className={inputCls}>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          <div><label className={labelCls}>Internal Admin Note</label><textarea rows={3} value={editForm.admin_note} onChange={(e) => setEditForm({ ...editForm, admin_note: e.target.value })} className={inputCls} /></div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" disabled={busy} className={btnPrimary}>Save & Log</button>
          </div>
        </form>
      </Modal>

      {/* Balance Up/Down Modal */}
      <Modal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        title={isBn ? 'ব্যালেন্স আপ-ডাউন এডিট করুন' : 'Wallet Balance Up / Down'}
        subtitle={`${isBn ? 'বর্তমান ব্যবহারযোগ্য ব্যালেন্স' : 'Current Available'}: ${formatBDT(wallet?.available_balance)}`}
      >
        <form onSubmit={handleAdjust} className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['credit', isBn ? '+ বাড়ান' : '+ Add Funds'],
                ['debit', isBn ? '- কমান' : '- Deduct'],
                ['set', isBn ? '= সেট করুন' : '= Set Exact'],
              ] as const
            ).map(([dir, lbl]) => (
              <button
                key={dir}
                type="button"
                onClick={() => setAdjustForm({ ...adjustForm, direction: dir })}
                className={`py-2 px-2 rounded-lg text-xs font-semibold border cursor-pointer ${
                  adjustForm.direction === dir
                    ? dir === 'debit'
                      ? 'bg-[#DC2626] text-white border-[#DC2626]'
                      : 'bg-[#0F172A] text-white border-[#0F172A]'
                    : 'bg-white text-[#475569] border-[#DCE4EF]'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>

          <div>
            <label className={labelCls}>
              {adjustForm.direction === 'set' ? 'New Exact Balance (BDT ৳)' : 'Amount (BDT ৳)'}
            </label>
            <input
              type="number"
              step="0.01"
              min={adjustForm.direction === 'set' ? '0' : '0.01'}
              required
              value={adjustForm.amount}
              onChange={(e) => setAdjustForm({ ...adjustForm, amount: e.target.value })}
              placeholder="e.g. 2000 or 3000"
              className={`${inputCls} font-mono text-base`}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAdjustForm({ ...adjustForm, amount: String(amt) })}
                  className="px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold bg-[#F1F5F9] text-[#0F172A] hover:bg-[#0D9488] hover:text-white cursor-pointer"
                >
                  ৳{amt.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {previewAvail !== null && (
            <div className="p-3 rounded-lg bg-[#F0FDFA] border border-[#99F6E4] flex items-center justify-between text-xs">
              <span className="text-[#0F766E] font-medium">{isBn ? 'নতুন ব্যালেন্স:' : 'New Balance:'}</span>
              <span className="font-mono font-bold text-[#0F172A]">
                {formatBDT(currentAvail)} → {formatBDT(previewAvail)}
              </span>
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-[#0F172A] cursor-pointer">
            <input
              type="checkbox"
              checked={adjustForm.as_commission}
              onChange={(e) => setAdjustForm({ ...adjustForm, as_commission: e.target.checked })}
              className="accent-[#0D9488]"
            />
            <span>{isBn ? 'কমিশন আয় হিসেবেও যুক্ত/সমন্বয় করুন' : 'Also count toward Total Commission & Earnings'}</span>
          </label>

          <div>
            <label className={labelCls}>{isBn ? 'কারণ / নোট (ঐচ্ছিক)' : 'Reason (Optional)'}</label>
            <input
              value={adjustForm.reason}
              onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
              placeholder="e.g., Commission bonus or balance correction"
              className={inputCls}
            />
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAdjustOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" disabled={busy} className={adjustForm.direction === 'debit' ? btnDanger : btnPrimary}>
              {busy ? 'Updating...' : isBn ? 'আপডেট করুন' : 'Execute Adjustment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Direct Full Wallet & Commission Counters Modal */}
      <Modal
        open={walletEditOpen}
        onClose={() => setWalletEditOpen(false)}
        title={isBn ? 'ওয়ালেট ও কমিশনের সব সংখ্যা এডিট করুন' : 'Edit All Wallet & Commission Figures'}
        subtitle={`${user.full_name} (${user.uid}) · ${isBn ? 'সরাসরি যেকোনো ব্যালেন্স আপ-ডাউন করুন' : 'Directly edit any balance or commission figure up or down'}`}
      >
        <form onSubmit={handleWalletDirectSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Available Balance (BDT ৳)</label>
              <input type="number" step="0.01" min="0" required value={walletDirectForm.available_balance} onChange={(e) => setWalletDirectForm({ ...walletDirectForm, available_balance: e.target.value })} className={`${inputCls} font-mono`} />
            </div>
            <div>
              <label className={labelCls}>Total Commission (BDT ৳)</label>
              <input type="number" step="0.01" min="0" required value={walletDirectForm.total_commission} onChange={(e) => setWalletDirectForm({ ...walletDirectForm, total_commission: e.target.value })} className={`${inputCls} font-mono`} />
            </div>
            <div>
              <label className={labelCls}>Pending Commission (BDT ৳)</label>
              <input type="number" step="0.01" min="0" required value={walletDirectForm.pending_commission} onChange={(e) => setWalletDirectForm({ ...walletDirectForm, pending_commission: e.target.value })} className={`${inputCls} font-mono`} />
            </div>
            <div>
              <label className={labelCls}>Total Earnings (BDT ৳)</label>
              <input type="number" step="0.01" min="0" required value={walletDirectForm.total_earnings} onChange={(e) => setWalletDirectForm({ ...walletDirectForm, total_earnings: e.target.value })} className={`${inputCls} font-mono`} />
            </div>
            <div>
              <label className={labelCls}>Total Deposits (BDT ৳)</label>
              <input type="number" step="0.01" min="0" required value={walletDirectForm.total_deposits} onChange={(e) => setWalletDirectForm({ ...walletDirectForm, total_deposits: e.target.value })} className={`${inputCls} font-mono`} />
            </div>
            <div>
              <label className={labelCls}>Total Withdrawals (BDT ৳)</label>
              <input type="number" step="0.01" min="0" required value={walletDirectForm.total_withdrawals} onChange={(e) => setWalletDirectForm({ ...walletDirectForm, total_withdrawals: e.target.value })} className={`${inputCls} font-mono`} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Audit Note (Optional)</label>
            <input value={walletDirectForm.reason} onChange={(e) => setWalletDirectForm({ ...walletDirectForm, reason: e.target.value })} placeholder="Reason for direct wallet update" className={inputCls} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setWalletEditOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" disabled={busy} className={btnPrimary}>
              {busy ? 'Saving...' : isBn ? 'সব পরিবর্তন সেভ করুন' : 'Save Wallet & Commissions'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Grant / Add Commission Modal */}
      <Modal
        open={commGrantOpen}
        onClose={() => setCommGrantOpen(false)}
        title={isBn ? 'ইউজারের জন্য কমিশন যোগ করুন' : 'Add / Grant Commission to User'}
        subtitle={`${user.full_name} (${user.uid})`}
      >
        <form onSubmit={handleGrantCommission} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Commission Level</label>
              <select value={commGrantForm.referral_level} onChange={(e) => setCommGrantForm({ ...commGrantForm, referral_level: Number(e.target.value) })} className={inputCls}>
                <option value={1}>Level 1 Commission</option>
                <option value={2}>Level 2 Commission</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select value={commGrantForm.status} onChange={(e) => setCommGrantForm({ ...commGrantForm, status: e.target.value as 'credited' | 'pending' })} className={inputCls}>
                <option value="credited">Credited (Add to Wallet Now)</option>
                <option value="pending">Pending Commission</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Commission Amount (BDT ৳)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={commGrantForm.amount}
              onChange={(e) => setCommGrantForm({ ...commGrantForm, amount: e.target.value })}
              placeholder="e.g. 2000 or 3000"
              className={`${inputCls} font-mono`}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setCommGrantForm({ ...commGrantForm, amount: String(amt) })}
                  className="px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold bg-[#F1F5F9] text-[#0F172A] hover:bg-[#0D9488] hover:text-white cursor-pointer"
                >
                  ৳{amt.toLocaleString()}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Note (Optional)</label>
            <input value={commGrantForm.admin_note} onChange={(e) => setCommGrantForm({ ...commGrantForm, admin_note: e.target.value })} placeholder="e.g., Special partner commission" className={inputCls} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCommGrantOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" disabled={busy} className={btnPrimary}>
              {busy ? 'Adding...' : isBn ? 'কমিশন যোগ করুন' : 'Add Commission'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Existing Commission Amount Modal */}
      <Modal
        open={Boolean(commEditTarget)}
        onClose={() => setCommEditTarget(null)}
        title={commEditTarget ? `Edit Commission ${commEditTarget.commission_uid}` : ''}
        subtitle={
          commEditTarget?.status === 'credited'
            ? 'Credited commission: changing the amount will automatically update the user wallet balance by the difference.'
            : 'Adjust pending/approved commission amount.'
        }
      >
        <form onSubmit={handleEditCommission} className="space-y-4">
          <div>
            <label className={labelCls}>New Commission Amount (BDT ৳)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={commEditForm.commission_amount}
              onChange={(e) => setCommEditForm({ ...commEditForm, commission_amount: e.target.value })}
              className={`${inputCls} font-mono`}
            />
          </div>
          <div>
            <label className={labelCls}>Admin Note</label>
            <input
              value={commEditForm.admin_note}
              onChange={(e) => setCommEditForm({ ...commEditForm, admin_note: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCommEditTarget(null)} className={btnSecondary}>Cancel</button>
            <button type="submit" disabled={busy} className={btnPrimary}>{busy ? 'Saving...' : 'Update Commission'}</button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal open={pwOpen} onClose={() => setPwOpen(false)} title="Reset User Password">
        <form onSubmit={handleResetPw} className="space-y-4">
          <div>
            <label className={labelCls}>New Strong Password</label>
            <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 8 chars, letters & numbers" className={inputCls} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setPwOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" className={btnPrimary}>Reset Password</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
