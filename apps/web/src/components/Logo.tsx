import { useId } from 'react';

/** Uygulama işareti: gradyanlı kutuda soru işareti, köşede "canlı" noktası. */
export function LogoMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  const gradientId = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden
      className={`shrink-0 ${className}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(61% 0.226 286)" />
          <stop offset="1" stopColor="oklch(55% 0.24 320)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${gradientId})`} />
      <path
        d="M11.6 12.4a4.4 4.4 0 1 1 6.6 3.8c-1.5.9-2.2 1.8-2.2 3.3v.6"
        fill="none"
        stroke="white"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle cx="16" cy="24.4" r="2" fill="white" />
      <circle cx="26" cy="6" r="3.4" fill="#fbbf24" stroke="white" strokeWidth="1.6" />
    </svg>
  );
}

/** İşaret ve yazı birlikte. `light` koyu zeminlerde kullanılır. */
export function Logo({
  size = 32,
  tone = 'dark',
  className = '',
}: {
  size?: number;
  tone?: 'dark' | 'light';
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <span
        className={`font-extrabold tracking-tight whitespace-nowrap ${tone === 'light' ? 'text-white' : 'text-slate-900'}`}
        style={{ fontSize: size * 0.62 }}
      >
        Canlı<span className={tone === 'light' ? 'text-brand-200' : 'text-brand-600'}>Quiz</span>
      </span>
    </span>
  );
}
