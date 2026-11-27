import React from 'react';

interface BrandLogoProps {
  variant?: 'horizontal' | 'stacked' | 'icon' | 'mobile';
  light?: boolean;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'horizontal',
  light = false,
  className = '',
}) => {
  const mainColor = light ? '#F8FAFC' : '#0F172A';
  const accentColor = light ? '#2DD4BF' : '#0D9488';
  const subColor = light ? '#94A3B8' : '#64748B';
  const markBg = light ? '#1E293B' : '#0F172A';
  const markWallet = '#F8FAFC';
  const markAccent = '#14B8A6';

  const IconSvg = ({ size = 34 }: { size?: number }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="14" fill={markBg} />
      <path
        d="M16 22C16 18.6863 18.6863 16 22 16H44C46.2091 16 48 17.7909 48 20V25H35C31.134 25 28 28.134 28 32C28 35.866 31.134 39 35 39H48V44C48 46.2091 46.2091 48 44 48H22C18.6863 48 16 45.3137 16 42V22Z"
        fill={markWallet}
      />
      <rect x="33" y="28.5" width="17" height="7" rx="3.5" fill={markAccent} />
      <circle cx="37" cy="32" r="2" fill="#0F172A" />
    </svg>
  );

  if (variant === 'icon') {
    return (
      <div className={`inline-flex items-center ${className}`}>
        <IconSvg size={36} />
      </div>
    );
  }

  if (variant === 'stacked') {
    return (
      <div className={`inline-flex flex-col items-center text-center gap-2 ${className}`}>
        <IconSvg size={48} />
        <div>
          <div className="text-xl font-bold tracking-tight leading-none" style={{ color: mainColor }}>
            GO PAY <span style={{ color: accentColor }}>BD</span>
          </div>
          <div className="text-[11px] font-medium tracking-wide mt-1" style={{ color: subColor }}>
            Manage. Earn. Connect.
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'mobile') {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <IconSvg size={28} />
        <span className="text-base font-bold tracking-tight" style={{ color: mainColor }}>
          GO PAY <span style={{ color: accentColor }}>BD</span>
        </span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <IconSvg size={36} />
      <div className="flex flex-col">
        <span className="text-lg font-bold tracking-tight leading-tight" style={{ color: mainColor }}>
          GO PAY <span style={{ color: accentColor }}>BD</span>
        </span>
        <span className="text-[10px] font-medium tracking-wider leading-none mt-0.5" style={{ color: subColor }}>
          Manage. Earn. Connect.
        </span>
      </div>
    </div>
  );
};
