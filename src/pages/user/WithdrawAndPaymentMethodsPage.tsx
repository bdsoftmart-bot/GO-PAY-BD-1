import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowUpFromLine,
  Building2,
  Edit3,
  Lock,
  Plus,
  ShieldCheck,
  Star,
  Trash2,
  Wallet,
  XCircle,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  AlertBanner,
  Badge,
  Card,
  EmptyState,
  PageHeader,
  formatBDT,
  formatDateTime,
  inputCls,
  labelCls,
} from '../../components/ui/Primitives';
import { LinkWalletModal, getProviderMeta } from '../../components/LinkWalletModal';

export const WithdrawPage: React.FC = () => {
  const { user } = useAuth();
  const [rules, setRules] = useState<any>(null);
  const [savedMethods, setSavedMethods] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [selectedSavedId, setSelectedSavedId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState('bKash');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = async () => {
    try {
      const [rRes, pmRes, wRes] = await Promise.all([
        api.userGet('/api/withdrawal-rules'),
        api.userGet('/api/payment-methods'),
        api.userGet('/api/withdrawals'),
      ]);
      setRules(rRes.data);
      const list = pmRes.data || [];
      setSavedMethods(list);
      setWithdrawals(wRes.data || []);
      const def = list.find((m: any) => m.is_default) || list[0];
      if (def) {
        setSelectedSavedId(String(def.id));
        setPaymentMethod(def.method_name);
        setAccountNumber(def.account_number);
        setAccountHolderName(def.account_holder_name);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Unable to load withdrawal settings.' });
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSelectSaved = (id: string) => {
    setSelectedSavedId(id);
    const found = savedMethods.find((m) => String(m.id) === id);
    if (found) {
      setPaymentMethod(found.method_name);
      setAccountNumber(found.account_number);
      setAccountHolderName(found.account_holder_name);
    }
  };

  const numAmount = parseFloat(amount) || 0;
  const fee = rules
    ? rules.withdrawal_fee_type === 'fixed'
      ? Number(rules.withdrawal_fee || 0)
      : Number(((numAmount * Number(rules.withdrawal_fee || 0)) / 100).toFixed(2))
    : 0;
  const netReceivable = Math.max(0, Number((numAmount - fee).toFixed(2)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);
    try {
      const res = await api.userPost('/api/withdrawals', {
        amount: numAmount,
        payment_method_id: selectedSavedId || null,
        payment_method: paymentMethod,
        account_number: accountNumber,
        account_holder_name: accountHolderName,
        note,
      });
      setMessage({ type: 'success', text: res.message || 'Withdrawal request submitted!' });
      setAmount('');
      setNote('');
      await load();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      const res = await api.userPost(`/api/withdrawals/${id}/cancel`);
      setMessage({ type: 'success', text: res.message });
      await load();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div>
      <PageHeader
        title="Withdraw Funds"
        subtitle="Request a BDT payout to your verified bKash, Nagad, Rocket, Upay, CellFin, or Bank account."
        actions={
          <button
            type="button"
            onClick={() => setLinkModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F172A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1E293B]"
          >
            <Plus className="h-4 w-4" /> Link & Verify Wallet
          </button>
        }
      />

      {message && (
        <div className="mb-5">
          <AlertBanner type={message.type} message={message.text} onClose={() => setMessage(null)} />
        </div>
      )}

      {rules && !rules.withdrawal_enabled && (
        <div className="mb-5">
          <AlertBanner type="warning" message="Withdrawals are temporarily paused by administration." />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-5">
          <div className="rounded-2xl bg-gradient-to-br from-[#0F172A] to-[#133C4B] p-6 text-white shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#94A3B8]">
              Available to Withdraw
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums">
              {formatBDT(rules?.wallet?.available_balance)}
            </p>
            <p className="mt-2 text-xs text-[#CBD5E1]">
              Currently Reserved in Pending Withdrawals:{' '}
              <span className="font-semibold text-[#5EEAD4] tabular-nums">
                {formatBDT(rules?.wallet?.pending_withdrawal)}
              </span>
            </p>
          </div>

          <Card title="Withdrawal Policy & Limits">
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between border-b border-[#EDF2F7] pb-2">
                <span className="text-[#64748B]">Minimum Withdrawal</span>
                <span className="font-semibold text-[#0F172A] tabular-nums">
                  {formatBDT(rules?.min_withdrawal)}
                </span>
              </div>
              <div className="flex justify-between border-b border-[#EDF2F7] pb-2">
                <span className="text-[#64748B]">Maximum Per Request</span>
                <span className="font-semibold text-[#0F172A] tabular-nums">
                  {formatBDT(rules?.max_withdrawal)}
                </span>
              </div>
              <div className="flex justify-between border-b border-[#EDF2F7] pb-2">
                <span className="text-[#64748B]">Processing Fee</span>
                <span className="font-semibold text-[#0F172A]">
                  {rules?.withdrawal_fee_type === 'fixed'
                    ? formatBDT(rules?.withdrawal_fee)
                    : `${rules?.withdrawal_fee || 0}%`}
                </span>
              </div>
              <div className="flex justify-between border-b border-[#EDF2F7] pb-2">
                <span className="text-[#64748B]">Daily / Weekly Limit</span>
                <span className="font-semibold text-[#0F172A] tabular-nums">
                  {formatBDT(rules?.daily_limit)} / {formatBDT(rules?.weekly_limit)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Estimated Payout SLA</span>
                <span className="font-semibold text-[#0D9488]">{rules?.processing_time}</span>
              </div>
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-[#F0F9FF] p-3 text-xs text-[#0369A1]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#0284C7]" />
              <span>
                Requested funds are immediately reserved from your available balance. If you cancel a pending
                withdrawal or if it is rejected, funds are automatically restored to your wallet.
              </span>
            </div>
          </Card>
        </div>

        <Card title="Request Payout" subtitle="Select a verified active wallet or enter destination details" className="lg:col-span-7">
          <form onSubmit={handleSubmit} className="space-y-4">
            {savedMethods.length > 0 ? (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wide text-[#475569]">
                    Select Active Linked Wallet
                  </label>
                  <button
                    type="button"
                    onClick={() => setLinkModalOpen(true)}
                    className="text-xs font-semibold text-[#0D9488] hover:underline"
                  >
                    + Link Another Wallet
                  </button>
                </div>
                <select
                  value={selectedSavedId}
                  onChange={(e) => handleSelectSaved(e.target.value)}
                  className={inputCls}
                >
                  <option value="">— Enter Destination Manually —</option>
                  {savedMethods.map((m) => (
                    <option key={m.id} value={String(m.id)}>
                      {m.method_name} — {m.account_number} ({m.account_holder_name}){' '}
                      {m.is_default ? '[Default • Active]' : '[Active]'}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#BAE6FD] bg-[#F0F9FF] px-3.5 py-2.5 text-xs text-[#0369A1]">
                <span>No verified wallet linked yet. Link your bKash/Nagad/Rocket wallet for faster payouts.</span>
                <button
                  type="button"
                  onClick={() => setLinkModalOpen(true)}
                  className="font-bold text-[#0D9488] hover:underline"
                >
                  Link Now →
                </button>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Payout Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => {
                    setPaymentMethod(e.target.value);
                    setSelectedSavedId('');
                  }}
                  className={inputCls}
                >
                  {(rules?.supported_methods || ['bKash', 'Nagad', 'Rocket', 'Upay', 'CellFin', 'Bank']).map(
                    (m: string) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    )
                  )}
                </select>
              </div>
              <div>
                <label className={labelCls}>
                  {paymentMethod.toLowerCase().includes('bank') ? 'Bank Account Number' : 'Account Number'}
                </label>
                <input
                  type="text"
                  required
                  value={accountNumber}
                  onChange={(e) => {
                    setAccountNumber(e.target.value);
                    setSelectedSavedId('');
                  }}
                  placeholder={paymentMethod.toLowerCase().includes('bank') ? 'Bank A/C Number' : '01XXXXXXXXX'}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Account Holder Name</label>
                <input
                  type="text"
                  required
                  value={accountHolderName}
                  onChange={(e) => {
                    setAccountHolderName(e.target.value);
                    setSelectedSavedId('');
                  }}
                  placeholder="Full recipient name"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Withdrawal Amount (BDT)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 1000"
                  className={inputCls}
                />
              </div>
            </div>

            {numAmount > 0 && (
              <div className="grid grid-cols-3 gap-3 rounded-xl border border-[#DCE4EF] bg-[#F8FAFC] p-3.5 text-center">
                <div>
                  <p className="text-[11px] text-[#64748B]">Requested</p>
                  <p className="text-sm font-bold text-[#0F172A] tabular-nums">{formatBDT(numAmount)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-[#64748B]">Fee</p>
                  <p className="text-sm font-bold text-[#D97706] tabular-nums">-{formatBDT(fee)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-[#64748B]">Net Payout</p>
                  <p className="text-sm font-bold text-[#059669] tabular-nums">{formatBDT(netReceivable)}</p>
                </div>
              </div>
            )}

            <div>
              <label className={labelCls}>Optional Note</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Personal account / bank branch / urgent note..."
                className={inputCls}
              />
            </div>

            <button
              type="submit"
              disabled={submitting || (rules && !rules.withdrawal_enabled)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0D9488] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0F766E] disabled:opacity-60"
            >
              <ArrowUpFromLine className="h-4 w-4" />
              {submitting ? 'Reserving Funds...' : 'Submit Withdrawal Request'}
            </button>
          </form>
        </Card>
      </div>

      {/* Withdrawal History */}
      <Card title="Withdrawal History" className="mt-6">
        {withdrawals.length === 0 ? (
          <EmptyState title="No Withdrawals Yet" description="Your submitted payout requests will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#DCE4EF] text-[11px] uppercase tracking-wider text-[#64748B]">
                  <th className="py-2.5 pr-4">ID</th>
                  <th className="py-2.5 pr-4">Destination</th>
                  <th className="py-2.5 pr-4">Gross / Fee / Net</th>
                  <th className="py-2.5 pr-4">Status</th>
                  <th className="py-2.5 pr-4">Payout Ref</th>
                  <th className="py-2.5 pr-4">Requested</th>
                  <th className="py-2.5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDF2F7]">
                {withdrawals.map((w) => (
                  <tr key={w.id} className="hover:bg-[#F8FAFC]">
                    <td className="py-3 pr-4 font-mono text-xs text-[#64748B]">{w.withdrawal_uid}</td>
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-[#0F172A]">
                        {w.payment_method} ({w.account_number})
                      </p>
                      <p className="text-xs text-[#64748B]">{w.account_holder_name}</p>
                    </td>
                    <td className="py-3 pr-4 text-xs tabular-nums">
                      <p className="font-bold text-[#0F172A]">{formatBDT(w.amount)}</p>
                      <p className="text-[#64748B]">
                        Fee: {formatBDT(w.fee)} • Net:{' '}
                        <span className="font-semibold text-[#059669]">{formatBDT(w.net_amount)}</span>
                      </p>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge status={w.status} />
                      {w.rejection_reason && (
                        <p className="mt-1 max-w-[180px] text-[11px] text-[#DC2626]">{w.rejection_reason}</p>
                      )}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-[#475569]">{w.payout_tx_id || '—'}</td>
                    <td className="whitespace-nowrap py-3 pr-4 text-xs text-[#64748B]">
                      {formatDateTime(w.created_at)}
                    </td>
                    <td className="py-3">
                      {w.status === 'pending' ? (
                        <button
                          onClick={() => handleCancel(w.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-[#FECACA] bg-[#FEF2F2] px-2.5 py-1 text-xs font-semibold text-[#DC2626] hover:bg-[#FEE2E2]"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Cancel
                        </button>
                      ) : (
                        <span className="text-xs text-[#94A3B8]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <LinkWalletModal
        open={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        onSuccess={() => {
          setMessage({ type: 'success', text: 'New wallet verified & activated! You can select it for payouts now.' });
          load();
        }}
        defaultHolderName={user?.full_name || ''}
        defaultPhone={user?.phone || ''}
      />
    </div>
  );
};

export const PaymentMethodsPage: React.FC = () => {
  const { user } = useAuth();
  const [methods, setMethods] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = async () => {
    const res = await api.userGet('/api/payment-methods');
    setMethods(res.data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (m: any) => {
    setEditing(m);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.userDelete(`/api/payment-methods/${id}`);
      setMsg({ type: 'success', text: 'Payment method removed.' });
      await load();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  const handleDefault = async (id: string) => {
    try {
      await api.userPost(`/api/payment-methods/${id}/default`);
      setMsg({ type: 'success', text: 'Default payout wallet updated.' });
      await load();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  return (
    <div>
      <PageHeader
        title="Saved Payment Methods"
        subtitle="Add, OTP-verify, and activate your bKash, Nagad, Rocket, Upay, CellFin, and Bank payout accounts."
        actions={
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D9488] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0F766E]"
          >
            <Plus className="h-4 w-4" /> Add & Verify Wallet
          </button>
        }
      />

      {msg && (
        <div className="mb-5">
          <AlertBanner type={msg.type} message={msg.text} onClose={() => setMsg(null)} />
        </div>
      )}

      {methods.length === 0 ? (
        <Card>
          <EmptyState
            title="No Verified Payout Wallets Yet"
            description="Link your bKash, Nagad, Rocket, Upay, CellFin, or Bank account with 6-digit phone verification so it stays Active for withdrawals."
            icon={Wallet}
            action={
              <button
                onClick={openAdd}
                className="rounded-lg bg-[#0D9488] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0F766E]"
              >
                Add First Wallet
              </button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {methods.map((m) => {
            const meta = getProviderMeta(m.method_name);
            const isActive = (m.verification_status || 'active') === 'active';
            return (
              <Card key={m.id} className="flex flex-col justify-between">
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
                          <span className="text-sm font-bold text-[#0F172A]">{m.method_name}</span>
                          {m.is_default ? (
                            <span className="rounded bg-[#0F172A] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                              DEFAULT
                            </span>
                          ) : null}
                        </div>
                        <span className="text-xs text-[#64748B]">{m.account_type}</span>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-bold ${
                        isActive ? 'text-[#059669]' : 'text-[#D97706]'
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${isActive ? 'bg-[#10B981]' : 'bg-[#F59E0B]'}`}
                      />
                      {isActive ? 'Active' : 'Pending'}
                    </span>
                  </div>

                  <p className="mt-4 font-mono text-lg font-bold text-[#0F172A]">{m.account_number}</p>
                  <p className="mt-0.5 text-sm font-medium text-[#334155]">{m.account_holder_name}</p>
                  {m.notes && <p className="mt-1.5 text-xs text-[#64748B]">{m.notes}</p>}

                  <div className="mt-3 flex items-center gap-3 text-[11px]">
                    <span className="inline-flex items-center gap-1 font-semibold text-[#059669]">
                      <ShieldCheck className="h-3.5 w-3.5" /> Phone Verified
                    </span>
                    {m.has_pin && (
                      <span className="inline-flex items-center gap-1 font-medium text-[#0284C7]">
                        <Lock className="h-3 w-3" /> Security PIN Active
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-[#DCE4EF] pt-3">
                  <div className="flex gap-1.5">
                    {!m.is_default && (
                      <button
                        onClick={() => handleDefault(m.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-[#DCE4EF] px-2.5 py-1 text-xs font-medium text-[#334155] hover:border-[#0D9488] hover:text-[#0D9488]"
                      >
                        <Star className="h-3.5 w-3.5" /> Set Default
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(m)}
                      className="inline-flex items-center gap-1 rounded-md border border-[#DCE4EF] px-2.5 py-1 text-xs font-medium text-[#334155] hover:bg-[#F8FAFC]"
                    >
                      <Edit3 className="h-3.5 w-3.5" /> Edit
                    </button>
                  </div>
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="rounded-md p-1.5 text-[#DC2626] hover:bg-[#FEF2F2]"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <LinkWalletModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSuccess={() => {
          setMsg({ type: 'success', text: 'Wallet OTP verified and activated!' });
          load();
        }}
        editing={editing}
        defaultHolderName={user?.full_name || ''}
        defaultPhone={user?.phone || ''}
      />
    </div>
  );
};
