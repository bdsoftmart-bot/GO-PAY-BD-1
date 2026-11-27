import React from 'react';
import { X, AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { formatBDT, formatDate, formatDateTime, statusMeta } from '../../lib/format';

export { formatBDT, formatDate, formatDateTime };

export const PageHeader: React.FC<{
  title: string;
  subtitle?: string;
  breadcrumb?: string;
  actions?: React.ReactNode;
}> = ({ title, subtitle, breadcrumb, actions }) => (
  <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div>
      {breadcrumb && <div className="mb-1 text-xs font-medium text-[#64748B]">{breadcrumb}</div>}
      <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-[#475569]">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
  </div>
);

export const Card: React.FC<{
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, action, children, className = '' }) => (
  <div className={`rounded-xl border border-[#DCE4EF] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>
    {(title || subtitle || action) && (
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-[#EDF2F7] pb-3.5">
        <div>
          {title && <h3 className="text-sm font-bold text-[#0F172A]">{title}</h3>}
          {subtitle && <p className="mt-0.5 text-xs text-[#64748B]">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    )}
    {children}
  </div>
);

const statAccentMap: Record<string, string> = {
  olive: 'bg-[#F0FDFA] text-[#0D9488]',
  teal: 'bg-[#F0FDFA] text-[#0D9488]',
  emerald: 'bg-[#ECFDF5] text-[#059669]',
  green: 'bg-[#ECFDF5] text-[#059669]',
  amber: 'bg-[#FFFBEB] text-[#D97706]',
  gold: 'bg-[#FFFBEB] text-[#D97706]',
  blue: 'bg-[#F0F9FF] text-[#0284C7]',
  navy: 'bg-[#F1F5F9] text-[#0F172A]',
  red: 'bg-[#FEF2F2] text-[#DC2626]',
};

export const StatCard: React.FC<{
  label: string;
  value: string | number;
  sub?: string;
  subtext?: string;
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  accent?: string;
}> = ({ label, value, sub, subtext, icon, accent = 'teal' }) => {
  const iconNode = React.isValidElement(icon)
    ? icon
    : typeof icon === 'function' || (icon && typeof icon === 'object')
    ? React.createElement(icon as React.ComponentType<{ className?: string }>, { className: 'h-4 w-4' })
    : null;

  const isPrimary = accent === 'primary';
  const caption = sub || subtext;

  return (
    <div
      className={`rounded-xl border p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition ${
        isPrimary
          ? 'border-[#0F172A] bg-gradient-to-br from-[#0F172A] to-[#133C4B] text-white'
          : 'border-[#DCE4EF] bg-white hover:border-[#CBD5E1]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`text-xs font-medium ${isPrimary ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>{label}</div>
          <div
            className={`mt-1.5 text-2xl font-bold tracking-tight tabular-nums ${
              isPrimary ? 'text-white' : 'text-[#0F172A]'
            }`}
          >
            {value}
          </div>
          {caption && (
            <div className={`mt-1 text-xs ${isPrimary ? 'text-[#5EEAD4]' : 'text-[#64748B]'}`}>{caption}</div>
          )}
        </div>
        {iconNode && (
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              isPrimary
                ? 'bg-white/10 text-[#2DD4BF]'
                : statAccentMap[accent] || statAccentMap.teal
            }`}
          >
            {iconNode}
          </div>
        )}
      </div>
    </div>
  );
};

export const SkeletonRows: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 5 }) => (
  <div className="overflow-hidden rounded-xl border border-[#DCE4EF] bg-white">
    <div className="divide-y divide-[#EDF2F7]">
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="grid gap-4 px-5 py-3.5"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }).map((__, c) => (
            <div key={c} className="h-3.5 animate-pulse rounded bg-[#EDF2F7]" />
          ))}
        </div>
      ))}
    </div>
  </div>
);

export const StatusText: React.FC<{ status: string }> = ({ status }) => {
  const s = (status || '').toLowerCase();
  const meta = statusMeta(status);
  let dotColor = 'bg-[#64748B]';
  let textColor = 'text-[#475569]';
  if (['active', 'approved', 'completed', 'paid', 'credited', 'verified'].includes(s)) {
    dotColor = 'bg-[#10B981]';
    textColor = 'text-[#047857]';
  } else if (['pending', 'processing', 'open', 'in_progress', 'issued'].includes(s)) {
    dotColor = 'bg-[#F59E0B]';
    textColor = 'text-[#B45309]';
  } else if (['rejected', 'cancelled', 'suspended', 'reversed', 'void', 'urgent', 'high'].includes(s)) {
    dotColor = 'bg-[#EF4444]';
    textColor = 'text-[#B91C1C]';
  } else if (['answered', 'info', 'medium'].includes(s)) {
    dotColor = 'bg-[#0284C7]';
    textColor = 'text-[#0369A1]';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${textColor}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
      <span>{meta.label}</span>
    </span>
  );
};

export const Badge: React.FC<{ status: string }> = ({ status }) => <StatusText status={status} />;

export const AlertBanner: React.FC<{
  type?: 'success' | 'error' | 'warning' | 'info';
  message: string;
  onClose?: () => void;
}> = ({ type = 'info', message, onClose }) => {
  const styles: Record<string, string> = {
    success: 'border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]',
    error: 'border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]',
    warning: 'border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]',
    info: 'border-[#BAE6FD] bg-[#F0F9FF] text-[#075985]',
  };
  const Icon =
    type === 'success'
      ? CheckCircle2
      : type === 'error'
      ? AlertCircle
      : type === 'warning'
      ? AlertTriangle
      : Info;

  return (
    <div className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${styles[type]}`}>
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="leading-snug">{message}</span>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 opacity-70 hover:opacity-100"
          aria-label="Close alert"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export const EmptyState: React.FC<{
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}> = ({ icon, title, description, action }) => {
  const iconNode = React.isValidElement(icon)
    ? icon
    : typeof icon === 'function' || (icon && typeof icon === 'object')
    ? React.createElement(icon as React.ComponentType<{ className?: string }>, { className: 'h-5 w-5' })
    : null;

  return (
    <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-6 py-12 text-center">
      {iconNode && (
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#0D9488] shadow-xs ring-1 ring-[#DCE4EF]">
          {iconNode}
        </div>
      )}
      <h3 className="text-sm font-bold text-[#0F172A]">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-xs text-[#64748B]">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: string;
}> = ({ open, onClose, title, subtitle, children, maxWidth = 'max-w-lg' }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-[#0F172A]/60 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={`relative w-full ${maxWidth} max-h-[90vh] overflow-y-auto rounded-2xl border border-[#DCE4EF] bg-white shadow-2xl`}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#DCE4EF] bg-white px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-[#0F172A]">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-[#64748B]">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

export const inputCls =
  'w-full px-3.5 py-2.5 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/15 transition';

export const labelCls = 'block text-xs font-semibold text-[#334155] mb-1.5';

export const PaginationBar: React.FC<{
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (p: number) => void;
}> = ({ page, totalPages, total, onPageChange }) => {
  if (totalPages <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#DCE4EF] bg-[#F8FAFC] px-5 py-3 text-xs text-[#64748B]">
      <span>
        Showing page <strong className="text-[#0F172A]">{page}</strong> of{' '}
        <strong className="text-[#0F172A]">{totalPages}</strong> ({total} total)
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="cursor-pointer rounded-lg border border-[#DCE4EF] bg-white px-3 py-1.5 font-semibold text-[#0F172A] hover:bg-[#EDF2F7] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="cursor-pointer rounded-lg border border-[#DCE4EF] bg-white px-3 py-1.5 font-semibold text-[#0F172A] hover:bg-[#EDF2F7] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#0D9488] text-white hover:bg-[#0F766E] disabled:opacity-50 transition-colors cursor-pointer';

export const btnGold =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#0284C7] text-white hover:bg-[#0369A1] disabled:opacity-50 transition-colors cursor-pointer';

export const btnSecondary =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-white border border-[#DCE4EF] text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-50 transition-colors cursor-pointer';

export const btnDanger =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#DC2626] text-white hover:bg-[#B91C1C] disabled:opacity-50 transition-colors cursor-pointer';
