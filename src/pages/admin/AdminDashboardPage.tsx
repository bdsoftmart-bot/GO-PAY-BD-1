import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  ArrowDownCircle,
  ArrowUpCircle,
  ShoppingBag,
  Percent,
  Wallet,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { api } from '../../lib/api';
import { formatBDT, formatDateTime } from '../../lib/format';
import { PageHeader, StatCard, StatusText, SkeletonRows, btnPrimary, btnSecondary } from '../../components/ui/Primitives';

export const AdminDashboardPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .adminGet('/api/admin/dashboard')
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader breadcrumb="Admin Panel / Overview" title="Executive Dashboard" />
        <SkeletonRows rows={6} cols={4} />
      </div>
    );
  }

  const m = data?.metrics || {};
  const charts = data?.charts || [];
  const queues = data?.queues || {};

  return (
    <div className="space-y-7">
      <PageHeader
        breadcrumb="Admin Panel / Dashboard"
        title="Platform Control Overview"
        subtitle="Real-time operational metrics, pending verification queues, and 14-day financial trends."
        actions={
          <>
            <Link to="/admin/reports" className={btnSecondary}>Payment Number Reports</Link>
            <Link to="/admin/deposits" className={btnPrimary}>
              Pending Deposits ({m.pending_deposits_count ?? 0})
            </Link>
          </>
        }
      />

      {/* 16 Financial & User KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard accent="primary" label="Platform Revenue" value={formatBDT(m.platform_revenue)} subtext="Orders + Fees − Credited Comm." icon={<Wallet className="w-4 h-4" />} />
        <StatCard label="Approved Deposits" value={formatBDT(m.total_approved_deposits)} subtext={`Total submitted: ${formatBDT(m.total_deposits)}`} icon={<ArrowDownCircle className="w-4 h-4" />} />
        <StatCard label="Pending Deposits" value={formatBDT(m.pending_deposits)} subtext={`${m.pending_deposits_count ?? 0} awaiting review`} icon={<Clock className="w-4 h-4" />} />
        <StatCard label="Paid Withdrawals" value={formatBDT(m.paid_withdrawals)} subtext={`Pending: ${formatBDT(m.pending_withdrawals)} (${m.pending_withdrawals_count ?? 0})`} icon={<ArrowUpCircle className="w-4 h-4" />} />

        <StatCard label="Total Users" value={String(m.total_users ?? 0)} subtext={`Active: ${m.active_users ?? 0} · Suspended: ${m.suspended_users ?? 0}`} icon={<Users className="w-4 h-4" />} />
        <StatCard label="New Users Today" value={String(m.new_users_today ?? 0)} subtext="Registered in last 24h" icon={<CheckCircle2 className="w-4 h-4" />} />
        <StatCard label="Orders (Completed / Total)" value={`${m.completed_orders ?? 0} / ${m.total_orders ?? 0}`} subtext="Eligible commerce volume" icon={<ShoppingBag className="w-4 h-4" />} />
        <StatCard label="Commissions (Paid / Pending)" value={formatBDT(m.paid_commission)} subtext={`Pending: ${formatBDT(m.pending_commission)} · Total: ${formatBDT(m.total_commission)}`} icon={<Percent className="w-4 h-4" />} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-[#DCE4EF] rounded-xl p-5">
          <h2 className="text-sm font-bold text-[#0F172A]">Daily Deposits vs Paid Withdrawals (14 Days)</h2>
          <p className="text-xs text-[#64748B] mb-4">Real verified cash inflows and outflows in BDT</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#DCE4EF" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #DCE4EF', fontSize: 12 }} formatter={(v: any) => formatBDT(v)} />
                <Bar dataKey="deposits" name="Approved Deposits" fill="#0D9488" radius={[4, 4, 0, 0]} />
                <Bar dataKey="withdrawals" name="Paid Withdrawals" fill="#0284C7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-[#DCE4EF] rounded-xl p-5">
          <h2 className="text-sm font-bold text-[#0F172A]">Revenue &amp; Order Growth (14 Days)</h2>
          <p className="text-xs text-[#64748B] mb-4">Completed order volume vs net platform revenue</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#DCE4EF" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #DCE4EF', fontSize: 12 }} formatter={(v: any) => formatBDT(v)} />
                <Line type="monotone" dataKey="orders" name="Orders" stroke="#0284C7" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#059669" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Live Action Queues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#DCE4EF] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#DCE4EF] flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#0F172A]">Pending Deposit Verifications</h2>
            <Link to="/admin/deposits" className="text-xs font-semibold text-[#0D9488] hover:underline">Manage All →</Link>
          </div>
          {queues.pending_deposits?.length ? (
            <div className="divide-y divide-[#EDF2F7]">
              {queues.pending_deposits.map((d: any) => (
                <div key={d.id} className="px-5 py-3 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-semibold text-[#0F172A]">{d.full_name} (@{d.username})</div>
                    <div className="font-mono text-[11px] text-[#64748B]">{d.payment_method} · {d.sender_number} · {d.transaction_id}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-[#0D9488] tabular-nums">{formatBDT(d.amount)}</div>
                    <div className="text-[11px] text-[#64748B]">{formatDateTime(d.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-[#64748B]">No pending deposits in queue.</div>
          )}
        </div>

        <div className="bg-white border border-[#DCE4EF] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#DCE4EF] flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#0F172A]">Pending Withdrawal Payouts</h2>
            <Link to="/admin/withdrawals" className="text-xs font-semibold text-[#0D9488] hover:underline">Manage All →</Link>
          </div>
          {queues.pending_withdrawals?.length ? (
            <div className="divide-y divide-[#EDF2F7]">
              {queues.pending_withdrawals.map((w: any) => (
                <div key={w.id} className="px-5 py-3 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-semibold text-[#0F172A]">{w.full_name} (@{w.username})</div>
                    <div className="font-mono text-[11px] text-[#64748B]">{w.payment_method} · {w.account_number}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-[#0F172A] tabular-nums">Net {formatBDT(w.net_amount)}</div>
                    <StatusText status={w.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-[#64748B]">No pending withdrawals in queue.</div>
          )}
        </div>
      </div>
    </div>
  );
};
