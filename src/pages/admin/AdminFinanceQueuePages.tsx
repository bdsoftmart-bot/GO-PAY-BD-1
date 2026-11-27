import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, CheckCircle2, XCircle, Eye, Banknote, Clock } from 'lucide-react';
import { api, getAdminToken } from '../../lib/api';
import { formatBDT, formatDateTime } from '../../lib/format';
import { useToast } from '../../contexts/ToastContext';
import {
  PageHeader,
  StatusText,
  EmptyState,
  SkeletonRows,
  PaginationBar,
  Modal,
  btnPrimary,
  btnSecondary,
  btnDanger,
  btnGold,
  inputCls,
  labelCls,
} from '../../components/ui/Primitives';

export const AdminDepositsPage: React.FC = () => {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', status: 'all', payment_method: 'all', date_from: '', page: 1 });

  const [activeDeposit, setActiveDeposit] = useState<any>(null);
  const [adminNote, setAdminNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [etaWindow, setEtaWindow] = useState<'12' | '24' | '12-24'>('12-24');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v && v !== 'all') params.set(k, String(v));
    });
    try {
      const res = await api.adminGet(`/api/admin/deposits?${params.toString()}`);
      setItems(res.data?.items || []);
      setPagination(res.data?.pagination || { page: 1, total_pages: 1, total: 0 });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async () => {
    if (!activeDeposit) return;
    setBusy(true);
    try {
      const res = await api.adminPost(`/api/admin/deposits/${activeDeposit.id}/approve`, { admin_note: adminNote });
      toast(res.message);
      setActiveDeposit(null);
      setAdminNote('');
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleMarkProcessing = async () => {
    if (!activeDeposit) return;
    setBusy(true);
    try {
      const res = await api.adminPost(`/api/admin/deposits/${activeDeposit.id}/processing`, {
        eta_hours: etaWindow,
        admin_note: adminNote,
      });
      toast(res.message);
      setActiveDeposit(null);
      setAdminNote('');
      setRejectReason('');
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!activeDeposit) return;
    if (rejectReason.trim().length < 3) {
      toast('Please enter a rejection reason.', 'error');
      return;
    }
    setBusy(true);
    try {
      const res = await api.adminPost(`/api/admin/deposits/${activeDeposit.id}/reject`, {
        reason: rejectReason,
        admin_note: adminNote,
      });
      toast(res.message);
      setActiveDeposit(null);
      setRejectReason('');
      setAdminNote('');
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const adminTok = getAdminToken();

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Admin Panel / Deposits"
        title="Deposit Verification Management"
        subtitle="Verify bKash & Nagad Transaction IDs and credit member BDT wallets atomically."
      />

      <div className="bg-white border border-[#DCE4EF] rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-2 relative">
          <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
            placeholder="TrxID, sender number, Deposit ID, or username..."
            className={`${inputCls} pl-9`}
          />
        </div>
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })} className={inputCls}>
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing (12–24h)</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select value={filters.payment_method} onChange={(e) => setFilters({ ...filters, payment_method: e.target.value, page: 1 })} className={inputCls}>
          <option value="all">All Methods</option>
          <option value="bKash">bKash</option>
          <option value="Nagad">Nagad</option>
        </select>
        <input type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value, page: 1 })} className={inputCls} />
      </div>

      {loading ? (
        <SkeletonRows rows={6} cols={8} />
      ) : items.length === 0 ? (
        <EmptyState title="No deposit requests found" description="Member deposit submissions will appear here for finance review." />
      ) : (
        <div className="bg-white border border-[#DCE4EF] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F8FAFC] text-xs text-[#64748B] border-b border-[#DCE4EF]">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">Deposit ID</th>
                  <th className="text-left font-semibold px-4 py-3">User</th>
                  <th className="text-right font-semibold px-4 py-3">Amount</th>
                  <th className="text-left font-semibold px-4 py-3">Method & Receiver</th>
                  <th className="text-left font-semibold px-4 py-3">Sender Number</th>
                  <th className="text-left font-semibold px-4 py-3">Transaction ID</th>
                  <th className="text-left font-semibold px-4 py-3">Status</th>
                  <th className="text-left font-semibold px-4 py-3">Submitted</th>
                  <th className="text-right font-semibold px-4 py-3">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE4EF]">
                {items.map((d) => (
                  <tr key={d.id} className="hover:bg-[#F8FAFC]">
                    <td className="px-4 py-3 font-mono text-xs">{d.deposit_uid}</td>
                    <td className="px-4 py-3 text-xs">
                      <Link to={`/admin/users/${d.user_id}`} className="font-semibold text-[#0D9488] hover:underline">
                        {d.user_name}
                      </Link>
                      <div className="text-[11px] text-[#64748B]">@{d.username} · {d.user_uid}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-bold tabular-nums">{formatBDT(d.amount)}</td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-semibold">{d.payment_method}</div>
                      <div className="font-mono text-[11px] text-[#64748B]">{d.receiving_number}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{d.sender_number}</td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold">{d.transaction_id}</td>
                    <td className="px-4 py-3"><StatusText status={d.status} /></td>
                    <td className="px-4 py-3 text-xs text-[#64748B] whitespace-nowrap">{formatDateTime(d.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          setActiveDeposit(d);
                          setAdminNote(d.admin_note || '');
                          setRejectReason(d.rejection_reason || '');
                          setEtaWindow(
                            String(d.processing_eta || '').includes('Within 12 Hours')
                              ? '12'
                              : String(d.processing_eta || '').includes('Within 24 Hours')
                              ? '24'
                              : '12-24'
                          );
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#0D9488] hover:underline cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> Inspect
                      </button>
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

      <Modal
        open={Boolean(activeDeposit)}
        onClose={() => setActiveDeposit(null)}
        title={`Deposit Review · ${activeDeposit?.deposit_uid || ''}`}
        subtitle={`Submitted by ${activeDeposit?.user_name || ''} (@${activeDeposit?.username || ''})`}
        maxWidth="max-w-xl"
      >
        {activeDeposit && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-[#F8FAFC] border border-[#DCE4EF] rounded-lg p-4">
              <div><span className="text-[#64748B]">Amount</span><div className="font-mono text-base font-bold text-[#0D9488]">{formatBDT(activeDeposit.amount)}</div></div>
              <div><span className="text-[#64748B]">Status</span><div className="mt-1"><StatusText status={activeDeposit.status} /></div></div>
              <div><span className="text-[#64748B]">Payment Method</span><div className="font-semibold">{activeDeposit.payment_method}</div></div>
              <div><span className="text-[#64748B]">Receiving Number</span><div className="font-mono">{activeDeposit.receiving_number}</div></div>
              <div><span className="text-[#64748B]">Sender Number</span><div className="font-mono font-semibold">{activeDeposit.sender_number}</div></div>
              <div><span className="text-[#64748B]">Transaction ID</span><div className="font-mono font-bold text-[#0F172A]">{activeDeposit.transaction_id}</div></div>
            </div>

            {activeDeposit.user_note && (
              <div>
                <span className="font-semibold text-[#64748B]">User Note:</span>
                <p className="mt-1 text-[#0F172A]">{activeDeposit.user_note}</p>
              </div>
            )}

            {activeDeposit.screenshot_path && (
              <div>
                <div className="font-semibold text-[#64748B] mb-1.5">Payment Screenshot</div>
                <img
                  src={`${activeDeposit.screenshot_path}${adminTok ? `?token=${encodeURIComponent(adminTok)}` : ''}`}
                  alt="Deposit payment receipt"
                  className="max-h-64 rounded-lg border border-[#DCE4EF] object-contain bg-[#F8FAFC]"
                />
              </div>
            )}

            {['pending', 'processing'].includes(activeDeposit.status) ? (
              <div className="space-y-3 pt-3 border-t border-[#DCE4EF]">
                {activeDeposit.status === 'processing' && (
                  <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3.5 py-2.5 text-xs text-[#92400E]">
                    <div className="flex items-center gap-1.5 font-bold">
                      <Clock className="w-3.5 h-3.5 text-[#D97706]" />
                      Processing Notice Active · {activeDeposit.processing_eta || 'Within 12–24 Hours'}
                    </div>
                    {activeDeposit.admin_note && (
                      <p className="mt-1 text-[#78350F] leading-relaxed">{activeDeposit.admin_note}</p>
                    )}
                  </div>
                )}

                <div className="rounded-lg border border-[#DCE4EF] bg-[#F8FAFC] p-3 space-y-2">
                  <label className={labelCls}>Processing Completion Timeframe (ইউজারকে সময়সূচি দেখান)</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: '12' as const, label: '12 Hours (১২ ঘণ্টা)' },
                      { id: '24' as const, label: '24 Hours (২৪ ঘণ্টা)' },
                      { id: '12-24' as const, label: '12–24 Hours (১২–২৪ ঘণ্টা)' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setEtaWindow(opt.id)}
                        className={`px-2.5 py-2 rounded-md border text-[11px] font-semibold transition cursor-pointer ${
                          etaWindow === opt.id
                            ? 'bg-[#0F172A] border-[#0F172A] text-white'
                            : 'bg-white border-[#DCE4EF] text-[#334155] hover:border-[#0D9488]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Admin Note (Optional — shown to user)</label>
                  <input
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder="Leave blank to send default 12–24h Bangla/English notice, or write custom note..."
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Rejection Reason (Required only if rejecting)</label>
                  <input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="e.g., TrxID not found in bKash statement" className={inputCls} />
                </div>
                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <button disabled={busy} onClick={handleReject} className={btnDanger}>
                    <XCircle className="w-4 h-4" /> Reject Deposit
                  </button>
                  <button disabled={busy} onClick={handleMarkProcessing} className={btnGold}>
                    <Clock className="w-4 h-4" /> {etaWindow}h Processing Notice
                  </button>
                  <button disabled={busy} onClick={handleApprove} className={btnPrimary}>
                    <CheckCircle2 className="w-4 h-4" /> Approve & Credit Wallet
                  </button>
                </div>
              </div>
            ) : (
              <div className="pt-3 border-t border-[#DCE4EF] text-[#64748B]">
                Processed on {formatDateTime(activeDeposit.processed_at)} {activeDeposit.processed_by_name ? `by ${activeDeposit.processed_by_name}` : ''}.
                {activeDeposit.admin_note && <div className="text-[#0F172A] mt-1">Note: {activeDeposit.admin_note}</div>}
                {activeDeposit.rejection_reason && <div className="text-[#DC2626] mt-1">Reason: {activeDeposit.rejection_reason}</div>}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export const AdminWithdrawalsPage: React.FC = () => {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', status: 'all', payment_method: 'all', page: 1 });

  const [active, setActive] = useState<any>(null);
  const [payoutTxId, setPayoutTxId] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [adminNote, setAdminNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v && v !== 'all') params.set(k, String(v));
    });
    try {
      const res = await api.adminGet(`/api/admin/withdrawals?${params.toString()}`);
      setItems(res.data?.items || []);
      setPagination(res.data?.pagination || { page: 1, total_pages: 1, total: 0 });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatusStep = async (status: 'processing' | 'approved') => {
    if (!active) return;
    setBusy(true);
    try {
      const res = await api.adminPost(`/api/admin/withdrawals/${active.id}/approve`, { status, admin_note: adminNote });
      toast(res.message);
      setActive(null);
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleMarkPaid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active) return;
    setBusy(true);
    try {
      const res = await api.adminPost(`/api/admin/withdrawals/${active.id}/paid`, {
        payout_tx_id: payoutTxId,
        paid_amount: paidAmount || active.net_amount,
        payment_date: paymentDate,
        admin_note: adminNote,
      });
      toast(res.message);
      setActive(null);
      setPayoutTxId('');
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!active) return;
    if (rejectReason.trim().length < 3) return toast('Enter a rejection reason.', 'error');
    setBusy(true);
    try {
      const res = await api.adminPost(`/api/admin/withdrawals/${active.id}/reject`, { reason: rejectReason });
      toast(res.message);
      setActive(null);
      setRejectReason('');
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Admin Panel / Withdrawals"
        title="Withdrawal Payout Management"
        subtitle="Review reserved balances, approve requests, record manual bKash/Nagad payout references, or reject safely."
      />

      <div className="bg-white border border-[#DCE4EF] rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="lg:col-span-2 relative">
          <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
            placeholder="Withdrawal ID, account number, payout ref, username..."
            className={`${inputCls} pl-9`}
          />
        </div>
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })} className={inputCls}>
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="approved">Approved</option>
          <option value="paid">Paid</option>
          <option value="rejected">Rejected</option>
        </select>
        <select value={filters.payment_method} onChange={(e) => setFilters({ ...filters, payment_method: e.target.value, page: 1 })} className={inputCls}>
          <option value="all">All Methods</option>
          <option value="bKash">bKash</option>
          <option value="Nagad">Nagad</option>
        </select>
      </div>

      {loading ? (
        <SkeletonRows rows={6} cols={8} />
      ) : items.length === 0 ? (
        <EmptyState title="No withdrawal requests" description="Member withdrawal requests will appear here once submitted." />
      ) : (
        <div className="bg-white border border-[#DCE4EF] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F8FAFC] text-xs text-[#64748B] border-b border-[#DCE4EF]">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">Withdrawal ID</th>
                  <th className="text-left font-semibold px-4 py-3">User</th>
                  <th className="text-right font-semibold px-4 py-3">Requested</th>
                  <th className="text-right font-semibold px-4 py-3">Fee</th>
                  <th className="text-right font-semibold px-4 py-3">Net Payout</th>
                  <th className="text-left font-semibold px-4 py-3">Method & Account</th>
                  <th className="text-left font-semibold px-4 py-3">Status</th>
                  <th className="text-left font-semibold px-4 py-3">Date</th>
                  <th className="text-right font-semibold px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE4EF]">
                {items.map((w) => (
                  <tr key={w.id} className="hover:bg-[#F8FAFC]">
                    <td className="px-4 py-3 font-mono text-xs">{w.withdrawal_uid}</td>
                    <td className="px-4 py-3 text-xs">
                      <Link to={`/admin/users/${w.user_id}`} className="font-semibold text-[#0D9488] hover:underline">{w.user_name}</Link>
                      <div className="text-[11px] text-[#64748B]">@{w.username}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">{formatBDT(w.amount)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-[#64748B] tabular-nums">{formatBDT(w.fee)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-bold text-[#0D9488] tabular-nums">{formatBDT(w.net_amount)}</td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-semibold">{w.payment_method} · {w.account_number}</div>
                      <div className="text-[11px] text-[#64748B]">{w.account_holder_name}</div>
                    </td>
                    <td className="px-4 py-3"><StatusText status={w.status} /></td>
                    <td className="px-4 py-3 text-xs text-[#64748B] whitespace-nowrap">{formatDateTime(w.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          setActive(w);
                          setPaidAmount(String(w.net_amount));
                          setPayoutTxId(w.payout_tx_id || '');
                          setAdminNote(w.admin_note || '');
                        }}
                        className="text-xs font-semibold text-[#0D9488] hover:underline cursor-pointer"
                      >
                        Manage
                      </button>
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

      <Modal
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title={`Withdrawal ${active?.withdrawal_uid || ''}`}
        subtitle={`${active?.payment_method || ''} · ${active?.account_number || ''} (${active?.account_holder_name || ''})`}
        maxWidth="max-w-xl"
      >
        {active && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-3 bg-[#F8FAFC] border border-[#DCE4EF] rounded-lg p-4">
              <div><span className="text-[#64748B]">Requested</span><div className="font-mono font-bold text-sm">{formatBDT(active.amount)}</div></div>
              <div><span className="text-[#64748B]">Fee</span><div className="font-mono font-semibold text-sm">{formatBDT(active.fee)}</div></div>
              <div><span className="text-[#64748B]">Net To Send</span><div className="font-mono font-bold text-sm text-[#059669]">{formatBDT(active.net_amount)}</div></div>
            </div>

            {['pending', 'processing', 'approved'].includes(active.status) ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {active.status === 'pending' && (
                    <button disabled={busy} onClick={() => handleStatusStep('processing')} className={btnSecondary}>
                      Mark Processing
                    </button>
                  )}
                  {active.status !== 'approved' && (
                    <button disabled={busy} onClick={() => handleStatusStep('approved')} className={btnGold}>
                      Approve for Payout
                    </button>
                  )}
                </div>

                <form onSubmit={handleMarkPaid} className="space-y-3 pt-3 border-t border-[#DCE4EF]">
                  <div className="font-bold text-[#0F172A]">Finalize & Mark Paid (After Sending Externally)</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Paid Amount (BDT)</label>
                      <input type="number" step="0.01" required value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} className={`${inputCls} font-mono`} />
                    </div>
                    <div>
                      <label className={labelCls}>Payment Date</label>
                      <input type="date" required value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Payment Transaction Reference ID (Required)</label>
                    <input required value={payoutTxId} onChange={(e) => setPayoutTxId(e.target.value.toUpperCase())} placeholder="e.g., BKH-OUT-98312A" className={`${inputCls} font-mono uppercase`} />
                  </div>
                  <div>
                    <label className={labelCls}>Admin Note</label>
                    <input value={adminNote} onChange={(e) => setAdminNote(e.target.value)} className={inputCls} />
                  </div>
                  <button type="submit" disabled={busy} className={btnPrimary}>
                    <Banknote className="w-4 h-4" /> Mark Paid & Finalize Ledger
                  </button>
                </form>

                <div className="pt-3 border-t border-[#DCE4EF] space-y-2">
                  <label className={labelCls}>Reject & Return Reserved Funds</label>
                  <div className="flex gap-2">
                    <input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Rejection reason..." className={inputCls} />
                    <button type="button" disabled={busy} onClick={handleReject} className={btnDanger}>Reject</button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-[#64748B]">
                Status: <StatusText status={active.status} />
                {active.payout_tx_id && <div className="mt-1 font-mono text-[#0F172A]">Payout Reference: {active.payout_tx_id}</div>}
                {active.rejection_reason && <div className="mt-1 text-[#DC2626]">Rejection Reason: {active.rejection_reason}</div>}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
