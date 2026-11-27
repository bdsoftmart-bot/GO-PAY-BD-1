import React, { useEffect, useState, useCallback } from 'react';
import { Search, Download, Printer, PhoneCall, Landmark } from 'lucide-react';
import { api } from '../../lib/api';
import { formatBDT, formatDateTime, exportToCSV } from '../../lib/format';
import {
  PageHeader,
  StatCard,
  StatusText,
  EmptyState,
  Modal,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '../../components/ui/Primitives';

export const AdminReportsAndPaymentNumbersPage: React.FC = () => {
  const [period, setPeriod] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [report, setReport] = useState<any>(null);
  const [tab, setTab] = useState<'financial' | 'sender' | 'receiving' | 'search'>('sender');

  // Global Transaction ID / Sender / Deposit / User Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);

  // Drill-down modal when clicking any Sender Number or Receiving Number
  const [drillTitle, setDrillTitle] = useState('');
  const [drillDeposits, setDrillDeposits] = useState<any[]>([]);
  const [drillOpen, setDrillOpen] = useState(false);

  const loadReport = useCallback(async () => {
    const q = new URLSearchParams({ period });
    if (period === 'custom' && dateFrom && dateTo) {
      q.set('date_from', dateFrom);
      q.set('date_to', dateTo);
    }
    const res = await api.adminGet(`/api/admin/reports?${q.toString()}`);
    setReport(res.data);
  }, [period, dateFrom, dateTo]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleGlobalSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const res = await api.adminGet(`/api/admin/reports/payment-search?q=${encodeURIComponent(searchQuery.trim())}`);
    setSearchResults(res.data);
    setTab('search');
  };

  const openSenderDrill = async (senderNumber: string) => {
    const res = await api.adminGet(`/api/admin/reports/payment-search?sender=${encodeURIComponent(senderNumber)}`);
    setDrillTitle(`All Deposits from Sender Number: ${senderNumber}`);
    setDrillDeposits(res.data?.deposits || []);
    setDrillOpen(true);
  };

  const openReceiverDrill = async (receivingNumber: string) => {
    const res = await api.adminGet(`/api/admin/reports/payment-search?receiver=${encodeURIComponent(receivingNumber)}`);
    setDrillTitle(`All Deposits Received on Platform Number: ${receivingNumber}`);
    setDrillDeposits(res.data?.deposits || []);
    setDrillOpen(true);
  };

  const exportSenderCSV = () => {
    const rows = report?.sender_number_report || [];
    exportToCSV(
      `gopaybd-sender-number-report-${period}.csv`,
      ['Sender Number', 'Total Requests', 'Approved', 'Pending', 'Rejected', 'Total Submitted (BDT)', 'Total Approved (BDT)', 'First Tx Date', 'Last Tx Date'],
      rows.map((r: any) => [r.sender_number, r.total_requests, r.approved_count, r.pending_count, r.rejected_count, r.total_submitted, r.total_approved, r.first_tx_date, r.last_tx_date])
    );
  };

  const exportReceivingCSV = () => {
    const rows = report?.receiving_number_report || [];
    exportToCSV(
      `gopaybd-receiving-number-report-${period}.csv`,
      ['Receiving Number', 'Payment Method', 'Total Deposits', 'Approved', 'Pending', 'Rejected', 'Total Received (BDT)', 'First Used', 'Last Used'],
      rows.map((r: any) => [r.receiving_number, r.payment_method, r.total_deposits, r.approved_deposits, r.pending_deposits, r.rejected_deposits, r.total_received, r.first_used, r.last_used])
    );
  };

  const fs = report?.financial_summary || {};
  const cf = report?.cash_flow || {};

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Admin Panel / Reports & Payment Analytics"
        title="Financial Reports & Payment Number Analytics"
        subtitle="Track cash flow vs wallet liabilities, audit every Sender Number and Receiving Number, and search globally by Transaction ID."
        actions={
          <div className="flex items-center gap-2 no-print">
            <button onClick={() => window.print()} className={btnSecondary}>
              <Printer className="w-4 h-4" /> Print Report
            </button>
            <button onClick={tab === 'receiving' ? exportReceivingCSV : exportSenderCSV} className={btnPrimary}>
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
        }
      />

      {/* Global Transaction ID / Sender / User Search + Period Controls */}
      <div className="bg-white border border-[#DCE4EF] rounded-xl p-4 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between no-print">
        <form onSubmit={handleGlobalSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Global Search: Transaction ID, Sender Number, Deposit ID, User ID, Username..."
              className={`${inputCls} pl-9`}
            />
          </div>
          <button type="submit" className={btnPrimary}>Search</button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className={`${inputCls} w-36`}>
            <option value="all">All Time</option>
            <option value="daily">Daily (Today)</option>
            <option value="weekly">Weekly (7d)</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
            <option value="custom">Custom Range</option>
          </select>
          {period === 'custom' && (
            <>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`${inputCls} w-36`} />
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={`${inputCls} w-36`} />
            </>
          )}
        </div>
      </div>

      {/* Report Tabs */}
      <div className="flex items-center gap-1 p-1 bg-white border border-[#DCE4EF] rounded-xl w-fit overflow-x-auto no-print">
        {([
          ['sender', 'Sender Number Report'],
          ['receiving', 'Receiving Number Report'],
          ['financial', 'Financial & Cash Flow Summary'],
          ['search', 'Global Search Results'],
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

      {/* Cash Flow & Financial Summary */}
      {tab === 'financial' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-bold text-[#0F172A] mb-3">Cash Flow vs Platform Liabilities (Strict Separation)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
              <StatCard accent="primary" label="Net Cash Flow" value={formatBDT(cf.net_cash_flow)} subtext="Cash Received − Paid" />
              <StatCard label="Money Received" value={formatBDT(cf.money_received)} subtext="Approved cash deposits" />
              <StatCard label="Money Paid Out" value={formatBDT(cf.money_paid)} subtext="Settled withdrawal payouts" />
              <StatCard label="User Wallet Liabilities" value={formatBDT(cf.user_wallet_liabilities)} subtext="Owed to user wallets" />
              <StatCard label="Pending Payout Liability" value={formatBDT(cf.pending_liabilities)} subtext="Reserved withdrawals" />
              <StatCard label="Commission Liability" value={formatBDT(cf.commission_liability)} subtext="Uncredited commissions" />
            </div>
          </div>

          <div className="bg-white border border-[#DCE4EF] rounded-xl p-6">
            <h2 className="text-sm font-bold text-[#0F172A] mb-4">Period Financial Statement ({period.toUpperCase()})</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="p-3.5 bg-[#F8FAFC] rounded-lg"><span className="text-[#64748B]">Total Deposits Submitted</span><div className="font-mono text-base font-bold mt-1">{formatBDT(fs.total_deposits)}</div></div>
              <div className="p-3.5 bg-[#F8FAFC] rounded-lg"><span className="text-[#64748B]">Approved Deposits</span><div className="font-mono text-base font-bold text-[#059669] mt-1">{formatBDT(fs.total_approved_deposits)}</div></div>
              <div className="p-3.5 bg-[#F8FAFC] rounded-lg"><span className="text-[#64748B]">Pending Deposits</span><div className="font-mono text-base font-bold text-[#D97706] mt-1">{formatBDT(fs.total_pending_deposits)}</div></div>
              <div className="p-3.5 bg-[#F8FAFC] rounded-lg"><span className="text-[#64748B]">Rejected Deposits</span><div className="font-mono text-base font-bold text-[#DC2626] mt-1">{formatBDT(fs.total_rejected_deposits)}</div></div>

              <div className="p-3.5 bg-[#F8FAFC] rounded-lg"><span className="text-[#64748B]">Total Withdrawals</span><div className="font-mono text-base font-bold mt-1">{formatBDT(fs.total_withdrawals)}</div></div>
              <div className="p-3.5 bg-[#F8FAFC] rounded-lg"><span className="text-[#64748B]">Paid Withdrawals</span><div className="font-mono text-base font-bold mt-1">{formatBDT(fs.total_paid_withdrawals)}</div></div>
              <div className="p-3.5 bg-[#F8FAFC] rounded-lg"><span className="text-[#64748B]">Completed Orders ({fs.total_orders ?? 0})</span><div className="font-mono text-base font-bold mt-1">{formatBDT(fs.total_order_volume)}</div></div>
              <div className="p-3.5 bg-[#F8FAFC] rounded-lg"><span className="text-[#64748B]">Total Refunds</span><div className="font-mono text-base font-bold text-[#DC2626] mt-1">{formatBDT(fs.total_refunds)}</div></div>

              <div className="p-3.5 bg-[#F8FAFC] rounded-lg"><span className="text-[#64748B]">Total Commissions</span><div className="font-mono text-base font-bold mt-1">{formatBDT(fs.total_commission)}</div></div>
              <div className="p-3.5 bg-[#F8FAFC] rounded-lg"><span className="text-[#64748B]">Credited Commissions</span><div className="font-mono text-base font-bold mt-1">{formatBDT(fs.total_commission_paid)}</div></div>
              <div className="p-3.5 bg-[#0F172A] text-[#F8FAFC] rounded-lg sm:col-span-2"><span className="text-[#CBD5E1]">Total Platform Revenue</span><div className="font-mono text-lg font-bold text-[#2DD4BF] mt-1">{formatBDT(fs.total_platform_revenue)}</div></div>
            </div>
          </div>
        </div>
      )}

      {/* Sender Number Report */}
      {tab === 'sender' && (
        <div className="bg-white border border-[#DCE4EF] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#DCE4EF] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#0F172A]">Sender Number Report</h2>
              <p className="text-xs text-[#64748B]">Click any sender mobile number to inspect every deposit submitted from that number.</p>
            </div>
          </div>
          {!(report?.sender_number_report?.length) ? (
            <div className="p-6"><EmptyState icon={<PhoneCall className="w-5 h-5" />} title="No sender number records yet" description="Once users submit bKash or Nagad deposits, aggregated sender number analytics appear here." /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#F8FAFC] text-xs text-[#64748B] border-b border-[#DCE4EF]">
                  <tr>
                    <th className="text-left px-4 py-3">Sender Number</th>
                    <th className="text-right px-4 py-3">Requests</th>
                    <th className="text-right px-4 py-3">Approved</th>
                    <th className="text-right px-4 py-3">Pending</th>
                    <th className="text-right px-4 py-3">Rejected</th>
                    <th className="text-right px-4 py-3">Total Submitted</th>
                    <th className="text-right px-4 py-3">Total Approved</th>
                    <th className="text-left px-4 py-3">First Tx</th>
                    <th className="text-left px-4 py-3">Last Tx</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE4EF]">
                  {report.sender_number_report.map((r: any) => (
                    <tr key={r.sender_number} className="hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openSenderDrill(r.sender_number)}
                          className="font-mono text-xs font-bold text-[#0D9488] hover:underline cursor-pointer"
                        >
                          {r.sender_number}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">{r.total_requests}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-[#059669] tabular-nums">{r.approved_count}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-[#D97706] tabular-nums">{r.pending_count}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-[#DC2626] tabular-nums">{r.rejected_count}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">{formatBDT(r.total_submitted)}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-bold text-[#059669] tabular-nums">{formatBDT(r.total_approved)}</td>
                      <td className="px-4 py-3 text-xs text-[#64748B] whitespace-nowrap">{formatDateTime(r.first_tx_date)}</td>
                      <td className="px-4 py-3 text-xs text-[#64748B] whitespace-nowrap">{formatDateTime(r.last_tx_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Receiving Number Report */}
      {tab === 'receiving' && (
        <div className="bg-white border border-[#DCE4EF] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#DCE4EF]">
            <h2 className="text-sm font-bold text-[#0F172A]">Platform Receiving Number Report</h2>
            <p className="text-xs text-[#64748B]">Exact inflow accounting for every bKash and Nagad receiving number used on GO PAY BD.</p>
          </div>
          {!(report?.receiving_number_report?.length) ? (
            <div className="p-6"><EmptyState icon={<Landmark className="w-5 h-5" />} title="No receiving number activity yet" description="Deposits directed to your configured receiving numbers will be summarized here." /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#F8FAFC] text-xs text-[#64748B] border-b border-[#DCE4EF]">
                  <tr>
                    <th className="text-left px-4 py-3">Receiving Number</th>
                    <th className="text-left px-4 py-3">Method</th>
                    <th className="text-right px-4 py-3">Total</th>
                    <th className="text-right px-4 py-3">Approved</th>
                    <th className="text-right px-4 py-3">Pending</th>
                    <th className="text-right px-4 py-3">Rejected</th>
                    <th className="text-right px-4 py-3">Total Amount Received</th>
                    <th className="text-left px-4 py-3">First Used</th>
                    <th className="text-left px-4 py-3">Last Used</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE4EF]">
                  {report.receiving_number_report.map((r: any) => (
                    <tr key={`${r.receiving_number}-${r.payment_method}`} className="hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openReceiverDrill(r.receiving_number)}
                          className="font-mono text-xs font-bold text-[#0D9488] hover:underline cursor-pointer"
                        >
                          {r.receiving_number}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold">{r.payment_method}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">{r.total_deposits}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-[#059669] tabular-nums">{r.approved_deposits}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-[#D97706] tabular-nums">{r.pending_deposits}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-[#DC2626] tabular-nums">{r.rejected_deposits}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-bold text-[#059669] tabular-nums">{formatBDT(r.total_received)}</td>
                      <td className="px-4 py-3 text-xs text-[#64748B] whitespace-nowrap">{formatDateTime(r.first_used)}</td>
                      <td className="px-4 py-3 text-xs text-[#64748B] whitespace-nowrap">{formatDateTime(r.last_used)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Global Search Results */}
      {tab === 'search' && (
        <div className="space-y-4">
          {!searchResults ? (
            <EmptyState title="Run a global search above" description="Search by bKash/Nagad Transaction ID, Sender Number, Deposit ID, User ID, or Username." />
          ) : (
            <>
              <div className="bg-white border border-[#DCE4EF] rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#DCE4EF] text-xs font-bold">Matching Deposits ({searchResults.deposits?.length ?? 0})</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-[#F8FAFC] border-b border-[#DCE4EF] text-[#64748B]">
                      <tr><th className="text-left px-4 py-2.5">Deposit ID</th><th className="text-left px-4 py-2.5">User</th><th className="text-left px-4 py-2.5">Sender → Receiver</th><th className="text-left px-4 py-2.5">TrxID</th><th className="text-right px-4 py-2.5">Amount</th><th className="text-left px-4 py-2.5">Status</th></tr>
                    </thead>
                    <tbody className="divide-y divide-[#DCE4EF]">
                      {(searchResults.deposits || []).map((d: any) => (
                        <tr key={d.id}>
                          <td className="px-4 py-2.5 font-mono">{d.deposit_uid}</td>
                          <td className="px-4 py-2.5">{d.user_name} (@{d.username})</td>
                          <td className="px-4 py-2.5 font-mono">{d.sender_number} → {d.receiving_number}</td>
                          <td className="px-4 py-2.5 font-mono font-semibold">{d.transaction_id}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold">{formatBDT(d.amount)}</td>
                          <td className="px-4 py-2.5"><StatusText status={d.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white border border-[#DCE4EF] rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#DCE4EF] text-xs font-bold">Matching Wallet Ledger Transactions ({searchResults.transactions?.length ?? 0})</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-[#F8FAFC] border-b border-[#DCE4EF] text-[#64748B]">
                      <tr><th className="text-left px-4 py-2.5">TxID</th><th className="text-left px-4 py-2.5">User</th><th className="text-left px-4 py-2.5">Type</th><th className="text-left px-4 py-2.5">Reference</th><th className="text-right px-4 py-2.5">Amount</th><th className="text-left px-4 py-2.5">Date</th></tr>
                    </thead>
                    <tbody className="divide-y divide-[#DCE4EF]">
                      {(searchResults.transactions || []).map((t: any) => (
                        <tr key={t.id}>
                          <td className="px-4 py-2.5 font-mono">{t.tx_uid}</td>
                          <td className="px-4 py-2.5">@{t.username} ({t.user_uid})</td>
                          <td className="px-4 py-2.5 capitalize">{String(t.tx_type).replace(/_/g, ' ')}</td>
                          <td className="px-4 py-2.5 font-mono">{t.reference_id}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold">{formatBDT(t.amount)}</td>
                          <td className="px-4 py-2.5 text-[#64748B]">{formatDateTime(t.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Number Drill-down Modal */}
      <Modal open={drillOpen} onClose={() => setDrillOpen(false)} title={drillTitle} maxWidth="max-w-3xl">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#F8FAFC] border-b border-[#DCE4EF] text-[#64748B]">
              <tr>
                <th className="text-left px-3 py-2.5">Deposit ID</th>
                <th className="text-left px-3 py-2.5">User</th>
                <th className="text-left px-3 py-2.5">Method</th>
                <th className="text-left px-3 py-2.5">Transaction ID</th>
                <th className="text-right px-3 py-2.5">Amount</th>
                <th className="text-left px-3 py-2.5">Status</th>
                <th className="text-left px-3 py-2.5">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE4EF]">
              {drillDeposits.map((d) => (
                <tr key={d.id}>
                  <td className="px-3 py-2.5 font-mono">{d.deposit_uid}</td>
                  <td className="px-3 py-2.5">{d.user_name} (@{d.username})</td>
                  <td className="px-3 py-2.5">{d.payment_method}</td>
                  <td className="px-3 py-2.5 font-mono font-semibold">{d.transaction_id}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold">{formatBDT(d.amount)}</td>
                  <td className="px-3 py-2.5"><StatusText status={d.status} /></td>
                  <td className="px-3 py-2.5 text-[#64748B]">{formatDateTime(d.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  );
};
