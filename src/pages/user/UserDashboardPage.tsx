import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet,
  CheckCircle2,
  Clock,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  Users,
  ShoppingBag,
  Link2,
  ReceiptText,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { api } from '../../lib/api';
import { formatBDT, formatDateTime } from '../../lib/format';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  StatCard,
  StatusText,
  EmptyState,
  PageHeader,
  SkeletonRows,
  btnPrimary,
  btnSecondary,
} from '../../components/ui/Primitives';

export const UserDashboardPage: React.FC = () => {
  const { t } = useLanguage();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activityTab, setActivityTab] = useState<'transactions' | 'deposits' | 'withdrawals' | 'orders' | 'commissions'>('transactions');

  useEffect(() => {
    api
      .userGet('/api/dashboard')
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader breadcrumb="Dashboard" title="Overview" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 bg-white border border-[#DCE4EF] rounded-xl animate-pulse" />
          ))}
        </div>
        <SkeletonRows rows={5} cols={5} />
      </div>
    );
  }

  const s = data?.summary || {};
  const charts = data?.analytics || [];
  const recent = data?.recent || {};

  return (
    <div className="space-y-7">
      <PageHeader
        breadcrumb="Member Portal / Home"
        title="Financial Dashboard"
        subtitle="Real-time BDT wallet balances, payment records, and referral commission activity."
        actions={
          <>
            <Link to="/dashboard/deposit" className={btnPrimary}>
              <ArrowDownCircle className="w-4 h-4" />
              {t('qa_deposit')}
            </Link>
            <Link to="/dashboard/withdraw" className={btnSecondary}>
              <ArrowUpCircle className="w-4 h-4" />
              {t('qa_withdraw')}
            </Link>
          </>
        }
      />

      {/* 8 Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          accent="primary"
          label={t('card_total_balance')}
          value={formatBDT(s.total_balance)}
          subtext={`Available + Pending withdrawal`}
          icon={<Wallet className="w-4 h-4" />}
        />
        <StatCard
          label={t('card_available_balance')}
          value={formatBDT(s.available_balance)}
          subtext="Ready for orders or withdrawal"
          icon={<CheckCircle2 className="w-4 h-4" />}
        />
        <StatCard
          label={t('card_pending_balance')}
          value={formatBDT(s.pending_balance)}
          subtext={`Deposits pending: ${formatBDT(s.pending_deposits)}`}
          icon={<Clock className="w-4 h-4" />}
        />
        <StatCard
          label={t('card_total_deposit')}
          value={formatBDT(s.total_deposits)}
          subtext="Approved cumulative deposits"
          icon={<ArrowDownCircle className="w-4 h-4" />}
        />
        <StatCard
          label={t('card_total_withdrawal')}
          value={formatBDT(s.total_withdrawals)}
          subtext="Paid cumulative withdrawals"
          icon={<ArrowUpCircle className="w-4 h-4" />}
        />
        <StatCard
          label={t('card_total_earnings')}
          value={formatBDT(s.total_earnings)}
          subtext="Verified credited earnings"
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <StatCard
          label={t('card_referral_commission')}
          value={formatBDT(s.total_commission)}
          subtext={`L1: ${s.direct_referrals ?? 0} · L2: ${s.level2_referrals ?? 0} referrals`}
          icon={<Users className="w-4 h-4" />}
        />
        <StatCard
          label={t('card_total_orders')}
          value={String(s.total_orders ?? 0)}
          subtext={`Order volume: ${formatBDT(s.total_order_value)}`}
          icon={<ShoppingBag className="w-4 h-4" />}
        />
      </div>

      {/* Quick Actions Strip */}
      <div className="bg-white border border-[#DCE4EF] rounded-xl p-4 flex flex-wrap items-center gap-2.5">
        <span className="text-xs font-semibold text-[#64748B] mr-2">Quick Actions</span>
        <Link to="/dashboard/deposit" className="px-3 py-1.5 rounded-lg bg-[#F0FDFA] hover:bg-[#CCFBF1] text-xs font-semibold text-[#0F766E] inline-flex items-center gap-1.5">
          <ArrowDownCircle className="w-3.5 h-3.5" /> {t('qa_deposit')}
        </Link>
        <Link to="/dashboard/withdraw" className="px-3 py-1.5 rounded-lg bg-[#F4F7FB] hover:bg-[#E2E8F0] text-xs font-semibold text-[#0F172A] inline-flex items-center gap-1.5">
          <ArrowUpCircle className="w-3.5 h-3.5" /> {t('qa_withdraw')}
        </Link>
        <Link to="/dashboard/referrals" className="px-3 py-1.5 rounded-lg bg-[#F4F7FB] hover:bg-[#E2E8F0] text-xs font-semibold text-[#0F172A] inline-flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" /> {t('qa_referrals')}
        </Link>
        <Link to="/dashboard/wallet" className="px-3 py-1.5 rounded-lg bg-[#F4F7FB] hover:bg-[#E2E8F0] text-xs font-semibold text-[#0F172A] inline-flex items-center gap-1.5">
          <Wallet className="w-3.5 h-3.5" /> {t('qa_wallet')}
        </Link>
        <Link to="/dashboard/transactions" className="px-3 py-1.5 rounded-lg bg-[#F4F7FB] hover:bg-[#E2E8F0] text-xs font-semibold text-[#0F172A] inline-flex items-center gap-1.5">
          <ReceiptText className="w-3.5 h-3.5" /> {t('qa_transactions')}
        </Link>
        <Link to="/dashboard/referral-link" className="px-3 py-1.5 rounded-lg bg-[#F0F9FF] hover:bg-[#E0F2FE] text-xs font-semibold text-[#0369A1] inline-flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5" /> {t('qa_ref_link')}
        </Link>
      </div>

      {/* Charts Section (Real Database Analytics) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-[#DCE4EF] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-[#0F172A]">Monthly Deposits &amp; Withdrawals (BDT)</h2>
              <p className="text-xs text-[#64748B]">Approved deposits vs paid withdrawals over the last 6 months</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#DCE4EF" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #DCE4EF', fontSize: 12 }}
                  formatter={(v: any) => formatBDT(v)}
                />
                <Bar dataKey="deposits" name="Deposits" fill="#0D9488" radius={[4, 4, 0, 0]} />
                <Bar dataKey="withdrawals" name="Withdrawals" fill="#0284C7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-[#DCE4EF] rounded-xl p-5">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-[#0F172A]">Commission Earnings &amp; Referral Growth</h2>
            <p className="text-xs text-[#64748B]">Credited order commissions (BDT)</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#DCE4EF" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #DCE4EF', fontSize: 12 }}
                  formatter={(v: any, name: any) => (name === 'Commissions' ? formatBDT(v) : v)}
                />
                <Area type="monotone" dataKey="commissions" name="Commissions" stroke="#059669" fill="#059669" fillOpacity={0.14} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activity Tabs */}
      <div className="bg-white border border-[#DCE4EF] rounded-xl overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-[#DCE4EF] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-[#0F172A]">Recent Activity</h2>
          <div className="flex items-center gap-1 p-1 bg-[#F4F7FB] rounded-lg overflow-x-auto">
            {([
              ['transactions', 'Transactions'],
              ['deposits', 'Deposits'],
              ['withdrawals', 'Withdrawals'],
              ['orders', 'Orders'],
              ['commissions', 'Commissions'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setActivityTab(key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  activityTab === key ? 'bg-white text-[#0F172A] shadow-xs' : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          {activityTab === 'transactions' && (
            recent.transactions?.length ? (
              <table className="w-full text-sm">
                <thead className="bg-[#F8FAFC] text-xs text-[#64748B] border-b border-[#DCE4EF]">
                  <tr>
                    <th className="text-left font-semibold px-5 py-3">Transaction ID</th>
                    <th className="text-left font-semibold px-5 py-3">Type</th>
                    <th className="text-left font-semibold px-5 py-3">Description</th>
                    <th className="text-right font-semibold px-5 py-3">Amount</th>
                    <th className="text-right font-semibold px-5 py-3">New Balance</th>
                    <th className="text-left font-semibold px-5 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE4EF]">
                  {recent.transactions.map((tx: any) => (
                    <tr key={tx.id} className="hover:bg-[#F8FAFC]">
                      <td className="px-5 py-3 font-mono text-xs">{tx.tx_uid}</td>
                      <td className="px-5 py-3 text-xs capitalize">{String(tx.tx_type).replace(/_/g, ' ')}</td>
                      <td className="px-5 py-3 text-xs text-[#64748B] max-w-xs truncate">{tx.description}</td>
                      <td className={`px-5 py-3 text-right font-mono text-xs font-semibold tabular-nums ${tx.direction === 'credit' ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
                        {tx.direction === 'credit' ? '+' : '-'}{formatBDT(tx.amount)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-xs tabular-nums">{formatBDT(tx.new_balance)}</td>
                      <td className="px-5 py-3 text-xs text-[#64748B] whitespace-nowrap">{formatDateTime(tx.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-6">
                <EmptyState
                  title="No transactions yet"
                  description="Once you make a verified deposit, place an order, or earn referral commissions, every ledger entry will appear here."
                  action={<Link to="/dashboard/deposit" className={btnPrimary}>Make Your First Deposit</Link>}
                />
              </div>
            )
          )}

          {activityTab === 'deposits' && (
            recent.deposits?.length ? (
              <table className="w-full text-sm">
                <thead className="bg-[#F8FAFC] text-xs text-[#64748B] border-b border-[#DCE4EF]">
                  <tr>
                    <th className="text-left font-semibold px-5 py-3">Deposit ID</th>
                    <th className="text-left font-semibold px-5 py-3">Method</th>
                    <th className="text-left font-semibold px-5 py-3">Transaction ID</th>
                    <th className="text-right font-semibold px-5 py-3">Amount</th>
                    <th className="text-left font-semibold px-5 py-3">Status</th>
                    <th className="text-left font-semibold px-5 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE4EF]">
                  {recent.deposits.map((d: any) => (
                    <tr key={d.id} className="hover:bg-[#F8FAFC]">
                      <td className="px-5 py-3 font-mono text-xs">{d.deposit_uid}</td>
                      <td className="px-5 py-3 text-xs">{d.payment_method}</td>
                      <td className="px-5 py-3 font-mono text-xs">{d.transaction_id}</td>
                      <td className="px-5 py-3 text-right font-mono text-xs font-semibold tabular-nums">{formatBDT(d.amount)}</td>
                      <td className="px-5 py-3"><StatusText status={d.status} /></td>
                      <td className="px-5 py-3 text-xs text-[#64748B] whitespace-nowrap">{formatDateTime(d.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-6">
                <EmptyState title="No deposits yet" description="Submit a bKash or Nagad deposit to fund your wallet." action={<Link to="/dashboard/deposit" className={btnPrimary}>Deposit Money</Link>} />
              </div>
            )
          )}

          {activityTab === 'withdrawals' && (
            recent.withdrawals?.length ? (
              <table className="w-full text-sm">
                <thead className="bg-[#F8FAFC] text-xs text-[#64748B] border-b border-[#DCE4EF]">
                  <tr>
                    <th className="text-left font-semibold px-5 py-3">Withdrawal ID</th>
                    <th className="text-left font-semibold px-5 py-3">Method & Account</th>
                    <th className="text-right font-semibold px-5 py-3">Requested</th>
                    <th className="text-right font-semibold px-5 py-3">Net Payout</th>
                    <th className="text-left font-semibold px-5 py-3">Status</th>
                    <th className="text-left font-semibold px-5 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE4EF]">
                  {recent.withdrawals.map((w: any) => (
                    <tr key={w.id} className="hover:bg-[#F8FAFC]">
                      <td className="px-5 py-3 font-mono text-xs">{w.withdrawal_uid}</td>
                      <td className="px-5 py-3 text-xs">{w.payment_method} · {w.account_number}</td>
                      <td className="px-5 py-3 text-right font-mono text-xs tabular-nums">{formatBDT(w.amount)}</td>
                      <td className="px-5 py-3 text-right font-mono text-xs font-semibold tabular-nums">{formatBDT(w.net_amount)}</td>
                      <td className="px-5 py-3"><StatusText status={w.status} /></td>
                      <td className="px-5 py-3 text-xs text-[#64748B] whitespace-nowrap">{formatDateTime(w.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-6">
                <EmptyState title="No withdrawals yet" description="Withdraw available BDT funds to your saved bKash or Nagad account anytime." action={<Link to="/dashboard/withdraw" className={btnSecondary}>Go to Withdrawals</Link>} />
              </div>
            )
          )}

          {activityTab === 'orders' && (
            recent.orders?.length ? (
              <table className="w-full text-sm">
                <thead className="bg-[#F8FAFC] text-xs text-[#64748B] border-b border-[#DCE4EF]">
                  <tr>
                    <th className="text-left font-semibold px-5 py-3">Order #</th>
                    <th className="text-left font-semibold px-5 py-3">Product / Service</th>
                    <th className="text-right font-semibold px-5 py-3">Total</th>
                    <th className="text-left font-semibold px-5 py-3">Order Status</th>
                    <th className="text-left font-semibold px-5 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE4EF]">
                  {recent.orders.map((o: any) => (
                    <tr key={o.id} className="hover:bg-[#F8FAFC]">
                      <td className="px-5 py-3 font-mono text-xs">
                        <Link to={`/dashboard/orders/${o.id}`} className="text-[#0D9488] font-semibold hover:underline">{o.order_number}</Link>
                      </td>
                      <td className="px-5 py-3 text-xs">{o.product_name} (x{o.quantity})</td>
                      <td className="px-5 py-3 text-right font-mono text-xs font-semibold tabular-nums">{formatBDT(o.total)}</td>
                      <td className="px-5 py-3"><StatusText status={o.order_status} /></td>
                      <td className="px-5 py-3 text-xs text-[#64748B] whitespace-nowrap">{formatDateTime(o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-6">
                <EmptyState title="No orders placed yet" description="Browse GO PAY BD business services and place your first order." action={<Link to="/dashboard/orders" className={btnPrimary}>Browse Orders</Link>} />
              </div>
            )
          )}

          {activityTab === 'commissions' && (
            recent.commissions?.length ? (
              <table className="w-full text-sm">
                <thead className="bg-[#F8FAFC] text-xs text-[#64748B] border-b border-[#DCE4EF]">
                  <tr>
                    <th className="text-left font-semibold px-5 py-3">Commission ID</th>
                    <th className="text-left font-semibold px-5 py-3">Order</th>
                    <th className="text-left font-semibold px-5 py-3">Level</th>
                    <th className="text-right font-semibold px-5 py-3">Amount</th>
                    <th className="text-left font-semibold px-5 py-3">Status</th>
                    <th className="text-left font-semibold px-5 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE4EF]">
                  {recent.commissions.map((c: any) => (
                    <tr key={c.id} className="hover:bg-[#F8FAFC]">
                      <td className="px-5 py-3 font-mono text-xs">{c.commission_uid}</td>
                      <td className="px-5 py-3 font-mono text-xs">{c.order_number}</td>
                      <td className="px-5 py-3 text-xs">Level {c.referral_level} ({c.rate_value}{c.rate_type === 'percentage' ? '%' : ' BDT'})</td>
                      <td className="px-5 py-3 text-right font-mono text-xs font-semibold text-[#059669] tabular-nums">{formatBDT(c.commission_amount)}</td>
                      <td className="px-5 py-3"><StatusText status={c.status} /></td>
                      <td className="px-5 py-3 text-xs text-[#64748B] whitespace-nowrap">{formatDateTime(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-6">
                <EmptyState title="No commissions yet" description="Share your referral link. When referred users complete eligible orders, commissions appear here." action={<Link to="/dashboard/referral-link" className={btnPrimary}>Create Referral Link</Link>} />
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};
