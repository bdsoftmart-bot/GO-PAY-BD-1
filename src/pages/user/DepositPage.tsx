import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Copy, ShieldAlert, Upload, ArrowDownCircle, Clock, ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { DEFAULT_SECURITY_DEPOSIT_1_BDT, DEFAULT_SECURITY_DEPOSIT_2_BDT } from '../../lib/constants';
import { formatBDT, formatDateTime } from '../../lib/format';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  PageHeader,
  StatusText,
  EmptyState,
  SkeletonRows,
  btnPrimary,
  inputCls,
  labelCls,
} from '../../components/ui/Primitives';

export const DepositPage: React.FC = () => {
  const { publicSettings } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const isSecurityDepositIntent = searchParams.get('purpose') === 'security_deposit';
  const presetAmount = searchParams.get('amount') || '';
  const tierParam = Number(searchParams.get('tier') || '1') || 1;
  const requiredParam = Number(searchParams.get('required') || '0');
  const tier1Bdt = Number(publicSettings.security_deposit_1_account || DEFAULT_SECURITY_DEPOSIT_1_BDT);
  const tier2Bdt = Number(publicSettings.security_deposit_2_accounts || DEFAULT_SECURITY_DEPOSIT_2_BDT);
  const effectiveSecurityDepositBdt =
    requiredParam > 0 ? requiredParam : tierParam === 2 ? tier2Bdt : tier1Bdt;

  const [config, setConfig] = useState<any>(null);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [allDeposits, setAllDeposits] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [amount, setAmount] = useState(presetAmount);
  const [senderNumber, setSenderNumber] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [note, setNote] = useState(isSecurityDepositIntent ? 'Security Deposit (জামানত) for Wallet Linking' : '');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (presetAmount) setAmount(presetAmount);
    if (isSecurityDepositIntent && !note) {
      setNote('Security Deposit (জামানত) for Wallet Linking');
    }
  }, [presetAmount, isSecurityDepositIntent]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, dRes] = await Promise.all([
        api.userGet('/api/deposit-methods'),
        api.userGet('/api/deposits'),
      ]);
      setConfig(mRes.data);
      const list = mRes.data?.methods || [];
      if (list.length > 0 && !selectedMethodId) {
        setSelectedMethodId(String(list[0].id));
      }
      setAllDeposits(dRes.data || []);
    } finally {
      setLoading(false);
    }
  }, [selectedMethodId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const deposits = useMemo(
    () => (statusFilter === 'all' ? allDeposits : allDeposits.filter((d) => d.status === statusFilter)),
    [allDeposits, statusFilter]
  );

  const processingDeposits = useMemo(
    () => allDeposits.filter((d) => d.status === 'processing'),
    [allDeposits]
  );

  const activeMethod = (config?.methods || []).find((m: any) => m.id === selectedMethodId) || config?.methods?.[0];

  const handleCopy = (val: string) => {
    navigator.clipboard.writeText(val);
    toast('Receiving number copied to clipboard.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMethod) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('payment_setting_id', String(activeMethod.id));
      fd.append('amount', amount);
      fd.append('sender_number', senderNumber);
      fd.append('transaction_id', transactionId.trim().toUpperCase());
      fd.append('note', note);
      if (file) fd.append('screenshot', file);

      const res = await api.userPost('/api/deposits', fd);
      toast(res.message);
      setAmount('');
      setSenderNumber('');
      setTransactionId('');
      setNote('');
      setFile(null);
      loadData();
    } catch (err: any) {
      toast(err.message || 'Deposit submission failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-7">
      <PageHeader
        breadcrumb="Member Portal / Deposit"
        title="Deposit Funds (BDT)"
        subtitle="Transfer manually from your bKash or Nagad app to our active receiving number, then submit your Transaction ID for verification."
      />

      {isSecurityDepositIntent && (
        <div className="rounded-xl border border-[#0D9488]/30 bg-[#F0FDFA] p-4 sm:p-5 flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0D9488] text-white">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-1 text-xs sm:text-sm">
            <div className="font-bold text-[#0F172A]">
              জামানত ডিপোজিট ({tierParam === 1 ? '১ম অ্যাকাউন্ট' : tierParam === 2 ? '২য় অ্যাকাউন্ট' : `${tierParam} নং অ্যাকাউন্ট`} · Minimum {formatBDT(effectiveSecurityDepositBdt)} Security Deposit)
            </div>
            <p className="text-[#334155] leading-relaxed">
              আপনার bKash, Nagad, Rocket, Upay, CellFin বা Bank ওয়ালেট কানেক্ট করার জন্য সর্বনিম্ন{' '}
              <strong className="text-[#0F766E]">{formatBDT(effectiveSecurityDepositBdt)}</strong> জামানত ডিপোজিট সম্পন্ন করুন। ডিপোজিট অ্যাপ্রুভ হওয়ার সাথে সাথেই ওয়ালেট লিংক অপশন আনলক হয়ে যাবে।
            </p>
          </div>
        </div>
      )}

      {processingDeposits.length > 0 && (
        <div className="rounded-xl border border-[#F59E0B]/40 bg-[#FFFBEB] p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-[#92400E]">
            <Clock className="w-4 h-4 text-[#D97706] shrink-0" />
            <span>আপনার ডিপোজিট ট্রানজ্যাকশন প্রক্রিয়াধীন রয়েছে (Transaction In Processing)</span>
          </div>
          <div className="space-y-2.5">
            {processingDeposits.map((pd) => (
              <div
                key={pd.id}
                className="rounded-lg border border-[#FDE68A] bg-white px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono font-bold text-[#0F172A]">{pd.deposit_uid}</span>
                    <span className="font-mono font-bold text-[#0D9488]">{formatBDT(pd.amount)}</span>
                    <span className="text-[#64748B]">via {pd.payment_method}</span>
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-[#78350F] leading-relaxed">
                    {pd.admin_note ||
                      'আপনার ট্রানজ্যাকশনটি প্রক্রিয়াধীন রয়েছে — আগামী ১২ থেকে ২৪ ঘণ্টার মধ্যে সম্পন্ন করা হবে।'}
                  </p>
                </div>
                <div className="shrink-0 text-xs font-semibold text-[#B45309] bg-[#FEF3C7] border border-[#FDE68A] rounded-md px-3 py-1.5 self-start sm:self-center">
                  {pd.processing_eta || 'Within 12–24 Hours'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Method Selection & Dynamic Receiving Account */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white border border-[#DCE4EF] rounded-xl p-6">
            <h2 className="text-sm font-bold text-[#0F172A] mb-3">1. Select Payment Method</h2>
            {!config?.deposit_enabled ? (
              <p className="text-xs text-[#DC2626]">Deposits are currently paused by platform administration.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {(config?.methods || []).map((m: any) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMethodId(String(m.id))}
                    className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
                      activeMethod?.id === m.id
                        ? 'bg-[#0F172A] border-[#0D9488] text-[#F8FAFC]'
                        : 'bg-[#F8FAFC] border-[#DCE4EF] text-[#0F172A] hover:border-[#0D9488]'
                    }`}
                  >
                    <div className="text-sm font-bold">{m.method_name}</div>
                    <div className={`text-[11px] mt-0.5 ${activeMethod?.id === m.id ? 'text-[#2DD4BF]' : 'text-[#64748B]'}`}>
                      {m.account_type}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {activeMethod && (
              <div className="mt-5 pt-5 border-t border-[#DCE4EF] space-y-3">
                <div className="text-xs text-[#64748B]">Send Money To ({activeMethod.method_name})</div>
                <div className="flex items-center justify-between gap-3 bg-[#F4F7FB] border border-[#DCE4EF] rounded-lg px-4 py-3">
                  <div>
                    <div className="font-mono text-lg font-bold text-[#0F172A] tabular-nums">
                      {activeMethod.receiving_number}
                    </div>
                    <div className="text-xs text-[#64748B]">
                      {activeMethod.account_holder_name} · {activeMethod.account_type}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(activeMethod.receiving_number)}
                    className="p-2 rounded-md bg-white border border-[#DCE4EF] text-[#0D9488] hover:bg-[#EDF2F7] cursor-pointer"
                    title="Copy number"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                  <div>
                    <span className="text-[#64748B]">Minimum Deposit</span>
                    <div className="font-mono font-semibold text-[#0F172A] tabular-nums">
                      {formatBDT(Math.max(activeMethod.min_deposit, config?.global_min_deposit || 0))}
                    </div>
                  </div>
                  <div>
                    <span className="text-[#64748B]">Maximum Deposit</span>
                    <div className="font-mono font-semibold text-[#0F172A] tabular-nums">
                      {formatBDT(Math.min(activeMethod.max_deposit, config?.global_max_deposit || 9999999))}
                    </div>
                  </div>
                </div>

                {activeMethod.instructions && (
                  <p className="text-xs text-[#64748B] leading-relaxed pt-2 border-t border-[#DCE4EF]">
                    {activeMethod.instructions}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="bg-[#F8FAFC] border border-[#DCE4EF] rounded-xl p-5 flex items-start gap-3">
            <ShieldAlert className="w-4 h-4 text-[#D97706] mt-0.5 shrink-0" />
            <div className="text-xs text-[#64748B] leading-relaxed">
              <strong className="text-[#0F172A]">Security Notice:</strong> Never share your bKash/Nagad PIN, password, or OTP anywhere. Wallets are credited strictly after admin verification of your unique Transaction ID.
            </div>
          </div>
        </div>

        {/* Right: Deposit Request Form */}
        <div className="lg:col-span-7 bg-white border border-[#DCE4EF] rounded-xl p-6">
          <h2 className="text-sm font-bold text-[#0F172A] mb-4">2. Submit Payment Verification Proof</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Deposit Amount (BDT ৳)</label>
              <input
                type="number"
                step="0.01"
                min="1"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g., 1000.00"
                className={`${inputCls} font-mono`}
              />
            </div>

            <div>
              <label className={labelCls}>Payment Sender Number</label>
              <input
                type="tel"
                required
                value={senderNumber}
                onChange={(e) => setSenderNumber(e.target.value)}
                placeholder="01XXXXXXXXX"
                className={`${inputCls} font-mono`}
              />
            </div>

            <div className="sm:col-span-2">
              <label className={labelCls}>Unique Transaction ID (TrxID)</label>
              <input
                type="text"
                required
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value.toUpperCase())}
                placeholder="e.g., BKH8923KL91"
                className={`${inputCls} font-mono uppercase`}
              />
            </div>

            <div className="sm:col-span-2">
              <label className={labelCls}>Payment Receipt Screenshot (Optional — JPG/PNG/WEBP, max 5MB)</label>
              <label className="flex items-center gap-3 px-4 py-3 border border-dashed border-[#CBD5E1] rounded-lg bg-[#F8FAFC] cursor-pointer hover:border-[#0D9488]">
                <Upload className="w-4 h-4 text-[#0D9488]" />
                <span className="text-xs text-[#64748B] truncate">
                  {file ? `${file.name} (${(file.size / 1024).toFixed(0)} KB)` : 'Choose screenshot file...'}
                </span>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </div>

            <div className="sm:col-span-2">
              <label className={labelCls}>Optional Note</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Any reference note for the finance verifier"
                className={inputCls}
              />
            </div>

            <div className="sm:col-span-2 pt-2">
              <button
                type="submit"
                disabled={submitting || !config?.deposit_enabled || !activeMethod}
                className={`${btnPrimary} w-full sm:w-auto`}
              >
                <ArrowDownCircle className="w-4 h-4" />
                {submitting ? 'Submitting Request...' : 'Submit Deposit Request'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Deposit History */}
      <div className="bg-white border border-[#DCE4EF] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#DCE4EF] flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-[#0F172A]">Deposit History</h2>
          <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F4F7FB] rounded-lg">
            {['all', 'pending', 'processing', 'approved', 'rejected'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 text-xs font-semibold rounded-md capitalize cursor-pointer ${
                  statusFilter === st ? 'bg-white text-[#0F172A]' : 'text-[#64748B]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <SkeletonRows rows={4} cols={6} />
        ) : deposits.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No deposit requests found"
              description="Submit a deposit request above to fund your GO PAY BD wallet."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F8FAFC] text-xs text-[#64748B] border-b border-[#DCE4EF]">
                <tr>
                  <th className="text-left font-semibold px-5 py-3">Deposit ID</th>
                  <th className="text-right font-semibold px-5 py-3">Amount</th>
                  <th className="text-left font-semibold px-5 py-3">Method</th>
                  <th className="text-left font-semibold px-5 py-3">Sender Number</th>
                  <th className="text-left font-semibold px-5 py-3">Transaction ID</th>
                  <th className="text-left font-semibold px-5 py-3">Status</th>
                  <th className="text-left font-semibold px-5 py-3">Admin Note</th>
                  <th className="text-left font-semibold px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE4EF]">
                {deposits.map((d) => (
                  <tr key={d.id} className="hover:bg-[#F8FAFC]">
                    <td className="px-5 py-3 font-mono text-xs">{d.deposit_uid}</td>
                    <td className="px-5 py-3 text-right font-mono text-xs font-semibold tabular-nums">{formatBDT(d.amount)}</td>
                    <td className="px-5 py-3 text-xs">{d.payment_method}</td>
                    <td className="px-5 py-3 font-mono text-xs">{d.sender_number}</td>
                    <td className="px-5 py-3 font-mono text-xs">{d.transaction_id}</td>
                    <td className="px-5 py-3"><StatusText status={d.status} /></td>
                    <td className="px-5 py-3 text-xs text-[#475569] max-w-[280px] whitespace-normal leading-relaxed">
                      {d.status === 'processing' && d.processing_eta && (
                        <div className="font-semibold text-[#B45309] mb-0.5">{d.processing_eta}</div>
                      )}
                      <div>{d.rejection_reason || d.admin_note || '—'}</div>
                    </td>
                    <td className="px-5 py-3 text-xs text-[#64748B] whitespace-nowrap">{formatDateTime(d.created_at)}</td>
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
