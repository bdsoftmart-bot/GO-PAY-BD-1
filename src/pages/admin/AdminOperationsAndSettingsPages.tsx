import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit2, Trash2, Send, CheckCheck, ShieldCheck, Wallet, ArrowRight } from 'lucide-react';
import { api } from '../../lib/api';
import { formatBDT, formatDateTime } from '../../lib/format';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  PageHeader,
  StatusText,
  EmptyState,
  Modal,
  btnPrimary,
  btnSecondary,
  inputCls,
  labelCls,
} from '../../components/ui/Primitives';

export const AdminPaymentSettingsPage: React.FC = () => {
  const { publicSettings } = useAuth();
  const { toast } = useToast();
  const [channels, setChannels] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    method_name: 'bKash',
    receiving_number: '',
    account_type: 'Personal (Send Money)',
    account_holder_name: 'GO PAY BD Treasury',
    instructions: '',
    min_deposit: '100',
    max_deposit: '50000',
    deposit_enabled: true,
    withdrawal_enabled: true,
  });

  const load = useCallback(async () => {
    const res = await api.adminGet('/api/admin/payment-settings');
    setChannels(res.data || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm({
      method_name: '',
      receiving_number: '',
      account_type: 'Personal (Send Money)',
      account_holder_name: 'GO PAY BD Treasury',
      instructions: '',
      min_deposit: '100',
      max_deposit: '50000',
      deposit_enabled: true,
      withdrawal_enabled: true,
    });
    setModalOpen(true);
  };

  const openEdit = (c: any) => {
    setEditing(c);
    setForm({
      method_name: c.method_name,
      receiving_number: c.receiving_number,
      account_type: c.account_type,
      account_holder_name: c.account_holder_name,
      instructions: c.instructions || '',
      min_deposit: String(c.min_deposit),
      max_deposit: String(c.max_deposit),
      deposit_enabled: Boolean(c.deposit_enabled),
      withdrawal_enabled: Boolean(c.withdrawal_enabled),
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.adminPut(`/api/admin/payment-settings/${editing.id}`, form);
        toast('Payment channel updated dynamically on the Deposit page.');
      } else {
        await api.adminPost('/api/admin/payment-settings', form);
        toast('New payment channel added.');
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.adminDelete(`/api/admin/payment-settings/${id}`);
      toast('Payment channel deleted.');
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Admin Panel / Payment Settings"
        title="Receiving Payment Numbers & Channels"
        subtitle="Manage active bKash, Nagad, or additional receiving accounts. Updates reflect immediately on the member Deposit page."
        actions={
          <button onClick={openNew} className={btnPrimary}>
            <Plus className="w-4 h-4" /> Add Payment Channel
          </button>
        }
      />

      <div className="bg-[#F0FDFA] border border-[#99F6E4] rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#0D9488] text-white flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-[#0F172A]">
              Wallet Linking Security Deposit (জামানত নিয়ম)
            </div>
            <p className="text-xs text-[#334155] mt-0.5">
              {publicSettings.security_deposit_enabled
                ? `Active: 1st Account = ৳${Number(publicSettings.security_deposit_1_account || 825).toLocaleString()} · 2nd Account = ৳${Number(publicSettings.security_deposit_2_accounts || 1825).toLocaleString()} · 3rd+ = +৳${Number(publicSettings.security_deposit_extra_account || 1000).toLocaleString()}/account`
                : 'Currently Disabled — Users can link wallets without a security deposit.'}
            </p>
          </div>
        </div>
        <Link
          to="/admin/website-settings"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0D9488] text-white text-xs font-semibold hover:bg-[#0F766E] self-start sm:self-center shrink-0"
        >
          <span>Edit Security Deposit (জামানত)</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {channels.map((c) => (
          <div key={c.id} className="bg-white border border-[#DCE4EF] rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-base font-bold text-[#0D9488]">{c.method_name}</span>
                <StatusText status={c.deposit_enabled ? 'active' : 'suspended'} />
              </div>
              <div className="font-mono text-lg font-bold text-[#0F172A] mt-2 tabular-nums">{c.receiving_number}</div>
              <div className="text-xs text-[#64748B] mt-0.5">{c.account_holder_name} · {c.account_type}</div>
              <div className="text-xs text-[#64748B] mt-3 pt-3 border-t border-[#DCE4EF] space-y-1">
                <div>Limits: <span className="font-mono text-[#0F172A]">{formatBDT(c.min_deposit)} – {formatBDT(c.max_deposit)}</span></div>
                <p className="line-clamp-2">{c.instructions}</p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-[#DCE4EF] flex items-center justify-end gap-3 text-xs">
              <button onClick={() => openEdit(c)} className="inline-flex items-center gap-1 font-semibold text-[#0D9488] hover:underline cursor-pointer">
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </button>
              <button onClick={() => handleDelete(c.id)} className="inline-flex items-center gap-1 font-semibold text-[#DC2626] hover:underline cursor-pointer">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Payment Channel' : 'Add Payment Channel'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Method Name</label><input required value={form.method_name} onChange={(e) => setForm({ ...form, method_name: e.target.value })} placeholder="bKash / Nagad / Rocket" className={inputCls} /></div>
            <div><label className={labelCls}>Account Type</label><input required value={form.account_type} onChange={(e) => setForm({ ...form, account_type: e.target.value })} className={inputCls} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Receiving Number</label><input required value={form.receiving_number} onChange={(e) => setForm({ ...form, receiving_number: e.target.value })} className={`${inputCls} font-mono`} /></div>
            <div><label className={labelCls}>Account Holder Name</label><input required value={form.account_holder_name} onChange={(e) => setForm({ ...form, account_holder_name: e.target.value })} className={inputCls} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Min Deposit (BDT)</label><input type="number" required value={form.min_deposit} onChange={(e) => setForm({ ...form, min_deposit: e.target.value })} className={`${inputCls} font-mono`} /></div>
            <div><label className={labelCls}>Max Deposit (BDT)</label><input type="number" required value={form.max_deposit} onChange={(e) => setForm({ ...form, max_deposit: e.target.value })} className={`${inputCls} font-mono`} /></div>
          </div>
          <div><label className={labelCls}>Payment Instructions</label><textarea rows={3} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} className={inputCls} /></div>
          <div className="flex items-center gap-5 text-xs">
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.deposit_enabled} onChange={(e) => setForm({ ...form, deposit_enabled: e.target.checked })} className="accent-[#0D9488]" /> Deposit Enabled</label>
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.withdrawal_enabled} onChange={(e) => setForm({ ...form, withdrawal_enabled: e.target.checked })} className="accent-[#0D9488]" /> Withdrawal Supported</label>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" className={btnPrimary}>Save Channel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export const AdminUserPaymentMethodsPage: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    api.adminGet('/api/admin/payment-methods').then((res) => setItems(res.data || []));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader breadcrumb="Admin Panel / User Payment Methods" title="Member Saved Payout Accounts" subtitle="Authorized finance view of saved user withdrawal numbers." />
      {items.length === 0 ? (
        <EmptyState title="No saved member payout methods" description="Member-added bKash and Nagad withdrawal numbers appear here." />
      ) : (
        <div className="bg-white border border-[#DCE4EF] rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F8FAFC] text-xs text-[#64748B] border-b border-[#DCE4EF]">
              <tr><th className="text-left px-4 py-3">Member</th><th className="text-left px-4 py-3">Method</th><th className="text-left px-4 py-3">Account Number</th><th className="text-left px-4 py-3">Holder Name</th><th className="text-left px-4 py-3">Type</th><th className="text-left px-4 py-3">Added</th></tr>
            </thead>
            <tbody className="divide-y divide-[#DCE4EF]">
              {items.map((pm) => (
                <tr key={pm.id}>
                  <td className="px-4 py-3 text-xs font-semibold">{pm.user_name} (@{pm.username})</td>
                  <td className="px-4 py-3 text-xs">{pm.method_name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{pm.account_number}</td>
                  <td className="px-4 py-3 text-xs">{pm.account_holder_name}</td>
                  <td className="px-4 py-3 text-xs text-[#64748B]">{pm.account_type}{pm.is_default ? ' · Default' : ''}</td>
                  <td className="px-4 py-3 text-xs text-[#64748B]">{formatDateTime(pm.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export const AdminNotificationsPage: React.FC = () => {
  const { refreshAdmin } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const res = await api.adminGet('/api/admin/notifications');
    setItems(res.data || []);
    refreshAdmin();
  }, [refreshAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const markAllRead = async () => {
    await api.adminPost('/api/admin/notifications/read', {});
    toast('Admin alerts marked read.');
    load();
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.adminPost('/api/admin/notifications/broadcast', { title, message });
    toast('Broadcast notification delivered to all active users.');
    setTitle('');
    setMessage('');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Admin Panel / Notifications"
        title="Notifications & User Broadcasts"
        actions={<button onClick={markAllRead} className={btnSecondary}><CheckCheck className="w-4 h-4" /> Mark All Read</button>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-[#DCE4EF] rounded-xl p-6 h-fit">
          <h2 className="text-sm font-bold text-[#0F172A] mb-4">Broadcast Announcement to All Users</h2>
          <form onSubmit={handleBroadcast} className="space-y-3.5">
            <div><label className={labelCls}>Title</label><input required value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Message</label><textarea required rows={4} value={message} onChange={(e) => setMessage(e.target.value)} className={inputCls} /></div>
            <button type="submit" className={btnPrimary}><Send className="w-4 h-4" /> Send Broadcast</button>
          </form>
        </div>

        <div className="lg:col-span-7 bg-white border border-[#DCE4EF] rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#DCE4EF] text-sm font-bold">Platform Admin Alerts</div>
          <div className="divide-y divide-[#DCE4EF]">
            {items.map((n) => (
              <div key={n.id} className={`px-5 py-3.5 ${!n.is_read ? 'bg-[#F8FAFC]' : ''}`}>
                <div className="text-xs font-bold text-[#0F172A]">{n.title}</div>
                <p className="text-xs text-[#64748B] mt-0.5">{n.message}</p>
                <div className="text-[11px] text-[#64748B] mt-1">{formatDateTime(n.created_at)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const AdminSupportPage: React.FC = () => {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<any[]>([]);
  const [active, setActive] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [reply, setReply] = useState('');
  const [status, setStatus] = useState('answered');
  const [internalNote, setInternalNote] = useState('');

  const load = useCallback(async () => {
    const res = await api.adminGet('/api/admin/support');
    setTickets(res.data || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openTicket = async (id: number) => {
    const res = await api.adminGet(`/api/admin/support/${id}`);
    setActive(res.data.ticket);
    setMessages(res.data.messages || []);
    setStatus(res.data.ticket.status);
    setInternalNote(res.data.ticket.internal_note || '');
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active) return;
    await api.adminPost(`/api/admin/support/${active.id}/reply`, { message: reply, status, internal_note: internalNote });
    toast('Ticket updated.');
    setReply('');
    openTicket(active.id);
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader breadcrumb="Admin Panel / Support" title="Support Ticket Desk" subtitle="Respond to member inquiries, assign status, and record internal staff notes." />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-[#DCE4EF] rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#DCE4EF] text-sm font-bold">Ticket Queue</div>
          {tickets.length === 0 ? (
            <div className="p-6 text-xs text-[#64748B] text-center">No support tickets yet.</div>
          ) : (
            <div className="divide-y divide-[#DCE4EF]">
              {tickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => openTicket(t.id)}
                  className={`w-full text-left px-5 py-3.5 hover:bg-[#F8FAFC] cursor-pointer ${active?.id === t.id ? 'bg-[#F4F7FB]' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-[#64748B]">{t.ticket_uid} · @{t.username}</span>
                    <StatusText status={t.status} />
                  </div>
                  <div className="text-xs font-bold text-[#0F172A] mt-1 truncate">{t.subject}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-7 bg-white border border-[#DCE4EF] rounded-xl p-5">
          {!active ? (
            <div className="py-16 text-center text-xs text-[#64748B]">Select a ticket to view messages and reply.</div>
          ) : (
            <div className="space-y-4">
              <div className="pb-3 border-b border-[#DCE4EF] flex justify-between items-start">
                <div>
                  <div className="font-bold text-sm">{active.subject}</div>
                  <div className="text-xs text-[#64748B]">{active.user_name} ({active.user_email}) · {active.ticket_uid}</div>
                </div>
                <StatusText status={active.status} />
              </div>
              <div className="space-y-2.5 max-h-72 overflow-y-auto">
                {messages.map((m) => (
                  <div key={m.id} className={`p-3 rounded-lg text-xs ${m.sender_type === 'admin' ? 'bg-[#0F172A] text-[#F8FAFC]' : 'bg-[#F4F7FB] text-[#0F172A]'}`}>
                    <div className="font-semibold mb-1">{m.sender_name} ({m.sender_type})</div>
                    <p className="whitespace-pre-wrap">{m.message}</p>
                  </div>
                ))}
              </div>
              <form onSubmit={handleReply} className="space-y-3 pt-3 border-t border-[#DCE4EF]">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Status</label>
                    <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="answered">Answered</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Internal Staff Note</label>
                    <input value={internalNote} onChange={(e) => setInternalNote(e.target.value)} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Reply to Member</label>
                  <textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type your response..." className={inputCls} />
                </div>
                <button type="submit" className={btnPrimary}>Send Reply & Update Status</button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const AdminStaffPage: React.FC = () => {
  const { toast } = useToast();
  const [data, setData] = useState<any>({ staff: [], roles: [] });
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', password: '', pin: '', role_id: 2 });

  const load = useCallback(async () => {
    const res = await api.adminGet('/api/admin/staff');
    setData(res.data || { staff: [], roles: [] });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.adminPost('/api/admin/staff', form);
      toast('Admin staff account created.');
      setModalOpen(false);
      setForm({ full_name: '', email: '', password: '', pin: '', role_id: 2 });
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const toggleStatus = async (s: any) => {
    try {
      await api.adminPut(`/api/admin/staff/${s.id}`, { status: s.status === 'active' ? 'suspended' : 'active' });
      toast('Staff status updated.');
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Admin Panel / Staff & RBAC"
        title="Admin Staff & Role Permissions"
        subtitle="Manage Super Admin, Finance Admin, Support Admin, and Manager accounts with backend-enforced RBAC."
        actions={<button onClick={() => setModalOpen(true)} className={btnPrimary}><Plus className="w-4 h-4" /> Add Staff Member</button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {(data.roles || []).map((r: any) => (
          <div key={r.id} className="bg-white border border-[#DCE4EF] rounded-xl p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-[#0D9488]">
              <ShieldCheck className="w-4 h-4" /> {r.name}
            </div>
            <p className="text-xs text-[#64748B] mt-1">{r.description}</p>
            <div className="text-[11px] font-mono text-[#0D9488] mt-2 pt-2 border-t border-[#DCE4EF]">
              {r.permissions?.includes('*') ? 'Full Unrestricted Access' : r.permissions?.join(' · ')}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-[#DCE4EF] rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#F8FAFC] text-xs text-[#64748B] border-b border-[#DCE4EF]">
            <tr><th className="text-left px-4 py-3">Admin ID</th><th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3">Email</th><th className="text-left px-4 py-3">Role</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Last Login</th><th className="text-right px-4 py-3">Action</th></tr>
          </thead>
          <tbody className="divide-y divide-[#DCE4EF]">
            {(data.staff || []).map((s: any) => (
              <tr key={s.id}>
                <td className="px-4 py-3 font-mono text-xs">{s.admin_uid}</td>
                <td className="px-4 py-3 text-xs font-semibold">{s.full_name}</td>
                <td className="px-4 py-3 text-xs">{s.email}</td>
                <td className="px-4 py-3 text-xs font-semibold text-[#0D9488]">{s.role_name}</td>
                <td className="px-4 py-3"><StatusText status={s.status} /></td>
                <td className="px-4 py-3 text-xs text-[#64748B]">{formatDateTime(s.last_login_at)}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => toggleStatus(s)} className="text-xs font-semibold text-[#0D9488] hover:underline cursor-pointer">
                    {s.status === 'active' ? 'Suspend' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Admin Staff Member">
        <form onSubmit={handleCreate} className="space-y-4">
          <div><label className={labelCls}>Full Name</label><input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={inputCls} /></div>
          <div><label className={labelCls}>Email</label><input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Password</label><input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputCls} /></div>
            <div><label className={labelCls}>Security PIN (4–8 digits)</label><input type="password" required value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 8) })} className={`${inputCls} font-mono`} /></div>
          </div>
          <div>
            <label className={labelCls}>Assigned Role</label>
            <select value={form.role_id} onChange={(e) => setForm({ ...form, role_id: Number(e.target.value) })} className={inputCls}>
              {(data.roles || []).map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" className={btnPrimary}>Create Staff Account</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export const AdminAuditLogsPage: React.FC = () => {
  const [data, setData] = useState<any>({ audit_logs: [], activity_logs: [], login_logs: [] });
  const [tab, setTab] = useState<'activity' | 'audit' | 'login'>('activity');

  useEffect(() => {
    api.adminGet('/api/admin/audit-logs').then((res) => setData(res.data || {}));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader breadcrumb="Admin Panel / Audit Logs" title="Protected Audit, Activity & Login Logs" subtitle="Immutable administrative accountability records protected against editing or deletion." />
      <div className="flex items-center gap-1 p-1 bg-white border border-[#DCE4EF] rounded-xl w-fit">
        {([
          ['activity', 'Admin Activity Logs'],
          ['audit', 'System Audit Logs'],
          ['login', 'Login History Logs'],
        ] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${tab === k ? 'bg-[#0F172A] text-[#F8FAFC]' : 'text-[#64748B]'}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="bg-white border border-[#DCE4EF] rounded-xl overflow-x-auto">
        {tab === 'login' ? (
          <table className="w-full text-xs">
            <thead className="bg-[#F8FAFC] border-b border-[#DCE4EF] text-[#64748B]">
              <tr><th className="text-left px-4 py-3">Scope</th><th className="text-left px-4 py-3">Identifier</th><th className="text-left px-4 py-3">Result</th><th className="text-left px-4 py-3">IP Address</th><th className="text-left px-4 py-3">Timestamp</th></tr>
            </thead>
            <tbody className="divide-y divide-[#DCE4EF]">
              {(data.login_logs || []).map((l: any) => (
                <tr key={l.id}>
                  <td className="px-4 py-2.5 uppercase font-semibold text-[#0D9488]">{l.actor_type}</td>
                  <td className="px-4 py-2.5">{l.identifier}</td>
                  <td className="px-4 py-2.5"><StatusText status={l.success ? 'completed' : 'failed'} /></td>
                  <td className="px-4 py-2.5 font-mono">{l.ip_address}</td>
                  <td className="px-4 py-2.5 text-[#64748B]">{formatDateTime(l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-[#F8FAFC] border-b border-[#DCE4EF] text-[#64748B]">
              <tr><th className="text-left px-4 py-3">Actor</th><th className="text-left px-4 py-3">Action</th><th className="text-left px-4 py-3">Entity</th><th className="text-left px-4 py-3">Changes</th><th className="text-left px-4 py-3">IP</th><th className="text-left px-4 py-3">Timestamp</th></tr>
            </thead>
            <tbody className="divide-y divide-[#DCE4EF]">
              {(tab === 'activity' ? data.activity_logs : data.audit_logs || []).map((row: any) => (
                <tr key={row.id}>
                  <td className="px-4 py-2.5 font-semibold">{row.admin_name || row.actor_name}</td>
                  <td className="px-4 py-2.5 font-mono text-[#0D9488]">{row.action}</td>
                  <td className="px-4 py-2.5">{row.entity_type} #{row.entity_id}</td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-[#64748B] max-w-xs truncate">{row.new_values}</td>
                  <td className="px-4 py-2.5 font-mono">{row.ip_address}</td>
                  <td className="px-4 py-2.5 text-[#64748B] whitespace-nowrap">{formatDateTime(row.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export const AdminWebsiteSettingsPage: React.FC = () => {
  const { refreshPublicSettings } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.adminGet('/api/admin/settings').then((res) => setSettings(res.data || {}));
  }, []);

  const setVal = (key: string, val: string) => setSettings((prev) => ({ ...prev, [key]: val }));

  const bumpDeposit = (key: string, fallback: number, delta: number) => {
    setSettings((prev) => {
      const current = Number(prev[key] ?? fallback);
      const safeCurrent = Number.isFinite(current) ? current : fallback;
      const next = Math.max(0, Math.round(safeCurrent + delta));
      return { ...prev, [key]: String(next) };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.adminPut('/api/admin/settings', { settings });
      await refreshPublicSettings();
      toast('All dynamic platform settings saved to database.');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const secDepositEnabled = settings.security_deposit_enabled !== 'false';
  const secTier1 = Number(settings.security_deposit_1_account ?? 825) || 0;
  const secTier2 = Number(settings.security_deposit_2_accounts ?? 1825) || 0;
  const secExtra = Number(settings.security_deposit_extra_account ?? 1000) || 0;

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <PageHeader
        breadcrumb="Admin Panel / Website & Financial Settings"
        title="Centralized Platform Settings"
        subtitle="Control wallet security deposit (জামানত) tiers, general identity, deposit/withdrawal limits, and referral commission rates without editing code."
        actions={<button type="submit" disabled={saving} className={btnPrimary}>{saving ? 'Saving...' : 'Save All Settings'}</button>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="lg:col-span-2 bg-white border-2 border-[#0D9488]/30 rounded-xl p-6 space-y-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#DCE4EF]">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#F0FDFA] border border-[#99F6E4] text-[#0D9488] flex items-center justify-center shrink-0">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#0F172A]">
                  Wallet Linking Security Deposit (জামানত কন্ট্রোল)
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Set how much minimum deposit (জামানত) users must have to link 1 account or 2 accounts. Adjust up or down anytime — changes apply immediately.
                </p>
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#0F172A] bg-[#F8FAFC] border border-[#DCE4EF] rounded-lg px-3.5 py-2 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={secDepositEnabled}
                onChange={(e) => setVal('security_deposit_enabled', e.target.checked ? 'true' : 'false')}
                className="accent-[#0D9488] w-4 h-4"
              />
              <span>{secDepositEnabled ? 'Security Deposit Active (চালু)' : 'Disabled (বন্ধ)'}</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-[#DCE4EF] bg-[#F8FAFC] p-4 space-y-2.5">
              <label className={labelCls}>1st Linked Account Deposit (১ম অ্যাকাউন্ট জামানত · BDT)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={settings.security_deposit_1_account ?? '825'}
                onChange={(e) => setVal('security_deposit_1_account', e.target.value)}
                className={`${inputCls} font-mono text-base font-bold`}
              />
              <div className="flex flex-wrap gap-1.5">
                {[-100, -50, 50, 100].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => bumpDeposit('security_deposit_1_account', 825, d)}
                    className="px-2 py-1 rounded border border-[#CBD5E1] bg-white hover:bg-[#F0FDFA] hover:border-[#0D9488] text-[11px] font-mono font-semibold text-[#0F172A] cursor-pointer"
                  >
                    {d > 0 ? `+৳${d}` : `-৳${Math.abs(d)}`}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setVal('security_deposit_1_account', '825')}
                  className="px-2 py-1 rounded border border-[#99F6E4] bg-[#F0FDFA] text-[11px] font-semibold text-[#0F766E] cursor-pointer"
                >
                  Default ৳825
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-[#DCE4EF] bg-[#F8FAFC] p-4 space-y-2.5">
              <label className={labelCls}>2nd Linked Account Deposit (২য় অ্যাকাউন্ট জামানত · BDT)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={settings.security_deposit_2_accounts ?? '1825'}
                onChange={(e) => setVal('security_deposit_2_accounts', e.target.value)}
                className={`${inputCls} font-mono text-base font-bold`}
              />
              <div className="flex flex-wrap gap-1.5">
                {[-100, -50, 50, 100].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => bumpDeposit('security_deposit_2_accounts', 1825, d)}
                    className="px-2 py-1 rounded border border-[#CBD5E1] bg-white hover:bg-[#F0FDFA] hover:border-[#0D9488] text-[11px] font-mono font-semibold text-[#0F172A] cursor-pointer"
                  >
                    {d > 0 ? `+৳${d}` : `-৳${Math.abs(d)}`}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setVal('security_deposit_2_accounts', '1825')}
                  className="px-2 py-1 rounded border border-[#99F6E4] bg-[#F0FDFA] text-[11px] font-semibold text-[#0F766E] cursor-pointer"
                >
                  Default ৳1,825
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-[#DCE4EF] bg-[#F8FAFC] p-4 space-y-2.5">
              <label className={labelCls}>3rd+ Account Extra Deposit (প্রতি অতিরিক্ত অ্যাকাউন্ট · BDT)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={settings.security_deposit_extra_account ?? '1000'}
                onChange={(e) => setVal('security_deposit_extra_account', e.target.value)}
                className={`${inputCls} font-mono text-base font-bold`}
              />
              <div className="flex flex-wrap gap-1.5">
                {[-100, -50, 50, 100].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => bumpDeposit('security_deposit_extra_account', 1000, d)}
                    className="px-2 py-1 rounded border border-[#CBD5E1] bg-white hover:bg-[#F0FDFA] hover:border-[#0D9488] text-[11px] font-mono font-semibold text-[#0F172A] cursor-pointer"
                  >
                    {d > 0 ? `+৳${d}` : `-৳${Math.abs(d)}`}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setVal('security_deposit_extra_account', '1000')}
                  className="px-2 py-1 rounded border border-[#99F6E4] bg-[#F0FDFA] text-[11px] font-semibold text-[#0F766E] cursor-pointer"
                >
                  Default ৳1,000
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-[#F0FDFA] border border-[#99F6E4] px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="text-[#0F172A] font-medium">
              {secDepositEnabled ? (
                <>
                  <strong>Live User Requirement Preview:</strong>{' '}
                  ১ম অ্যাকাউন্ট = <span className="font-mono font-bold text-[#0F766E]">{formatBDT(secTier1)}</span> ·
                  ২য় অ্যাকাউন্ট = <span className="font-mono font-bold text-[#0F766E]">{formatBDT(secTier2)}</span> ·
                  ৩য় অ্যাকাউন্ট = <span className="font-mono font-bold text-[#0F766E]">{formatBDT(secTier2 + secExtra)}</span>
                </>
              ) : (
                <span className="text-[#B45309] font-semibold">
                  Security deposit gate is currently disabled. Users can link accounts with ৳0 deposit.
                </span>
              )}
            </div>
            <button type="submit" disabled={saving} className="px-3.5 py-1.5 rounded-lg bg-[#0D9488] text-white font-semibold hover:bg-[#0F766E] cursor-pointer">
              {saving ? 'Saving...' : 'Save Deposit Rules'}
            </button>
          </div>
        </div>

        <div className="bg-white border border-[#DCE4EF] rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-[#0F172A] pb-2 border-b border-[#DCE4EF]">General & Contact Settings</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Website Name</label><input value={settings.site_name || ''} onChange={(e) => setVal('site_name', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Tagline</label><input value={settings.site_tagline || ''} onChange={(e) => setVal('site_tagline', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Support Email</label><input value={settings.support_email || ''} onChange={(e) => setVal('support_email', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Support Phone</label><input value={settings.support_phone || ''} onChange={(e) => setVal('support_phone', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Telegram Link</label><input value={settings.telegram_link || ''} onChange={(e) => setVal('telegram_link', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>WhatsApp Link</label><input value={settings.whatsapp_link || ''} onChange={(e) => setVal('whatsapp_link', e.target.value)} className={inputCls} /></div>
          </div>
          <div><label className={labelCls}>Footer Text</label><input value={settings.footer_text || ''} onChange={(e) => setVal('footer_text', e.target.value)} className={inputCls} /></div>
        </div>

        <div className="bg-white border border-[#DCE4EF] rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-[#0F172A] pb-2 border-b border-[#DCE4EF]">Financial & Withdrawal Rules (BDT)</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Min Deposit</label><input value={settings.min_deposit || ''} onChange={(e) => setVal('min_deposit', e.target.value)} className={`${inputCls} font-mono`} /></div>
            <div><label className={labelCls}>Max Deposit</label><input value={settings.max_deposit || ''} onChange={(e) => setVal('max_deposit', e.target.value)} className={`${inputCls} font-mono`} /></div>
            <div><label className={labelCls}>Min Withdrawal</label><input value={settings.min_withdrawal || ''} onChange={(e) => setVal('min_withdrawal', e.target.value)} className={`${inputCls} font-mono`} /></div>
            <div><label className={labelCls}>Max Withdrawal</label><input value={settings.max_withdrawal || ''} onChange={(e) => setVal('max_withdrawal', e.target.value)} className={`${inputCls} font-mono`} /></div>
            <div>
              <label className={labelCls}>Withdrawal Fee Type</label>
              <select value={settings.withdrawal_fee_type || 'percentage'} onChange={(e) => setVal('withdrawal_fee_type', e.target.value)} className={inputCls}>
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed (BDT)</option>
              </select>
            </div>
            <div><label className={labelCls}>Withdrawal Fee Value</label><input value={settings.withdrawal_fee || ''} onChange={(e) => setVal('withdrawal_fee', e.target.value)} className={`${inputCls} font-mono`} /></div>
            <div><label className={labelCls}>Daily Withdrawal Limit</label><input value={settings.daily_withdrawal_limit || ''} onChange={(e) => setVal('daily_withdrawal_limit', e.target.value)} className={`${inputCls} font-mono`} /></div>
            <div><label className={labelCls}>Processing Time Label</label><input value={settings.withdrawal_processing_time || ''} onChange={(e) => setVal('withdrawal_processing_time', e.target.value)} className={inputCls} /></div>
          </div>
          <div className="flex flex-wrap gap-5 text-xs pt-2">
            <label className="flex items-center gap-2"><input type="checkbox" checked={settings.deposit_enabled !== 'false'} onChange={(e) => setVal('deposit_enabled', e.target.checked ? 'true' : 'false')} className="accent-[#0D9488]" /> Deposits Enabled</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={settings.withdrawal_enabled !== 'false'} onChange={(e) => setVal('withdrawal_enabled', e.target.checked ? 'true' : 'false')} className="accent-[#0D9488]" /> Withdrawals Enabled</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={settings.registration_enabled !== 'false'} onChange={(e) => setVal('registration_enabled', e.target.checked ? 'true' : 'false')} className="accent-[#0D9488]" /> Registrations Enabled</label>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white border border-[#DCE4EF] rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-[#0F172A] pb-2 border-b border-[#DCE4EF]">Two-Level Referral & Order Commission Settings</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className={labelCls}>Commission Type</label>
              <select value={settings.commission_type || 'percentage'} onChange={(e) => setVal('commission_type', e.target.value)} className={inputCls}>
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed BDT</option>
              </select>
            </div>
            <div><label className={labelCls}>Level 1 Commission</label><input value={settings.level_1_commission || ''} onChange={(e) => setVal('level_1_commission', e.target.value)} className={`${inputCls} font-mono`} /></div>
            <div><label className={labelCls}>Level 2 Commission</label><input value={settings.level_2_commission || ''} onChange={(e) => setVal('level_2_commission', e.target.value)} className={`${inputCls} font-mono`} /></div>
            <div><label className={labelCls}>Min Qualifying Order (BDT)</label><input value={settings.min_qualifying_order || ''} onChange={(e) => setVal('min_qualifying_order', e.target.value)} className={`${inputCls} font-mono`} /></div>
            <div><label className={labelCls}>Max Commission Cap (BDT)</label><input value={settings.commission_cap || ''} onChange={(e) => setVal('commission_cap', e.target.value)} className={`${inputCls} font-mono`} /></div>
            <div>
              <label className={labelCls}>Commission Approval Mode</label>
              <select value={settings.commission_approval_mode || 'auto'} onChange={(e) => setVal('commission_approval_mode', e.target.value)} className={inputCls}>
                <option value="auto">Auto-Credit on Order Completion</option>
                <option value="manual">Manual Admin Approval Required</option>
              </select>
            </div>
            <div className="sm:col-span-2 flex items-end gap-5 text-xs pb-2.5">
              <label className="flex items-center gap-2"><input type="checkbox" checked={settings.referral_enabled !== 'false'} onChange={(e) => setVal('referral_enabled', e.target.checked ? 'true' : 'false')} className="accent-[#0D9488]" /> Referral Program Enabled</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={settings.commission_enabled !== 'false'} onChange={(e) => setVal('commission_enabled', e.target.checked ? 'true' : 'false')} className="accent-[#0D9488]" /> Order Commissions Enabled</label>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};

export const AdminSecuritySettingsPage: React.FC = () => {
  const { toast } = useToast();
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [saving, setSaving] = useState(false);

  const handleRotate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.new_password.trim().length < 8) {
      toast('New Admin Password must be at least 8 characters.', 'error');
      return;
    }
    if (form.new_password !== form.confirm_password) {
      toast('New Admin Password and confirmation do not match.', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await api.adminPost('/api/admin/security/credentials', {
        current_password: form.current_password,
        new_password: form.new_password,
      });
      toast(res.message);
      setForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        breadcrumb="Admin Panel / Security Settings"
        title="Admin Password & Vault Security"
        subtitle="Update the shared Admin Panel Password used by all staff members to unlock /admin."
      />
      <form onSubmit={handleRotate} className="bg-white border border-[#DCE4EF] rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className={labelCls}>Current Admin Password</label>
            <input
              type="password"
              required
              value={form.current_password}
              onChange={(e) => setForm({ ...form, current_password: e.target.value })}
              className={`${inputCls} font-mono`}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>New Admin Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={form.new_password}
                onChange={(e) => setForm({ ...form, new_password: e.target.value })}
                placeholder="Min 8 characters"
                className={`${inputCls} font-mono`}
              />
            </div>
            <div>
              <label className={labelCls}>Confirm New Admin Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={form.confirm_password}
                onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                placeholder="Re-enter new password"
                className={`${inputCls} font-mono`}
              />
            </div>
          </div>
        </div>
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? 'Updating...' : 'Update Admin Password'}
        </button>
      </form>
    </div>
  );
};
