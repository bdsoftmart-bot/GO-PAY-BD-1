import React, { useEffect, useState, useCallback } from 'react';
import { Bell, CheckCheck, Trash2, LifeBuoy, Send, Plus, Upload, Mail, Phone, MessageSquare } from 'lucide-react';
import { api } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
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

export const NotificationsPage: React.FC = () => {
  const { refreshUser } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const load = useCallback(async () => {
    const res = await api.userGet('/api/notifications');
    setItems(res.data?.items || []);
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (id?: number) => {
    await api.userPost('/api/notifications/read', id ? { id } : {});
    if (!id) toast('All notifications marked as read.');
    load();
  };

  const remove = async (id: number) => {
    await api.userDelete(`/api/notifications/${id}`);
    load();
  };

  const visible = filter === 'unread' ? items.filter((n) => !n.is_read) : items;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Member Portal / Notifications"
        title="Notification Center"
        subtitle="Stay informed on deposit verifications, withdrawal payouts, order completions, and referral commissions."
        actions={
          <button onClick={() => markRead()} disabled={items.every((n) => n.is_read)} className={btnSecondary}>
            <CheckCheck className="w-4 h-4" /> Mark All as Read
          </button>
        }
      />

      <div className="flex items-center gap-1 p-1 bg-white border border-[#DCE4EF] rounded-lg w-fit">
        {(['all', 'unread'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md capitalize cursor-pointer ${
              filter === f ? 'bg-[#0F172A] text-[#F8FAFC]' : 'text-[#64748B]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Bell className="w-5 h-5" />}
          title="No notifications"
          description="You are completely caught up."
        />
      ) : (
        <div className="bg-white border border-[#DCE4EF] rounded-xl divide-y divide-[#DCE4EF]">
          {visible.map((n) => (
            <div key={n.id} className={`px-5 py-4 flex items-start justify-between gap-4 ${!n.is_read ? 'bg-[#F8FAFC]' : ''}`}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#0F172A]">{n.title}</span>
                  {!n.is_read && <span className="text-[11px] font-semibold text-[#0D9488]">· Unread</span>}
                </div>
                <p className="text-xs text-[#64748B] mt-1 leading-relaxed">{n.message}</p>
                <div className="text-[11px] text-[#64748B] mt-1.5">{formatDateTime(n.created_at)}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!n.is_read && (
                  <button onClick={() => markRead(n.id)} className="text-xs font-semibold text-[#0D9488] hover:underline cursor-pointer">
                    Mark read
                  </button>
                )}
                <button onClick={() => remove(n.id)} className="text-[#64748B] hover:text-[#DC2626] p-1 cursor-pointer" title="Delete">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const SupportPage: React.FC = () => {
  const { publicSettings } = useAuth();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<any[]>([]);
  const [activeTicket, setActiveTicket] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [reply, setReply] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ subject: '', category: 'deposit', priority: 'medium', description: '' });
  const [file, setFile] = useState<File | null>(null);

  const loadTickets = useCallback(async () => {
    const res = await api.userGet('/api/support');
    setTickets(res.data || []);
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const openTicket = async (id: number) => {
    const res = await api.userGet(`/api/support/${id}`);
    setActiveTicket(res.data.ticket);
    setMessages(res.data.messages || []);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const fd = new FormData();
      fd.append('subject', form.subject);
      fd.append('category', form.category);
      fd.append('priority', form.priority);
      fd.append('description', form.description);
      if (file) fd.append('attachment', file);
      await api.userPost('/api/support', fd);
      toast('Support ticket created.');
      setModalOpen(false);
      setForm({ subject: '', category: 'deposit', priority: 'medium', description: '' });
      setFile(null);
      loadTickets();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket || !reply.trim()) return;
    await api.userPost(`/api/support/${activeTicket.id}/messages`, { message: reply });
    setReply('');
    openTicket(activeTicket.id);
    loadTickets();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Member Portal / Support"
        title="Help & Support Center"
        subtitle="Open a support ticket or reach our verified support desk directly."
        actions={
          <button onClick={() => setModalOpen(true)} className={btnPrimary}>
            <Plus className="w-4 h-4" /> Open Support Ticket
          </button>
        }
      />

      {/* Dynamic Contact Channels */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#DCE4EF] rounded-xl p-4 flex items-center gap-3">
          <Mail className="w-4 h-4 text-[#0D9488]" />
          <div>
            <div className="text-xs text-[#64748B]">Support Email</div>
            <div className="text-xs font-semibold text-[#0F172A]">{publicSettings.support_email}</div>
          </div>
        </div>
        <a href={publicSettings.telegram_link || '#'} target="_blank" rel="noreferrer" className="bg-white border border-[#DCE4EF] rounded-xl p-4 flex items-center gap-3 hover:border-[#0D9488]">
          <Send className="w-4 h-4 text-[#0D9488]" />
          <div>
            <div className="text-xs text-[#64748B]">Telegram Support</div>
            <div className="text-xs font-semibold text-[#0D9488]">Open Telegram Channel →</div>
          </div>
        </a>
        <a href={publicSettings.whatsapp_link || '#'} target="_blank" rel="noreferrer" className="bg-white border border-[#DCE4EF] rounded-xl p-4 flex items-center gap-3 hover:border-[#0D9488]">
          <MessageSquare className="w-4 h-4 text-[#059669]" />
          <div>
            <div className="text-xs text-[#64748B]">WhatsApp Support</div>
            <div className="text-xs font-semibold text-[#059669]">{publicSettings.support_phone}</div>
          </div>
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-[#DCE4EF] rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#DCE4EF] font-bold text-sm">My Tickets</div>
          {tickets.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={<LifeBuoy className="w-5 h-5" />} title="No support tickets" description="Need help with a deposit or withdrawal? Open a ticket anytime." />
            </div>
          ) : (
            <div className="divide-y divide-[#DCE4EF]">
              {tickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => openTicket(t.id)}
                  className={`w-full text-left px-5 py-3.5 hover:bg-[#F8FAFC] cursor-pointer ${
                    activeTicket?.id === t.id ? 'bg-[#F4F7FB]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-[#64748B]">{t.ticket_uid}</span>
                    <StatusText status={t.status} />
                  </div>
                  <div className="text-sm font-semibold text-[#0F172A] mt-1 truncate">{t.subject}</div>
                  <div className="text-[11px] text-[#64748B] mt-0.5 capitalize">{t.category} · Priority: {t.priority}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-7 bg-white border border-[#DCE4EF] rounded-xl flex flex-col min-h-[380px]">
          {!activeTicket ? (
            <div className="flex-1 flex items-center justify-center p-8 text-xs text-[#64748B]">
              Select a ticket on the left to view the conversation thread.
            </div>
          ) : (
            <>
              <div className="px-5 py-4 border-b border-[#DCE4EF] flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-sm text-[#0F172A]">{activeTicket.subject}</div>
                  <div className="text-xs text-[#64748B] font-mono">{activeTicket.ticket_uid}</div>
                </div>
                <StatusText status={activeTicket.status} />
              </div>
              <div className="flex-1 p-5 space-y-3 overflow-y-auto max-h-96">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`p-3.5 rounded-lg text-xs max-w-[85%] ${
                      m.sender_type === 'user'
                        ? 'ml-auto bg-[#0F172A] text-[#F8FAFC]'
                        : 'bg-[#F4F7FB] border border-[#DCE4EF] text-[#0F172A]'
                    }`}
                  >
                    <div className="font-semibold mb-1">{m.sender_name}</div>
                    <p className="whitespace-pre-wrap leading-relaxed">{m.message}</p>
                    <div className="text-[10px] opacity-75 mt-1.5">{formatDateTime(m.created_at)}</div>
                  </div>
                ))}
              </div>
              {activeTicket.status !== 'closed' && (
                <form onSubmit={handleReply} className="p-4 border-t border-[#DCE4EF] flex gap-2">
                  <input
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Write a follow-up reply..."
                    className={inputCls}
                  />
                  <button type="submit" className={btnPrimary}>Send</button>
                </form>
              )}
            </>
          )}
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Support Ticket">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className={labelCls}>Subject</label>
            <input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls}>
                <option value="deposit">Deposit Verification</option>
                <option value="withdrawal">Withdrawal Payout</option>
                <option value="referral">Referral / Commission</option>
                <option value="order">Orders & Invoices</option>
                <option value="general">General Support</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={inputCls}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea required rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Attachment (Optional)</label>
            <label className="flex items-center gap-2 px-3.5 py-2.5 border border-dashed border-[#DCE4EF] rounded-lg text-xs text-[#64748B] cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>{file ? file.name : 'Upload screenshot or PDF'}</span>
              <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" className={btnPrimary}>Submit Ticket</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export const ProfilePage: React.FC = () => {
  const { refreshUser } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', address: '', city: '', current_password: '' });
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });

  const load = useCallback(async () => {
    const res = await api.userGet('/api/profile');
    setData(res.data);
    setForm({
      full_name: res.data.user.full_name || '',
      email: res.data.user.email || '',
      phone: res.data.user.phone || '',
      address: res.data.profile?.address || '',
      city: res.data.profile?.city || '',
      current_password: '',
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.userPut('/api/profile', form);
      toast(res.message);
      refreshUser();
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleChangePw = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.userPost('/api/profile/change-password', pwForm);
      toast(res.message);
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.append('avatar', f);
    try {
      await api.userPost('/api/profile/avatar', fd);
      toast('Profile photo updated.');
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  if (!data) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Member Portal / Profile"
        title="Profile & Security"
        subtitle={`Account ID: ${data.user.uid} · Referral Code: ${data.user.referral_code}`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-[#DCE4EF] rounded-xl p-6">
          <div className="flex items-center gap-4 pb-5 mb-5 border-b border-[#DCE4EF]">
            {data.profile?.avatar_url ? (
              <img src={data.profile.avatar_url} alt="Profile" className="w-14 h-14 rounded-xl object-cover border border-[#DCE4EF]" />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-[#0F172A] text-[#2DD4BF] text-xl font-bold flex items-center justify-center">
                {data.user.full_name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div className="text-sm font-bold text-[#0F172A]">{data.user.full_name}</div>
              <div className="text-xs text-[#64748B]">@{data.user.username} · Joined {formatDateTime(data.user.created_at)}</div>
              <label className="inline-block mt-1.5 text-xs font-semibold text-[#0D9488] hover:underline cursor-pointer">
                Upload Profile Image
                <input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={handleAvatar} className="hidden" />
              </label>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelCls}>Full Name</label>
              <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email Address</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Phone Number</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={`${inputCls} font-mono`} />
            </div>
            <div>
              <label className={labelCls}>City</label>
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Address</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Current Password (Required only if updating email or phone)</label>
              <input type="password" value={form.current_password} onChange={(e) => setForm({ ...form, current_password: e.target.value })} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className={btnPrimary}>Save Profile Changes</button>
            </div>
          </form>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-[#DCE4EF] rounded-xl p-6">
            <h2 className="text-sm font-bold text-[#0F172A] mb-4">Change Password</h2>
            <form onSubmit={handleChangePw} className="space-y-3.5">
              <div>
                <label className={labelCls}>Current Password</label>
                <input type="password" required value={pwForm.current_password} onChange={(e) => setPwForm({ ...pwForm, current_password: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>New Password</label>
                <input type="password" required value={pwForm.new_password} onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Confirm New Password</label>
                <input type="password" required value={pwForm.confirm_password} onChange={(e) => setPwForm({ ...pwForm, confirm_password: e.target.value })} className={inputCls} />
              </div>
              <button type="submit" className={btnPrimary}>Update Password</button>
            </form>
          </div>

          <div className="bg-white border border-[#DCE4EF] rounded-xl p-6">
            <h2 className="text-sm font-bold text-[#0F172A] mb-3">Recent Login History</h2>
            <div className="divide-y divide-[#DCE4EF] text-xs">
              {(data.login_history || []).map((log: any) => (
                <div key={log.id} className="py-2 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-mono text-[#0F172A]">{log.ip_address}</div>
                    <div className="text-[11px] text-[#64748B]">{formatDateTime(log.created_at)}</div>
                  </div>
                  <StatusText status={log.success ? 'completed' : 'failed'} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SettingsPage: React.FC = () => {
  const { lang, setLang } = useLanguage();
  const { toast } = useToast();
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifInapp, setNotifInapp] = useState(true);

  useEffect(() => {
    api.userGet('/api/profile').then((res) => {
      setNotifEmail(Boolean(res.data.profile?.notification_email ?? 1));
      setNotifInapp(Boolean(res.data.profile?.notification_inapp ?? 1));
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.userPut('/api/profile', {
      preferred_language: lang,
      notification_email: notifEmail,
      notification_inapp: notifInapp,
    });
    toast('Account preferences saved.');
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        breadcrumb="Member Portal / Settings"
        title="Account Settings"
        subtitle="Configure language preference (English / Bengali) and notification delivery."
      />
      <form onSubmit={handleSave} className="bg-white border border-[#DCE4EF] rounded-xl p-6 space-y-5">
        <div>
          <label className={labelCls}>Display Language</label>
          <select value={lang} onChange={(e) => setLang(e.target.value as any)} className={inputCls}>
            <option value="en">English (Default)</option>
            <option value="bn">বাংলা (Bengali)</option>
          </select>
        </div>

        <div className="space-y-2.5 pt-2 border-t border-[#DCE4EF]">
          <label className="flex items-center gap-2.5 text-sm text-[#0F172A] cursor-pointer">
            <input type="checkbox" checked={notifInapp} onChange={(e) => setNotifInapp(e.target.checked)} className="accent-[#0D9488]" />
            In-App Notifications (deposits, payouts, commissions)
          </label>
          <label className="flex items-center gap-2.5 text-sm text-[#0F172A] cursor-pointer">
            <input type="checkbox" checked={notifEmail} onChange={(e) => setNotifEmail(e.target.checked)} className="accent-[#0D9488]" />
            Email Notifications
          </label>
        </div>

        <button type="submit" className={btnPrimary}>Save Preferences</button>
      </form>
    </div>
  );
};
