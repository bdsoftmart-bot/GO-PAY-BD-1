import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { Copy, Share2, Users, TrendingUp, Link2, CheckCircle2, ShoppingBag } from 'lucide-react';
import { api } from '../../lib/api';
import { formatBDT, formatDateTime } from '../../lib/format';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  PageHeader,
  StatCard,
  StatusText,
  EmptyState,
  btnPrimary,
  btnSecondary,
  btnGold,
} from '../../components/ui/Primitives';

export const ReferralsPage: React.FC = () => {
  const [summary, setSummary] = useState<any>(null);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [earnings, setEarnings] = useState<any[]>([]);
  const [tab, setTab] = useState<'direct' | 'level2' | 'all' | 'earnings'>('direct');

  useEffect(() => {
    Promise.all([
      api.userGet('/api/referrals/summary'),
      api.userGet('/api/referrals'),
      api.userGet('/api/referrals/earnings'),
    ]).then(([sRes, rRes, eRes]) => {
      setSummary(sRes.data);
      setReferrals(rRes.data || []);
      setEarnings(eRes.data || []);
    });
  }, []);

  const filteredRefs =
    tab === 'direct'
      ? referrals.filter((r) => r.level === 1)
      : tab === 'level2'
      ? referrals.filter((r) => r.level === 2)
      : referrals;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Member Portal / Referrals"
        title="Two-Level Referral Program"
        subtitle="Track Level 1 direct referrals, Level 2 network referrals, and verified order commissions."
        actions={
          <Link to="/dashboard/referral-link" className={btnPrimary}>
            <Link2 className="w-4 h-4" /> Manage Referral Link & QR
          </Link>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <StatCard label="Total Direct (L1)" value={String(summary?.total_level_1 ?? 0)} />
        <StatCard label="Level 2 Network" value={String(summary?.total_level_2 ?? 0)} />
        <StatCard label="Active Referrals" value={String(summary?.active_referrals ?? 0)} />
        <StatCard label="Referral Orders" value={String(summary?.referral_orders ?? 0)} />
        <StatCard accent="primary" label="Referral Earnings" value={formatBDT(summary?.referral_earnings)} />
        <StatCard label="Pending Commission" value={formatBDT(summary?.pending_earnings)} />
      </div>

      <div className="bg-[#F8FAFC] border border-[#DCE4EF] rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#64748B]">
        <span>
          Eligible Commission Policy: Level 1 earns <strong className="text-[#0F172A]">{summary?.level_1_rate || '5.00'}{summary?.commission_type === 'percentage' ? '%' : ' BDT'}</strong> · Level 2 earns <strong className="text-[#0F172A]">{summary?.level_2_rate || '2.00'}{summary?.commission_type === 'percentage' ? '%' : ' BDT'}</strong> on completed orders ≥ <strong className="text-[#0F172A]">{formatBDT(summary?.min_qualifying_order || 500)}</strong>.
        </span>
        <span className="text-[#0D9488] font-semibold">Strictly Order-Based (No Deposit/Signup Commissions)</span>
      </div>

      <div className="bg-white border border-[#DCE4EF] rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#DCE4EF] flex items-center gap-1 bg-[#F8FAFC] overflow-x-auto">
          {([
            ['direct', 'Direct Referrals (L1)'],
            ['level2', 'Level 2 Referrals'],
            ['all', 'All Referrals'],
            ['earnings', 'Referral Earnings'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer ${
                tab === key ? 'bg-[#0F172A] text-[#F8FAFC]' : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab !== 'earnings' ? (
          filteredRefs.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<Users className="w-5 h-5" />}
                title="No referrals in this tier yet"
                description="Share your personal referral link or QR code to connect new customers."
                action={<Link to="/dashboard/referral-link" className={btnPrimary}>Get Referral Link</Link>}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#F8FAFC] text-xs text-[#64748B] border-b border-[#DCE4EF]">
                  <tr>
                    <th className="text-left font-semibold px-5 py-3">User ID</th>
                    <th className="text-left font-semibold px-5 py-3">Name</th>
                    <th className="text-left font-semibold px-5 py-3">Username</th>
                    <th className="text-left font-semibold px-5 py-3">Level</th>
                    <th className="text-right font-semibold px-5 py-3">Completed Orders</th>
                    <th className="text-right font-semibold px-5 py-3">Your Earned</th>
                    <th className="text-left font-semibold px-5 py-3">Status</th>
                    <th className="text-left font-semibold px-5 py-3">Joining Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE4EF]">
                  {filteredRefs.map((r) => (
                    <tr key={r.id} className="hover:bg-[#F8FAFC]">
                      <td className="px-5 py-3 font-mono text-xs">{r.user_uid}</td>
                      <td className="px-5 py-3 text-xs font-semibold">{r.full_name}</td>
                      <td className="px-5 py-3 text-xs text-[#64748B]">@{r.username}</td>
                      <td className="px-5 py-3 text-xs font-semibold text-[#0D9488]">Level {r.level}</td>
                      <td className="px-5 py-3 text-right font-mono text-xs tabular-nums">{r.order_count}</td>
                      <td className="px-5 py-3 text-right font-mono text-xs font-semibold text-[#059669] tabular-nums">
                        {formatBDT(r.commission_generated)}
                      </td>
                      <td className="px-5 py-3"><StatusText status={r.user_status} /></td>
                      <td className="px-5 py-3 text-xs text-[#64748B] whitespace-nowrap">{formatDateTime(r.joined_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : earnings.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<TrendingUp className="w-5 h-5" />}
              title="No referral commissions yet"
              description="Commissions appear automatically when your Level 1 or Level 2 referrals complete qualifying orders."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F8FAFC] text-xs text-[#64748B] border-b border-[#DCE4EF]">
                <tr>
                  <th className="text-left font-semibold px-5 py-3">Commission ID</th>
                  <th className="text-left font-semibold px-5 py-3">Order ID</th>
                  <th className="text-left font-semibold px-5 py-3">Customer</th>
                  <th className="text-left font-semibold px-5 py-3">Level & Rate</th>
                  <th className="text-right font-semibold px-5 py-3">Order Amount</th>
                  <th className="text-right font-semibold px-5 py-3">Commission</th>
                  <th className="text-left font-semibold px-5 py-3">Status</th>
                  <th className="text-left font-semibold px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE4EF]">
                {earnings.map((c) => (
                  <tr key={c.id} className="hover:bg-[#F8FAFC]">
                    <td className="px-5 py-3 font-mono text-xs">{c.commission_uid}</td>
                    <td className="px-5 py-3 font-mono text-xs">{c.order_number}</td>
                    <td className="px-5 py-3 text-xs">@{c.source_username}</td>
                    <td className="px-5 py-3 text-xs">Level {c.referral_level} · {c.rate_value}{c.rate_type === 'percentage' ? '%' : ' BDT'}</td>
                    <td className="px-5 py-3 text-right font-mono text-xs tabular-nums">{formatBDT(c.order_amount)}</td>
                    <td className="px-5 py-3 text-right font-mono text-xs font-semibold text-[#059669] tabular-nums">{formatBDT(c.commission_amount)}</td>
                    <td className="px-5 py-3"><StatusText status={c.status} /></td>
                    <td className="px-5 py-3 text-xs text-[#64748B] whitespace-nowrap">{formatDateTime(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export const ReferralLinkPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [summary, setSummary] = useState<any>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');

  const referralUrl = `${window.location.origin}/register?ref=${user?.referral_code || ''}`;

  useEffect(() => {
    api.userGet('/api/referrals/summary').then((res) => setSummary(res.data));
    if (user?.referral_code) {
      QRCode.toDataURL(referralUrl, {
        width: 240,
        margin: 2,
        color: { dark: '#0F172A', light: '#FFFFFF' },
      }).then(setQrDataUrl);
    }
  }, [referralUrl, user?.referral_code]);

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast(`${label} copied to clipboard.`);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join GO PAY BD',
          text: `Register on GO PAY BD using my referral code ${user?.referral_code}`,
          url: referralUrl,
        });
      } catch {
        copyText(referralUrl, 'Referral link');
      }
    } else {
      copyText(referralUrl, 'Referral link');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Member Portal / Referral Link"
        title="Referral Link & QR Code"
        subtitle="Share your verified referral link and monitor clicks, registrations, conversion rate, and completed referral orders."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-[#DCE4EF] rounded-xl p-6 space-y-5">
          <div>
            <label className="text-xs font-semibold text-[#64748B]">Your Unique Referral Code</label>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1 font-mono text-lg font-bold tracking-wider bg-[#F4F7FB] border border-[#DCE4EF] rounded-lg px-4 py-2.5 text-[#0D9488]">
                {user?.referral_code}
              </div>
              <button onClick={() => copyText(user?.referral_code || '', 'Referral code')} className={btnSecondary}>
                <Copy className="w-4 h-4" /> Copy Code
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#64748B]">Your Automatic Referral Link</label>
            <div className="mt-1.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                readOnly
                value={referralUrl}
                className="flex-1 font-mono text-xs bg-[#F8FAFC] border border-[#DCE4EF] rounded-lg px-3.5 py-2.5 text-[#0F172A]"
              />
              <button onClick={() => copyText(referralUrl, 'Referral link')} className={btnPrimary}>
                <Copy className="w-4 h-4" /> Copy Link
              </button>
              <button onClick={handleShare} className={btnGold}>
                <Share2 className="w-4 h-4" /> Share
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-[#DCE4EF]">
            <div>
              <div className="text-xs text-[#64748B]">Link Clicks</div>
              <div className="text-xl font-bold font-mono tabular-nums mt-0.5">{summary?.clicks_count ?? 0}</div>
            </div>
            <div>
              <div className="text-xs text-[#64748B]">Registrations</div>
              <div className="text-xl font-bold font-mono tabular-nums mt-0.5">{summary?.total_direct ?? 0}</div>
            </div>
            <div>
              <div className="text-xs text-[#64748B]">Conversion Rate</div>
              <div className="text-xl font-bold font-mono tabular-nums mt-0.5">{summary?.conversion_rate ?? 0}%</div>
            </div>
            <div>
              <div className="text-xs text-[#64748B]">Completed Orders</div>
              <div className="text-xl font-bold font-mono tabular-nums mt-0.5">{summary?.referral_orders ?? 0}</div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-[#DCE4EF] rounded-xl p-6 flex flex-col items-center justify-center text-center">
          <h2 className="text-sm font-bold text-[#0F172A]">Scannable Referral QR Code</h2>
          <p className="text-xs text-[#64748B] mt-1 mb-4">Scan with any phone camera to open your referral registration link.</p>
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="GO PAY BD Referral QR Code" className="w-48 h-48 border border-[#DCE4EF] rounded-xl p-2 bg-white" />
          ) : (
            <div className="w-48 h-48 bg-[#F4F7FB] rounded-xl animate-pulse" />
          )}
          {qrDataUrl && (
            <a
              href={qrDataUrl}
              download={`gopaybd-ref-${user?.referral_code}.png`}
              className="mt-4 text-xs font-semibold text-[#0D9488] hover:underline"
            >
              Download QR Code PNG
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export const EarningsPage: React.FC = () => {
  const [summary, setSummary] = useState<any>(null);
  const [commissions, setCommissions] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([api.userGet('/api/referrals/summary'), api.userGet('/api/referrals/earnings')]).then(([sRes, cRes]) => {
      setSummary(sRes.data);
      setCommissions(cRes.data || []);
    });
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Member Portal / Earnings"
        title="Earnings & Commission History"
        subtitle="Audit log of every Level 1 and Level 2 commission earned from eligible completed orders."
        actions={
          <Link to="/dashboard/withdraw" className={btnPrimary}>
            Withdraw Available Earnings
          </Link>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard accent="primary" label="Credited Commission Earnings" value={formatBDT(summary?.referral_earnings)} icon={<CheckCircle2 className="w-4 h-4" />} />
        <StatCard label="Pending / Awaiting Credit" value={formatBDT(summary?.pending_earnings)} icon={<TrendingUp className="w-4 h-4" />} />
        <StatCard label="Eligible Referral Orders" value={String(summary?.referral_orders ?? 0)} icon={<ShoppingBag className="w-4 h-4" />} />
      </div>

      <div className="bg-white border border-[#DCE4EF] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#DCE4EF]">
          <h2 className="text-sm font-bold text-[#0F172A]">Commission Ledger</h2>
        </div>
        {commissions.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No commissions earned yet"
              description="Invite members with your referral link. Eligible completed orders automatically calculate and record commissions here."
              action={<Link to="/dashboard/referral-link" className={btnPrimary}>Share Referral Link</Link>}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F8FAFC] text-xs text-[#64748B] border-b border-[#DCE4EF]">
                <tr>
                  <th className="text-left font-semibold px-5 py-3">Commission ID</th>
                  <th className="text-left font-semibold px-5 py-3">Order ID</th>
                  <th className="text-left font-semibold px-5 py-3">Level</th>
                  <th className="text-left font-semibold px-5 py-3">Rate</th>
                  <th className="text-right font-semibold px-5 py-3">Order Amount</th>
                  <th className="text-right font-semibold px-5 py-3">Commission</th>
                  <th className="text-left font-semibold px-5 py-3">Status</th>
                  <th className="text-left font-semibold px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE4EF]">
                {commissions.map((c) => (
                  <tr key={c.id} className="hover:bg-[#F8FAFC]">
                    <td className="px-5 py-3 font-mono text-xs">{c.commission_uid}</td>
                    <td className="px-5 py-3 font-mono text-xs">{c.order_number}</td>
                    <td className="px-5 py-3 text-xs">Level {c.referral_level}</td>
                    <td className="px-5 py-3 font-mono text-xs">{c.rate_value}{c.rate_type === 'percentage' ? '%' : ' BDT'}</td>
                    <td className="px-5 py-3 text-right font-mono text-xs tabular-nums">{formatBDT(c.order_amount)}</td>
                    <td className="px-5 py-3 text-right font-mono text-xs font-semibold text-[#059669] tabular-nums">{formatBDT(c.commission_amount)}</td>
                    <td className="px-5 py-3"><StatusText status={c.status} /></td>
                    <td className="px-5 py-3 text-xs text-[#64748B] whitespace-nowrap">{formatDateTime(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
