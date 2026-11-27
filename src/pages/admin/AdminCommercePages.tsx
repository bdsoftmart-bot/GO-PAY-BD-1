import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, Download, FileText } from 'lucide-react';
import { api } from '../../lib/api';
import { formatBDT, formatDateTime, exportToCSV } from '../../lib/format';
import { useToast } from '../../contexts/ToastContext';
import {
  PageHeader,
  StatCard,
  StatusText,
  EmptyState,
  PaginationBar,
  Modal,
  btnPrimary,
  btnSecondary,
  btnDanger,
  inputCls,
  labelCls,
} from '../../components/ui/Primitives';

export const AdminOrdersPage: React.FC = () => {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [nextStatus, setNextStatus] = useState('completed');
  const [adminNote, setAdminNote] = useState('');

  const load = useCallback(async () => {
    const q = new URLSearchParams();
    if (status !== 'all') q.set('status', status);
    if (search) q.set('search', search);
    const res = await api.adminGet(`/api/admin/orders?${q.toString()}`);
    setItems(res.data || []);
  }, [status, search]);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    try {
      const res = await api.adminPost(`/api/admin/orders/${selected.id}/status`, {
        order_status: nextStatus,
        admin_note: adminNote,
      });
      toast(res.message);
      setSelected(null);
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Admin Panel / Orders"
        title="Order Management"
        subtitle="Monitor member purchases, trigger eligible commissions on completion, or process safe refunds with commission reversal."
      />
      <div className="bg-white border border-[#DCE4EF] rounded-xl p-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order #, product, username..." className={`${inputCls} pl-9`} />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} w-44`}>
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      {items.length === 0 ? (
        <EmptyState title="No orders found" description="Member orders placed through the platform will appear here." />
      ) : (
        <div className="bg-white border border-[#DCE4EF] rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F8FAFC] text-xs text-[#64748B] border-b border-[#DCE4EF]">
              <tr>
                <th className="text-left px-4 py-3">Order #</th>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Product / Qty</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-left px-4 py-3">Order Status</th>
                <th className="text-left px-4 py-3">Commission</th>
                <th className="text-left px-4 py-3">Invoice</th>
                <th className="text-right px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE4EF]">
              {items.map((o) => (
                <tr key={o.id} className="hover:bg-[#F8FAFC]">
                  <td className="px-4 py-3 font-mono text-xs">{o.order_number}</td>
                  <td className="px-4 py-3 text-xs">
                    <Link to={`/admin/users/${o.user_id}`} className="font-semibold text-[#0D9488] hover:underline">{o.user_name}</Link>
                    <div className="text-[11px] text-[#64748B]">@{o.username}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">{o.product_name} (x{o.quantity})</td>
                  <td className="px-4 py-3 text-right font-mono text-xs font-bold tabular-nums">{formatBDT(o.total)}</td>
                  <td className="px-4 py-3"><StatusText status={o.order_status} /></td>
                  <td className="px-4 py-3"><StatusText status={o.commission_status} /></td>
                  <td className="px-4 py-3">
                    {o.invoice_id ? (
                      <Link to={`/admin/invoices/${o.invoice_id}`} className="inline-flex items-center gap-1 font-mono text-xs text-[#0D9488] hover:underline">
                        <FileText className="w-3.5 h-3.5" /> {o.invoice_number}
                      </Link>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        setSelected(o);
                        setNextStatus(o.order_status);
                        setAdminNote(o.admin_note || '');
                      }}
                      className="text-xs font-semibold text-[#0D9488] hover:underline cursor-pointer"
                    >
                      Update
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={`Manage Order ${selected?.order_number || ''}`}>
        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className={labelCls}>Order Status</label>
            <select value={nextStatus} onChange={(e) => setNextStatus(e.target.value)} className={inputCls}>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed (Issues Invoice & Commissions)</option>
              <option value="cancelled">Cancelled (Refunds & Reverses Commissions)</option>
              <option value="refunded">Refunded (Refunds & Reverses Commissions)</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Admin Note</label>
            <textarea rows={3} value={adminNote} onChange={(e) => setAdminNote(e.target.value)} className={inputCls} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setSelected(null)} className={btnSecondary}>Cancel</button>
            <button type="submit" className={nextStatus === 'refunded' || nextStatus === 'cancelled' ? btnDanger : btnPrimary}>Save Status</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export const AdminCommissionsPage: React.FC = () => {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState('all');

  const load = useCallback(async () => {
    const res = await api.adminGet(`/api/admin/commissions${status !== 'all' ? `?status=${status}` : ''}`);
    setItems(res.data || []);
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (id: number, action: string) => {
    try {
      const res = await api.adminPost(`/api/admin/commissions/${id}/action`, { action, admin_note: `Admin executed ${action}` });
      toast(res.message);
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Admin Panel / Commissions"
        title="Commission Management"
        subtitle="Audit, approve, credit, or safely reverse Level 1 and Level 2 order commissions."
      />
      <div className="flex items-center gap-1 p-1 bg-white border border-[#DCE4EF] rounded-lg w-fit">
        {['all', 'pending', 'approved', 'credited', 'reversed', 'cancelled'].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize cursor-pointer ${status === s ? 'bg-[#0F172A] text-[#F8FAFC]' : 'text-[#64748B]'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState title="No commission records" description="Order-based referral commissions will be tracked here." />
      ) : (
        <div className="bg-white border border-[#DCE4EF] rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F8FAFC] text-xs text-[#64748B] border-b border-[#DCE4EF]">
              <tr>
                <th className="text-left px-4 py-3">Commission ID</th>
                <th className="text-left px-4 py-3">Referrer</th>
                <th className="text-left px-4 py-3">Buyer / Order</th>
                <th className="text-left px-4 py-3">Level & Rate</th>
                <th className="text-right px-4 py-3">Order Amt</th>
                <th className="text-right px-4 py-3">Commission</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE4EF]">
              {items.map((c) => (
                <tr key={c.id} className="hover:bg-[#F8FAFC]">
                  <td className="px-4 py-3 font-mono text-xs">{c.commission_uid}</td>
                  <td className="px-4 py-3 text-xs font-semibold">@{c.beneficiary_username}</td>
                  <td className="px-4 py-3 text-xs">
                    <div>@{c.source_username}</div>
                    <div className="font-mono text-[11px] text-[#64748B]">{c.order_number}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">L{c.referral_level} · {c.rate_value}{c.rate_type === 'percentage' ? '%' : ' BDT'}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">{formatBDT(c.order_amount)}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs font-bold text-[#059669] tabular-nums">{formatBDT(c.commission_amount)}</td>
                  <td className="px-4 py-3"><StatusText status={c.status} /></td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    {(c.status === 'pending' || c.status === 'approved') && (
                      <>
                        <button onClick={() => runAction(c.id, 'credit')} className="text-xs font-semibold text-[#059669] hover:underline cursor-pointer">Credit</button>
                        <button onClick={() => runAction(c.id, 'cancel')} className="text-xs font-semibold text-[#DC2626] hover:underline cursor-pointer">Cancel</button>
                      </>
                    )}
                    {c.status === 'credited' && (
                      <button onClick={() => runAction(c.id, 'reverse')} className="text-xs font-semibold text-[#DC2626] hover:underline cursor-pointer">Reverse</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export const AdminReferralsPage: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    api.adminGet('/api/admin/referrals').then((res) => setItems(res.data || []));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Admin Panel / Referrals"
        title="Referral Network Management"
        subtitle="Immutable Level 1 and Level 2 sponsor relationships across GO PAY BD."
        actions={<Link to="/admin/website-settings" className={btnSecondary}>Configure Referral Rates</Link>}
      />
      {items.length === 0 ? (
        <EmptyState title="No referral links recorded yet" description="When members register with a sponsor code, two-level links appear here." />
      ) : (
        <div className="bg-white border border-[#DCE4EF] rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F8FAFC] text-xs text-[#64748B] border-b border-[#DCE4EF]">
              <tr>
                <th className="text-left px-4 py-3">Sponsor</th>
                <th className="text-left px-4 py-3">Referred Member</th>
                <th className="text-left px-4 py-3">Code Used</th>
                <th className="text-left px-4 py-3">Level</th>
                <th className="text-right px-4 py-3">Completed Orders</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE4EF]">
              {items.map((r) => (
                <tr key={r.id} className="hover:bg-[#F8FAFC]">
                  <td className="px-4 py-3 text-xs font-semibold">{r.referrer_name} (@{r.referrer_username})</td>
                  <td className="px-4 py-3 text-xs">{r.referred_name} (@{r.referred_username})</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.referral_code}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-[#0D9488]">Level {r.level}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">{r.completed_orders}</td>
                  <td className="px-4 py-3"><StatusText status={r.referred_status} /></td>
                  <td className="px-4 py-3 text-xs text-[#64748B]">{formatDateTime(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export const AdminWalletsPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    api.adminGet('/api/admin/wallets').then((res) => setData(res.data));
  }, []);

  const totals = data?.totals || {};
  const items = data?.items || [];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Admin Panel / Wallets"
        title="Platform Wallet Management"
        subtitle="Aggregate member wallet liabilities and individual account balances. Click any member to perform an audited balance adjustment."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard accent="primary" label="Total Available Liability" value={formatBDT(totals.total_available)} />
        <StatCard label="Reserved Withdrawals" value={formatBDT(totals.total_pending_withdrawal)} />
        <StatCard label="Pending Commissions" value={formatBDT(totals.total_pending_commission)} />
        <StatCard label="Lifetime Deposits Credited" value={formatBDT(totals.total_deposits)} />
      </div>

      <div className="bg-white border border-[#DCE4EF] rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#F8FAFC] text-xs text-[#64748B] border-b border-[#DCE4EF]">
            <tr>
              <th className="text-left px-4 py-3">Member</th>
              <th className="text-right px-4 py-3">Available</th>
              <th className="text-right px-4 py-3">Reserved</th>
              <th className="text-right px-4 py-3">Total Deposits</th>
              <th className="text-right px-4 py-3">Total Withdrawals</th>
              <th className="text-right px-4 py-3">Commission</th>
              <th className="text-right px-4 py-3">Manage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DCE4EF]">
            {items.map((w: any) => (
              <tr key={w.id} className="hover:bg-[#F8FAFC]">
                <td className="px-4 py-3 text-xs">
                  <div className="font-semibold">{w.full_name} (@{w.username})</div>
                  <div className="font-mono text-[11px] text-[#64748B]">{w.user_uid}</div>
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs font-bold tabular-nums">{formatBDT(w.available_balance)}</td>
                <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">{formatBDT(w.pending_withdrawal)}</td>
                <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">{formatBDT(w.total_deposits)}</td>
                <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">{formatBDT(w.total_withdrawals)}</td>
                <td className="px-4 py-3 text-right font-mono text-xs text-[#059669] tabular-nums">{formatBDT(w.total_commission)}</td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/admin/users/${w.user_id}`} className="text-xs font-semibold text-[#0D9488] hover:underline">Adjust / Ledger →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const AdminTransactionsPage: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total: 0 });
  const [filters, setFilters] = useState({ search: '', type: 'all', status: 'all', date_from: '', date_to: '', page: 1 });

  const load = useCallback(async () => {
    const q = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v && v !== 'all') q.set(k, String(v));
    });
    const res = await api.adminGet(`/api/admin/transactions?${q.toString()}`);
    setItems(res.data?.items || []);
    setPagination(res.data?.pagination || { page: 1, total_pages: 1, total: 0 });
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const handleExport = () => {
    exportToCSV(
      `gopaybd-platform-ledger-${new Date().toISOString().slice(0, 10)}.csv`,
      ['TxID', 'User ID', 'Username', 'Type', 'Direction', 'Amount', 'Previous', 'New Balance', 'Method', 'Reference', 'Status', 'Description', 'Date'],
      items.map((t) => [t.tx_uid, t.user_uid, t.username, t.tx_type, t.direction, t.amount, t.previous_balance, t.new_balance, t.payment_method, t.reference_id, t.status, t.description, t.created_at])
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Admin Panel / Transactions"
        title="Platform Financial Ledger"
        subtitle="Immutable, non-deletable ledger of all financial entries across every member wallet."
        actions={
          <button onClick={handleExport} disabled={items.length === 0} className={btnSecondary}>
            <Download className="w-4 h-4" /> Export CSV
          </button>
        }
      />

      <div className="bg-white border border-[#DCE4EF] rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-2 relative">
          <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })} placeholder="TxID, Reference, Username, UID..." className={`${inputCls} pl-9`} />
        </div>
        <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value, page: 1 })} className={inputCls}>
          <option value="all">All Types</option>
          <option value="deposit">Deposit</option>
          <option value="withdrawal">Withdrawal</option>
          <option value="order_payment">Order Payment</option>
          <option value="referral_commission">Commission</option>
          <option value="refund">Refund</option>
          <option value="admin_adjustment">Admin Adjustment</option>
        </select>
        <input type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value, page: 1 })} className={inputCls} />
        <input type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value, page: 1 })} className={inputCls} />
      </div>

      <div className="bg-white border border-[#DCE4EF] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F8FAFC] text-xs text-[#64748B] border-b border-[#DCE4EF]">
              <tr>
                <th className="text-left px-4 py-3">TxID</th>
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-right px-4 py-3">Amount</th>
                <th className="text-right px-4 py-3">Prev → New</th>
                <th className="text-left px-4 py-3">Reference</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE4EF]">
              {items.map((t) => (
                <tr key={t.id} className="hover:bg-[#F8FAFC]">
                  <td className="px-4 py-3 font-mono text-xs">{t.tx_uid}</td>
                  <td className="px-4 py-3 text-xs">
                    <Link to={`/admin/users/${t.user_id}`} className="font-semibold text-[#0D9488] hover:underline">@{t.username}</Link>
                    <div className="font-mono text-[11px] text-[#64748B]">{t.user_uid}</div>
                  </td>
                  <td className="px-4 py-3 text-xs capitalize">{String(t.tx_type).replace(/_/g, ' ')}</td>
                  <td className={`px-4 py-3 text-right font-mono text-xs font-bold tabular-nums ${t.direction === 'credit' ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
                    {t.direction === 'credit' ? '+' : '-'}{formatBDT(t.amount)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[11px] text-[#64748B] tabular-nums">
                    {formatBDT(t.previous_balance)} → {formatBDT(t.new_balance)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[#64748B]">{t.reference_id || '—'}</td>
                  <td className="px-4 py-3"><StatusText status={t.status} /></td>
                  <td className="px-4 py-3 text-xs text-[#64748B] whitespace-nowrap">{formatDateTime(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationBar page={pagination.page} totalPages={pagination.total_pages} total={pagination.total} onPageChange={(p) => setFilters({ ...filters, page: p })} />
      </div>
    </div>
  );
};

export const AdminInvoicesPage: React.FC = () => {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [invStatus, setInvStatus] = useState('paid');

  const load = useCallback(async () => {
    const res = await api.adminGet(`/api/admin/invoices${search ? `?search=${encodeURIComponent(search)}` : ''}`);
    setItems(res.data || []);
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    await api.adminPut(`/api/admin/invoices/${editing.id}`, { notes, due_date: dueDate, invoice_status: invStatus });
    toast('Invoice updated.');
    setEditing(null);
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader breadcrumb="Admin Panel / Invoices" title="Invoice Management" subtitle="Search, inspect, edit, print, or download PDF invoices (GPBD-INV-XXXXXX)." />
      <div className="bg-white border border-[#DCE4EF] rounded-xl p-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by Invoice #, Customer name, UID, or Order #..." className={inputCls} />
      </div>

      {items.length === 0 ? (
        <EmptyState title="No invoices generated yet" description="Invoices are automatically issued when orders are completed." />
      ) : (
        <div className="bg-white border border-[#DCE4EF] rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F8FAFC] text-xs text-[#64748B] border-b border-[#DCE4EF]">
              <tr>
                <th className="text-left px-4 py-3">Invoice #</th>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Order ID</th>
                <th className="text-right px-4 py-3">Amount</th>
                <th className="text-left px-4 py-3">Payment Status</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE4EF]">
              {items.map((inv) => (
                <tr key={inv.id} className="hover:bg-[#F8FAFC]">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-[#0D9488]">{inv.invoice_number}</td>
                  <td className="px-4 py-3 text-xs">{inv.customer_name} <span className="font-mono text-[#64748B]">({inv.customer_uid})</span></td>
                  <td className="px-4 py-3 font-mono text-xs">{inv.order_number}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs font-bold tabular-nums">{formatBDT(inv.total)}</td>
                  <td className="px-4 py-3"><StatusText status={inv.payment_status} /></td>
                  <td className="px-4 py-3 text-xs text-[#64748B]">{inv.invoice_date}</td>
                  <td className="px-4 py-3 text-right space-x-3 whitespace-nowrap">
                    <Link to={`/admin/invoices/${inv.id}`} className="text-xs font-semibold text-[#0D9488] hover:underline">View / PDF</Link>
                    <button
                      onClick={() => {
                        setEditing(inv);
                        setNotes(inv.notes || '');
                        setDueDate(inv.due_date || '');
                        setInvStatus(inv.invoice_status || 'paid');
                      }}
                      className="text-xs font-semibold text-[#64748B] hover:text-[#0F172A] cursor-pointer"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={`Edit Invoice ${editing?.invoice_number || ''}`}>
        <form onSubmit={handleSave} className="space-y-4">
          <div><label className={labelCls}>Due Date</label><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} /></div>
          <div>
            <label className={labelCls}>Invoice Status</label>
            <select value={invStatus} onChange={(e) => setInvStatus(e.target.value)} className={inputCls}>
              <option value="draft">Draft</option>
              <option value="issued">Issued</option>
              <option value="paid">Paid</option>
              <option value="void">Void</option>
            </select>
          </div>
          <div><label className={labelCls}>Invoice Notes</label><textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} /></div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(null)} className={btnSecondary}>Cancel</button>
            <button type="submit" className={btnPrimary}>Save Invoice</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
