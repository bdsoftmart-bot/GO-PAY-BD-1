import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock,
  Download,
  Filter,
  Plus,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  TrendingUp,
  Wallet,
  Building2,
  Edit3,
  Lock,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  AlertBanner,
  Badge,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
  formatBDT,
  formatDateTime,
  inputCls,
} from '../../components/ui/Primitives';
import { LinkWalletModal, getProviderMeta } from '../../components/LinkWalletModal';

export const WalletPage: React.FC = () => {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<any>(null);
  const [recentTx, setRecentTx] = useState<any[]>([]);
  const [linkedWallets, setLinkedWallets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState<any>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadWalletData = async () => {
    setLoading(true);
    try {
      const [wRes, tRes, pmRes] = await Promise.all([
        api.userGet('/api/wallet'),
        api.userGet('/api/wallet/transactions?limit=12'),
        api.userGet('/api/payment-methods'),
      ]);
      setWallet(wRes.data);
      setRecentTx(tRes.data?.items || []);
      setLinkedWallets(pmRes.data || []);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Unable to load wallet data.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWalletData();
  }, []);

  const handleSetDefault = async (id: string) => {
    try {
      await api.userPost(`/api/payment-methods/${id}/default`);
      setStatusMsg({ type: 'success', text: 'Default payout wallet updated.' });
      loadWalletData();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Unable to update default wallet.' });
    }
  };

  const handleRemoveWallet = async (id: string) => {
    try {
      await api.userDelete(`/api/payment-methods/${id}`);
      setStatusMsg({ type: 'success', text: 'Linked wallet removed.' });
      loadWalletData();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Unable to remove wallet.' });
    }
  };

  return (
    <div>
      <PageHeader
        title="My Wallet"
        subtitle="Manage your BDT ledger balance, link verified mobile/bank wallets, and inspect recent transactions."
        actions={
          <>
            <button
              type="button"
              onClick={() => {
                setEditingWallet(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#0D9488] bg-[#F0FDFA] px-4 py-2 text-sm font-semibold text-[#0F766E] hover:bg-[#CCFBF1]"
            >
              <Plus className="h-4 w-4" /> Add / Link Wallet
            </button>
            <Link
              to="/dashboard/deposit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D9488] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0F766E]"
            >
              <ArrowDownToLine className="h-4 w-4" /> Deposit
            </Link>
            <Link
              to="/dashboard/withdraw"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#DCE4EF] bg-white px-4 py-2 text-sm font-semibold text-[#0F172A] hover:bg-[#F8FAFC]"
            >
              <ArrowUpFromLine className="h-4 w-4" /> Withdraw
            </Link>
          </>
        }
      />

      {statusMsg && (
        <div className="mb-5">
          <AlertBanner type={statusMsg.type} message={statusMsg.text} onClose={() => setStatusMsg(null)} />
        </div>
      )}

      {/* Primary Hero Balance Card */}
      <div className="mb-6 rounded-2xl bg-gradient-to-br from-[#0F172A] via-[#132238] to-[#0F4C5C] p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#94A3B8]">
              Available Spendable Balance
            </p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-white sm:text-4xl tabular-nums">
              {wallet ? formatBDT(wallet.available_balance) : '৳0.00'}
            </p>
            <p className="mt-2 text-xs text-[#CBD5E1]">
              Total Balance (including reserved withdrawals):{' '}
              <span className="font-semibold text-[#5EEAD4] tabular-nums">
                {wallet ? formatBDT(wallet.total_balance) : '৳0.00'}
              </span>
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
              <p className="text-[11px] uppercase tracking-wider text-[#CBD5E1]">Pending Hold</p>
              <p className="mt-0.5 text-base font-bold text-white tabular-nums">
                {formatBDT(wallet?.pending_withdrawal)}
              </p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
              <p className="text-[11px] uppercase tracking-wider text-[#CBD5E1]">Pending Comm.</p>
              <p className="mt-0.5 text-base font-bold text-[#38BDF8] tabular-nums">
                {formatBDT(wallet?.pending_commission)}
              </p>
            </div>
            <div className="col-span-2 rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm sm:col-span-1">
              <p className="text-[11px] uppercase tracking-wider text-[#CBD5E1]">Lifetime Spent</p>
              <p className="mt-0.5 text-base font-bold text-white tabular-nums">
                {formatBDT(wallet?.total_spent)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Deposits" value={formatBDT(wallet?.total_deposits)} icon={ArrowDownToLine} accent="emerald" />
        <StatCard label="Total Withdrawals" value={formatBDT(wallet?.total_withdrawals)} icon={ArrowUpFromLine} accent="amber" />
        <StatCard label="Referral Commissions" value={formatBDT(wallet?.total_commission)} icon={TrendingUp} accent="blue" />
        <StatCard label="Linked Active Wallets" value={linkedWallets.length} sub="bKash / Nagad / Rocket / Bank" icon={Wallet} accent="teal" />
      </div>

      {/* Linked Mobile & Bank Wallets Section */}
      <Card
        title="Linked Mobile & Bank Wallets"
        subtitle="Connect and OTP-verify bKash, Nagad, Rocket, Upay, CellFin, or Bank accounts for fast payouts."
        action={
          <button
            type="button"
            onClick={() => {
              setEditingWallet(null);
              setModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F172A] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E293B]"
          >
            <Plus className="h-3.5 w-3.5" /> Add New Wallet
          </button>
        }
        className="mb-6"
      >
        {loading ? (
          <p className="text-sm text-[#64748B]">Loading linked wallets...</p>
        ) : linkedWallets.length === 0 ? (
          <EmptyState
            title="No Linked Wallets Yet"
            description="Add your bKash, Nagad, Rocket, Upay, CellFin, or Bank account, verify via phone code, and activate instant payout routing."
            icon={Wallet}
            action={
              <button
                type="button"
                onClick={() => {
                  setEditingWallet(null);
                  setModalOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0D9488] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0F766E]"
              >
                <Plus className="h-4 w-4" /> Link & Verify Your First Wallet
              </button>
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {linkedWallets.map((pm) => {
              const meta = getProviderMeta(pm.method_name);
              const isActive = (pm.verification_status || 'active') === 'active';
              return (
                <div
                  key={pm.id}
                  className="flex flex-col justify-between rounded-xl border border-[#DCE4EF] bg-[#F8FAFC] p-4 transition hover:border-[#0D9488]/60 hover:bg-white"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                          style={{ backgroundColor: meta.accent }}
                        >
                          {meta.isBank ? <Building2 className="h-5 w-5" /> : meta.label.slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-[#0F172A]">{pm.method_name}</p>
                            {pm.is_default ? (
                              <span className="rounded bg-[#0F172A] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                DEFAULT
                              </span>
                            ) : null}
                          </div>
                          <p className="text-[11px] text-[#64748B]">{pm.account_type}</p>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${
                          isActive ? 'text-[#059669]' : 'text-[#D97706]'
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            isActive ? 'bg-[#10B981]' : 'bg-[#F59E0B]'
                          }`}
                        />
                        {isActive ? 'Active' : 'Pending'}
                      </span>
                    </div>

                    <div className="mt-4 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5">
                      <p className="font-mono text-base font-bold tracking-wide text-[#0F172A]">
                        {pm.account_number}
                      </p>
                      <p className="mt-0.5 text-xs font-medium text-[#334155]">
                        {pm.account_holder_name}
                      </p>
                      {pm.notes && (
                        <p className="mt-1 truncate text-[11px] text-[#64748B]">{pm.notes}</p>
                      )}
                    </div>

                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#64748B]">
                      <span className="inline-flex items-center gap-1 font-medium text-[#0F766E]">
                        <ShieldCheck className="h-3.5 w-3.5" /> OTP Verified
                      </span>
                      {pm.has_pin && (
                        <span className="inline-flex items-center gap-1 font-medium text-[#334155]">
                          <Lock className="h-3 w-3 text-[#0284C7]" /> PIN Locked
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-[#DCE4EF] pt-3">
                    <div className="flex items-center gap-1.5">
                      {!pm.is_default && (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(pm.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-[#DCE4EF] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#334155] hover:border-[#0D9488] hover:text-[#0D9488]"
                        >
                          <Star className="h-3 w-3" /> Default
                        </button>
                      )}
                      <Link
                        to="/dashboard/withdraw"
                        className="inline-flex items-center gap-1 rounded-md bg-[#0D9488]/10 px-2.5 py-1 text-[11px] font-semibold text-[#0F766E] hover:bg-[#0D9488] hover:text-white"
                      >
                        Withdraw
                      </Link>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingWallet(pm);
                          setModalOpen(true);
                        }}
                        className="rounded-md p-1.5 text-[#64748B] hover:bg-[#EDF2F7] hover:text-[#0F172A]"
                        title="Edit & Re-Verify"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveWallet(pm.id)}
                        className="rounded-md p-1.5 text-[#DC2626] hover:bg-[#FEF2F2]"
                        title="Remove Wallet"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Recent Wallet Movements */}
      <Card
        title="Recent Wallet Movements"
        subtitle="Immutable chronological log of every balance credit and debit."
        action={
          <Link to="/dashboard/transactions" className="text-xs font-semibold text-[#0D9488] hover:underline">
            Full Ledger →
          </Link>
        }
      >
        {loading ? (
          <p className="text-sm text-[#64748B]">Loading wallet movements...</p>
        ) : recentTx.length === 0 ? (
          <EmptyState
            title="No Ledger Movements Yet"
            description="Your deposits, orders, referral commissions, and withdrawals will appear here."
            icon={Clock}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#DCE4EF] text-[11px] uppercase tracking-wider text-[#64748B]">
                  <th className="py-2.5 pr-4">TX ID</th>
                  <th className="py-2.5 pr-4">Type</th>
                  <th className="py-2.5 pr-4">Description</th>
                  <th className="py-2.5 pr-4">Amount</th>
                  <th className="py-2.5 pr-4">Balance After</th>
                  <th className="py-2.5 pr-4">Status</th>
                  <th className="py-2.5">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDF2F7]">
                {recentTx.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#F8FAFC]">
                    <td className="py-3 pr-4 font-mono text-xs text-[#64748B]">{tx.tx_uid}</td>
                    <td className="py-3 pr-4 font-medium capitalize text-[#0F172A]">
                      {tx.tx_type.replace(/_/g, ' ')}
                    </td>
                    <td className="max-w-xs truncate py-3 pr-4 text-xs text-[#475569]">{tx.description}</td>
                    <td
                      className={`py-3 pr-4 font-semibold tabular-nums ${
                        tx.direction === 'credit' ? 'text-[#059669]' : 'text-[#DC2626]'
                      }`}
                    >
                      {tx.direction === 'credit' ? '+' : '-'}
                      {formatBDT(tx.amount)}
                    </td>
                    <td className="py-3 pr-4 font-medium text-[#0F172A] tabular-nums">
                      {formatBDT(tx.new_balance)}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge status={tx.status} />
                    </td>
                    <td className="whitespace-nowrap py-3 text-xs text-[#64748B]">
                      {formatDateTime(tx.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <LinkWalletModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingWallet(null);
        }}
        onSuccess={() => {
          setStatusMsg({ type: 'success', text: 'Wallet verified via phone code and activated in your account!' });
          loadWalletData();
        }}
        editing={editingWallet}
        defaultHolderName={user?.full_name || ''}
        defaultPhone={user?.phone || ''}
      />
    </div>
  );
};

export const TransactionsPage: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    type: 'all',
    status: 'all',
    payment_method: 'all',
    date_from: '',
    date_to: '',
    min_amount: '',
    max_amount: '',
    page: 1,
  });

  const load = async (f = filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(f).forEach(([k, v]) => {
        if (v !== '' && v !== 'all') params.set(k, String(v));
      });
      params.set('limit', '15');
      const res = await api.userGet(`/api/wallet/transactions?${params.toString()}`);
      setItems(res.data?.items || []);
      setPagination(res.data?.pagination || { page: 1, total_pages: 1, total: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(filters);
  }, [filters.page, filters.type, filters.status, filters.payment_method]);

  const exportCsv = () => {
    const headers = ['TX_UID', 'Type', 'Direction', 'Amount_BDT', 'Prev_Balance', 'New_Balance', 'Method', 'Reference', 'Status', 'Description', 'Date'];
    const rows = items.map((t) => [
      t.tx_uid,
      t.tx_type,
      t.direction,
      t.amount,
      t.previous_balance,
      t.new_balance,
      t.payment_method,
      t.reference_id,
      t.status,
      `"${String(t.description || '').replace(/"/g, '""')}"`,
      t.created_at,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gopaybd-transactions-page${pagination.page}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="Transaction History"
        subtitle="Filterable and exportable BDT ledger of every deposit, withdrawal, commission, order, and adjustment."
        actions={
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#DCE4EF] bg-white px-4 py-2 text-sm font-semibold text-[#0F172A] hover:bg-[#F8FAFC]"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        }
      />

      <Card className="mb-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load({ ...filters, page: 1 });
          }}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#64748B]" />
            <input
              type="text"
              placeholder="Search TX ID, Reference, Note..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className={`${inputCls} pl-9`}
            />
          </div>
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value, page: 1 })}
            className={inputCls}
          >
            <option value="all">All Transaction Types</option>
            <option value="deposit">Deposit</option>
            <option value="withdrawal">Withdrawal</option>
            <option value="withdrawal_reserve">Withdrawal Reserve</option>
            <option value="withdrawal_release">Withdrawal Release</option>
            <option value="order_payment">Order Payment</option>
            <option value="referral_commission">Referral Commission</option>
            <option value="refund">Refund</option>
            <option value="admin_adjustment">Admin Adjustment</option>
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
            className={inputCls}
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="reversed">Reversed</option>
          </select>
          <select
            value={filters.payment_method}
            onChange={(e) => setFilters({ ...filters, payment_method: e.target.value, page: 1 })}
            className={inputCls}
          >
            <option value="all">All Channels</option>
            <option value="bKash">bKash</option>
            <option value="Nagad">Nagad</option>
            <option value="Rocket">Rocket</option>
            <option value="Upay">Upay</option>
            <option value="CellFin">CellFin</option>
            <option value="Bank">Bank</option>
            <option value="wallet">Wallet</option>
          </select>
          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
            className={inputCls}
          />
          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
            className={inputCls}
          />
          <input
            type="number"
            placeholder="Min BDT"
            value={filters.min_amount}
            onChange={(e) => setFilters({ ...filters, min_amount: e.target.value })}
            className={inputCls}
          />
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Max BDT"
              value={filters.max_amount}
              onChange={(e) => setFilters({ ...filters, max_amount: e.target.value })}
              className={inputCls}
            />
            <button
              type="submit"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#0D9488] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0F766E]"
            >
              <Filter className="h-4 w-4" /> Apply
            </button>
          </div>
        </form>
      </Card>

      <Card title={`Ledger Entries (${pagination.total})`}>
        {loading ? (
          <p className="text-sm text-[#64748B]">Loading ledger...</p>
        ) : items.length === 0 ? (
          <EmptyState
            title="No Matching Transactions"
            description="Adjust your filters or complete a wallet action to generate ledger entries."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#DCE4EF] text-[11px] uppercase tracking-wider text-[#64748B]">
                    <th className="py-2.5 pr-4">TX ID</th>
                    <th className="py-2.5 pr-4">Type</th>
                    <th className="py-2.5 pr-4">Method</th>
                    <th className="py-2.5 pr-4">Reference</th>
                    <th className="py-2.5 pr-4">Amount</th>
                    <th className="py-2.5 pr-4">Prev → New Balance</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDF2F7]">
                  {items.map((tx) => (
                    <tr key={tx.id} className="hover:bg-[#F8FAFC]">
                      <td className="py-3 pr-4 font-mono text-xs text-[#64748B]">{tx.tx_uid}</td>
                      <td className="py-3 pr-4">
                        <p className="font-semibold capitalize text-[#0F172A]">{tx.tx_type.replace(/_/g, ' ')}</p>
                        <p className="max-w-[220px] truncate text-[11px] text-[#64748B]">{tx.description}</p>
                      </td>
                      <td className="py-3 pr-4 text-xs font-medium capitalize text-[#334155]">
                        {tx.payment_method}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-[#475569]">{tx.reference_id}</td>
                      <td
                        className={`py-3 pr-4 font-bold tabular-nums ${
                          tx.direction === 'credit' ? 'text-[#059669]' : 'text-[#DC2626]'
                        }`}
                      >
                        {tx.direction === 'credit' ? '+' : '-'}
                        {formatBDT(tx.amount)}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4 text-xs text-[#475569] tabular-nums">
                        {formatBDT(tx.previous_balance)} →{' '}
                        <span className="font-semibold text-[#0F172A]">{formatBDT(tx.new_balance)}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge status={tx.status} />
                      </td>
                      <td className="whitespace-nowrap py-3 text-xs text-[#64748B]">
                        {formatDateTime(tx.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination.total_pages > 1 && (
              <div className="mt-4 flex items-center justify-between border-t border-[#DCE4EF] pt-4 text-xs">
                <span className="text-[#64748B]">
                  Page {pagination.page} of {pagination.total_pages}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={pagination.page <= 1}
                    onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                    className="rounded-lg border border-[#DCE4EF] px-3 py-1.5 font-medium text-[#334155] disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    disabled={pagination.page >= pagination.total_pages}
                    onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                    className="rounded-lg border border-[#DCE4EF] px-3 py-1.5 font-medium text-[#334155] disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
};
