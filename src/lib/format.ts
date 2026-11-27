import { jsPDF } from 'jspdf';

export function formatBDT(amount: number | string | null | undefined): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount ?? 0);
  const safe = Number.isFinite(num) ? num : 0;
  const negative = safe < 0;
  const formatted = Math.abs(safe).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${negative ? '-' : ''}৳${formatted}`;
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const normalized = iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z';
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const normalized = iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z';
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function exportToCSV(filename: string, headers: string[], rows: Array<Array<string | number | null | undefined>>): void {
  const escapeCell = (v: string | number | null | undefined) => {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv = [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function statusMeta(status: string): { label: string } {
  const s = String(status || 'unknown').trim().toLowerCase();
  const label = s
    .split('_')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
    .join(' ');
  return { label: label || 'Unknown' };
}

export function downloadInvoicePDF(invoice: any, items: any[], companyName = 'GO PAY BD'): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 48;
  let y = 54;

  // Header bar (Midnight Navy #0F172A)
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 595, 92, 'F');
  doc.setTextColor(248, 250, 252);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(companyName, margin, 46);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(45, 212, 191); // #2DD4BF
  doc.text('Manage. Earn. Connect.', margin, 64);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('INVOICE', 547, 46, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(invoice.invoice_number || '', 547, 64, { align: 'right' });

  y = 126;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('BILLED TO', margin, y);
  doc.text('INVOICE DETAILS', 340, y);

  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.text(String(invoice.customer_name || ''), margin, y);
  doc.text(`Order Ref: ${invoice.order_number || ''}`, 340, y);
  y += 16;
  doc.setTextColor(100, 116, 139);
  doc.text(`Customer ID: ${invoice.customer_uid || ''}`, margin, y);
  doc.text(`Invoice Date: ${invoice.invoice_date || invoice.issue_date || ''}`, 340, y);
  y += 16;
  doc.text(String(invoice.customer_contact || invoice.customer_email || ''), margin, y);
  doc.text(`Due Date: ${invoice.due_date || ''}`, 340, y);
  y += 16;
  doc.text(`Payment Method: ${String(invoice.payment_method || '').toUpperCase()}`, 340, y);
  y += 16;
  doc.text(`Payment Status: ${String(invoice.payment_status || '').toUpperCase()}`, 340, y);

  // Table header (Ice Slate #F4F7FB)
  y += 32;
  doc.setFillColor(244, 247, 251);
  doc.rect(margin, y, 499, 26, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('PRODUCT / SERVICE', margin + 10, y + 17);
  doc.text('QTY', 330, y + 17, { align: 'right' });
  doc.text('UNIT PRICE (BDT)', 435, y + 17, { align: 'right' });
  doc.text('TOTAL (BDT)', 537, y + 17, { align: 'right' });

  y += 42;
  doc.setFont('helvetica', 'normal');
  const lineItems = items.length > 0 ? items : [{
    item_name: invoice.product_name,
    quantity: invoice.quantity || 1,
    unit_price: invoice.unit_price || invoice.subtotal,
    line_total: invoice.subtotal,
  }];

  for (const item of lineItems) {
    doc.setTextColor(15, 23, 42);
    doc.text(String(item.item_name || ''), margin + 10, y);
    doc.text(String(item.quantity ?? 1), 330, y, { align: 'right' });
    doc.text(`BDT ${Number(item.unit_price ?? 0).toFixed(2)}`, 435, y, { align: 'right' });
    doc.text(`BDT ${Number(item.line_total ?? 0).toFixed(2)}`, 537, y, { align: 'right' });
    y += 22;
  }

  // Divider (#DCE4EF)
  doc.setDrawColor(220, 228, 239);
  doc.line(margin, y, 547, y);
  y += 22;

  const summaryRows = [
    ['Subtotal', `BDT ${Number(invoice.subtotal ?? 0).toFixed(2)}`],
    ['Discount', `BDT ${Number(invoice.discount ?? 0).toFixed(2)}`],
    ['Tax', `BDT ${Number(invoice.tax ?? 0).toFixed(2)}`],
  ];
  for (const [label, val] of summaryRows) {
    doc.setTextColor(100, 116, 139);
    doc.text(label, 380, y);
    doc.setTextColor(15, 23, 42);
    doc.text(val, 537, y, { align: 'right' });
    y += 18;
  }

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(13, 148, 136); // #0D9488
  doc.text('Total Payable', 380, y);
  doc.text(`BDT ${Number(invoice.total ?? 0).toFixed(2)}`, 537, y, { align: 'right' });

  if (invoice.notes) {
    y += 42;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Notes', margin, y);
    y += 15;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(String(invoice.notes), margin, y, { maxWidth: 499 });
  }

  doc.save(`${invoice.invoice_number || 'invoice'}.pdf`);
}
