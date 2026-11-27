import React, { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ShoppingBag, FileText, Printer, Download, Share2, ArrowLeft, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { formatBDT, formatDateTime, downloadInvoicePDF } from '../../lib/format';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { BrandLogo } from '../../components/BrandLogo';
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

export const OrdersPage: React.FC = () => {
  const { toast } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [placing, setPlacing] = useState(false);

  const load = useCallback(async () => {
    const [oRes, cRes, wRes] = await Promise.all([
      api.userGet('/api/orders'),
      api.publicGet('/api/public/catalog'),
      api.userGet('/api/wallet'),
    ]);
    setOrders(oRes.data || []);
    const prods = cRes.data || [];
    setCatalog(prods);
    if (prods.length > 0 && !selectedProductId) setSelectedProductId(prods[0].id);
    setWallet(wRes.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeProd = catalog.find((p) => p.id === selectedProductId) || catalog[0];

  const handleOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProd) return;
    setPlacing(true);
    try {
      const res = await api.userPost('/api/orders', { product_id: activeProd.id, quantity });
      toast(res.message);
      setModalOpen(false);
      setQuantity(1);
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Member Portal / Orders"
        title="My Orders & Services"
        subtitle="Purchase GO PAY BD business plans and accounting services directly from your available BDT wallet."
        actions={
          <button onClick={() => setModalOpen(true)} className={btnPrimary}>
            <Plus className="w-4 h-4" /> New Order
          </button>
        }
      />

      {/* Available Catalog Preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {catalog.map((prod) => (
          <div key={prod.id} className="bg-white border border-[#DCE4EF] rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="text-xs font-medium text-[#0D9488]">{prod.category} · {prod.sku}</div>
              <h3 className="text-sm font-bold text-[#0F172A] mt-1">{prod.name}</h3>
              <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">{prod.description}</p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#DCE4EF] flex items-center justify-between">
              <span className="font-mono text-base font-bold text-[#0D9488] tabular-nums">{formatBDT(prod.unit_price)}</span>
              <button
                onClick={() => {
                  setSelectedProductId(prod.id);
                  setQuantity(1);
                  setModalOpen(true);
                }}
                className="text-xs font-semibold text-[#0D9488] hover:underline cursor-pointer"
              >
                Order Now →
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-[#DCE4EF] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#DCE4EF] flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#0F172A]">Order History</h2>
          <span className="text-xs text-[#64748B] font-mono tabular-nums">
            Wallet Available: {formatBDT(wallet?.available_balance)}
          </span>
        </div>

        {orders.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<ShoppingBag className="w-5 h-5" />}
              title="No orders yet"
              description="Select a service above to place your first order and generate an official GPBD-INV invoice."
              action={<button onClick={() => setModalOpen(true)} className={btnPrimary}>Place First Order</button>}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F8FAFC] text-xs text-[#64748B] border-b border-[#DCE4EF]">
                <tr>
                  <th className="text-left font-semibold px-5 py-3">Order ID</th>
                  <th className="text-left font-semibold px-5 py-3">Product / Service</th>
                  <th className="text-right font-semibold px-5 py-3">Qty</th>
                  <th className="text-right font-semibold px-5 py-3">Amount</th>
                  <th className="text-left font-semibold px-5 py-3">Payment</th>
                  <th className="text-left font-semibold px-5 py-3">Order Status</th>
                  <th className="text-left font-semibold px-5 py-3">Commission</th>
                  <th className="text-left font-semibold px-5 py-3">Date</th>
                  <th className="text-right font-semibold px-5 py-3">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE4EF]">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-[#F8FAFC]">
                    <td className="px-5 py-3 font-mono text-xs">
                      <Link to={`/dashboard/orders/${o.id}`} className="font-semibold text-[#0D9488] hover:underline">
                        {o.order_number}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-xs font-medium">{o.product_name}</td>
                    <td className="px-5 py-3 text-right font-mono text-xs tabular-nums">{o.quantity}</td>
                    <td className="px-5 py-3 text-right font-mono text-xs font-semibold tabular-nums">{formatBDT(o.total)}</td>
                    <td className="px-5 py-3"><StatusText status={o.payment_status} /></td>
                    <td className="px-5 py-3"><StatusText status={o.order_status} /></td>
                    <td className="px-5 py-3"><StatusText status={o.commission_status} /></td>
                    <td className="px-5 py-3 text-xs text-[#64748B] whitespace-nowrap">{formatDateTime(o.created_at)}</td>
                    <td className="px-5 py-3 text-right">
                      {o.invoice_id ? (
                        <Link
                          to={`/dashboard/invoices/${o.invoice_id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#0D9488] hover:underline"
                        >
                          <FileText className="w-3.5 h-3.5" /> {o.invoice_number}
                        </Link>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Place Order via Wallet" subtitle={`Available Balance: ${formatBDT(wallet?.available_balance)}`}>
        <form onSubmit={handleOrder} className="space-y-4">
          <div>
            <label className={labelCls}>Product / Service</label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className={inputCls}
            >
              {catalog.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatBDT(p.unit_price)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Quantity</label>
            <input
              type="number"
              min={1}
              max={50}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value || '1', 10)))}
              className={`${inputCls} font-mono`}
            />
          </div>
          {activeProd && (
            <div className="bg-[#F8FAFC] border border-[#DCE4EF] rounded-lg p-4 flex items-center justify-between text-sm">
              <span className="text-[#64748B]">Order Total (Wallet Debit)</span>
              <span className="font-mono font-bold text-[#0D9488] tabular-nums">
                {formatBDT(activeProd.unit_price * quantity)}
              </span>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" disabled={placing} className={btnPrimary}>
              {placing ? 'Processing...' : 'Confirm & Pay from Wallet'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export const OrderDetailsPage: React.FC = () => {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    api.userGet(`/api/orders/${id}`).then((res) => setData(res.data));
  }, [id]);

  if (!data) return <div className="p-8 text-sm text-[#64748B]">Loading order details...</div>;
  const { order, items, invoice, commissions } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={`Member Portal / Orders / ${order.order_number}`}
        title={`Order ${order.order_number}`}
        subtitle={`Placed on ${formatDateTime(order.created_at)}`}
        actions={
          <>
            <Link to="/dashboard/orders" className={btnSecondary}>
              <ArrowLeft className="w-4 h-4" /> Back to Orders
            </Link>
            {invoice && (
              <Link to={`/dashboard/invoices/${invoice.id}`} className={btnPrimary}>
                <FileText className="w-4 h-4" /> View Invoice ({invoice.invoice_number})
              </Link>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-[#DCE4EF] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#DCE4EF] font-bold text-sm">Order Items</div>
          <table className="w-full text-sm">
            <thead className="bg-[#F8FAFC] text-xs text-[#64748B] border-b border-[#DCE4EF]">
              <tr>
                <th className="text-left px-5 py-3">Item</th>
                <th className="text-right px-5 py-3">Qty</th>
                <th className="text-right px-5 py-3">Unit Price</th>
                <th className="text-right px-5 py-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE4EF]">
              {items.map((it: any) => (
                <tr key={it.id}>
                  <td className="px-5 py-3 text-xs font-medium">{it.item_name}</td>
                  <td className="px-5 py-3 text-right font-mono text-xs tabular-nums">{it.quantity}</td>
                  <td className="px-5 py-3 text-right font-mono text-xs tabular-nums">{formatBDT(it.unit_price)}</td>
                  <td className="px-5 py-3 text-right font-mono text-xs font-semibold tabular-nums">{formatBDT(it.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white border border-[#DCE4EF] rounded-xl p-5 space-y-3 text-sm">
          <h3 className="font-bold text-[#0F172A] pb-2 border-b border-[#DCE4EF]">Order Summary</h3>
          <div className="flex justify-between text-xs"><span className="text-[#64748B]">Payment Status</span><StatusText status={order.payment_status} /></div>
          <div className="flex justify-between text-xs"><span className="text-[#64748B]">Order Status</span><StatusText status={order.order_status} /></div>
          <div className="flex justify-between text-xs"><span className="text-[#64748B]">Commission Status</span><StatusText status={order.commission_status} /></div>
          <div className="pt-3 border-t border-[#DCE4EF] space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-[#64748B]">Subtotal</span><span className="font-mono tabular-nums">{formatBDT(order.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-[#64748B]">Discount</span><span className="font-mono tabular-nums">{formatBDT(order.discount)}</span></div>
            <div className="flex justify-between font-bold text-sm pt-2 border-t border-[#DCE4EF]">
              <span>Total</span>
              <span className="font-mono text-[#0D9488] tabular-nums">{formatBDT(order.total)}</span>
            </div>
          </div>
          {commissions.length > 0 && (
            <div className="pt-3 border-t border-[#DCE4EF]">
              <div className="text-xs font-semibold mb-1.5">Commission Records Generated</div>
              {commissions.map((c: any) => (
                <div key={c.id} className="flex justify-between text-xs text-[#64748B] py-0.5">
                  <span>L{c.referral_level} (@{c.beneficiary_username})</span>
                  <span className="font-mono text-[#059669]">{formatBDT(c.commission_amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const InvoicePage: React.FC<{ isAdmin?: boolean }> = ({ isAdmin = false }) => {
  const { id } = useParams();
  const { publicSettings } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const fetcher = isAdmin ? api.adminGet(`/api/admin/invoices/${id}`) : api.userGet(`/api/invoices/${id}`);
    fetcher.then((res) => setData(res.data));
  }, [id, isAdmin]);

  if (!data) return <div className="p-8 text-sm text-[#64748B]">Loading invoice...</div>;
  const { invoice, items } = data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <Link to={isAdmin ? '/admin/invoices' : '/dashboard/orders'} className={btnSecondary}>
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              toast('Invoice link copied.');
            }}
            className={btnSecondary}
          >
            <Share2 className="w-4 h-4" /> Share
          </button>
          <button onClick={() => window.print()} className={btnSecondary}>
            <Printer className="w-4 h-4" /> Print Invoice
          </button>
          <button
            onClick={() => downloadInvoicePDF(invoice, items, publicSettings.site_name)}
            className={btnPrimary}
          >
            <Download className="w-4 h-4" /> Download PDF
          </button>
        </div>
      </div>

      {/* Print-Friendly Professional Invoice Document */}
      <div className="bg-white border border-[#DCE4EF] rounded-xl p-8 sm:p-10 max-w-4xl mx-auto print-surface">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-7 border-b border-[#DCE4EF]">
          <div>
            <BrandLogo variant="horizontal" />
            <p className="text-xs text-[#64748B] mt-2">{publicSettings.site_tagline}</p>
            <p className="text-xs text-[#64748B] mt-0.5">{publicSettings.support_email} · {publicSettings.support_phone}</p>
          </div>
          <div className="sm:text-right">
            <div className="text-2xl font-bold tracking-tight text-[#0D9488]">INVOICE</div>
            <div className="font-mono text-sm font-semibold text-[#0F172A] mt-1">{invoice.invoice_number}</div>
            <div className="mt-1"><StatusText status={invoice.payment_status} /></div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-7 border-b border-[#DCE4EF] text-xs">
          <div>
            <div className="font-semibold text-[#64748B] mb-1.5">Billed To</div>
            <div className="text-sm font-bold text-[#0F172A]">{invoice.customer_name}</div>
            <div className="font-mono text-[#64748B] mt-0.5">Customer ID: {invoice.customer_uid}</div>
            <div className="text-[#64748B] mt-0.5">{invoice.customer_contact}</div>
          </div>
          <div className="sm:text-right space-y-1">
            <div><span className="text-[#64748B]">Order ID: </span><span className="font-mono font-semibold">{invoice.order_number}</span></div>
            <div><span className="text-[#64748B]">Invoice Date: </span><span className="font-mono">{invoice.invoice_date}</span></div>
            <div><span className="text-[#64748B]">Due Date: </span><span className="font-mono">{invoice.due_date}</span></div>
            <div><span className="text-[#64748B]">Payment Method: </span><span className="capitalize font-semibold">{invoice.payment_method}</span></div>
          </div>
        </div>

        <div className="py-7">
          <table className="w-full text-sm">
            <thead className="bg-[#F4F7FB] text-xs text-[#0F172A]">
              <tr>
                <th className="text-left font-semibold px-4 py-2.5 rounded-l-lg">Product / Service</th>
                <th className="text-right font-semibold px-4 py-2.5">Qty</th>
                <th className="text-right font-semibold px-4 py-2.5">Unit Price</th>
                <th className="text-right font-semibold px-4 py-2.5 rounded-r-lg">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE4EF]">
              {items.map((it: any) => (
                <tr key={it.id}>
                  <td className="px-4 py-3.5 text-sm font-medium">{it.item_name}</td>
                  <td className="px-4 py-3.5 text-right font-mono tabular-nums">{it.quantity}</td>
                  <td className="px-4 py-3.5 text-right font-mono tabular-nums">{formatBDT(it.unit_price)}</td>
                  <td className="px-4 py-3.5 text-right font-mono font-semibold tabular-nums">{formatBDT(it.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end pt-4 border-t border-[#DCE4EF]">
          <div className="w-full sm:w-72 space-y-2 text-sm">
            <div className="flex justify-between text-xs"><span className="text-[#64748B]">Subtotal</span><span className="font-mono tabular-nums">{formatBDT(invoice.subtotal)}</span></div>
            <div className="flex justify-between text-xs"><span className="text-[#64748B]">Discount</span><span className="font-mono tabular-nums">{formatBDT(invoice.discount)}</span></div>
            <div className="flex justify-between text-xs"><span className="text-[#64748B]">Tax</span><span className="font-mono tabular-nums">{formatBDT(invoice.tax)}</span></div>
            <div className="flex justify-between text-base font-bold text-[#0D9488] pt-2.5 border-t border-[#DCE4EF]">
              <span>Total</span>
              <span className="font-mono tabular-nums">{formatBDT(invoice.total)}</span>
            </div>
          </div>
        </div>

        {invoice.notes && (
          <div className="mt-8 pt-5 border-t border-[#DCE4EF] text-xs text-[#64748B]">
            <strong className="text-[#0F172A]">Notes: </strong>{invoice.notes}
          </div>
        )}
      </div>
    </div>
  );
};
