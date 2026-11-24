import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router';

type Variant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'ghost'
  | 'ghost-danger'
  | 'ghost-brand'
  | 'dashed'
  | 'accent';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-gradient text-white shadow-glow hover:brightness-110 disabled:opacity-50 disabled:shadow-none disabled:hover:brightness-100',
  accent:
    'bg-amber-400 text-amber-950 shadow-[0_8px_20px_-8px_rgb(245_158_11/0.7)] hover:bg-amber-300 disabled:opacity-50',
  secondary:
    'bg-white text-slate-800 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300 disabled:text-slate-400',
  danger: 'bg-white text-red-600 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-50',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:text-slate-300',
  'ghost-danger': 'text-red-600 hover:bg-red-50 hover:text-red-700 disabled:text-slate-300',
  'ghost-brand': 'text-brand-600 hover:bg-brand-50 hover:text-brand-700 disabled:text-slate-300',
  dashed:
    'border-2 border-dashed border-slate-300 text-slate-600 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700',
};

const sizes: Record<Size, string> = {
  sm: 'rounded-lg px-3 py-1.5 text-sm',
  md: 'rounded-xl px-4 py-2.5 text-sm',
  lg: 'rounded-xl px-6 py-3 text-base',
};

/** Buton görünümü; `Link` gibi buton olmayan öğelerde de kullanılır. */
export const buttonClass = (variant: Variant = 'primary', size: Size = 'md') =>
  `inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap transition duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100 ${sizes[size]} ${variants[variant]}`;

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button type="button" className={`${buttonClass(variant, size)} ${className}`} {...props} />
  );
}

/** Metin kutuları için ortak görünüm. `positive` doğru şık gibi onaylı alanları yeşil gösterir. */
export const inputClass = (invalid = false, positive = false) =>
  `w-full rounded-xl border px-3.5 py-2.5 text-slate-900 shadow-sm transition outline-none placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100 ${invalid ? 'border-red-400 bg-white' : positive ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'}`;

export function TextField({
  label,
  error,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; id: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-slate-700">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={inputClass(Boolean(error))}
        {...props}
      />
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm font-medium text-red-600">
      {message}
    </p>
  );
}

export function Alert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
    >
      <span aria-hidden>⚠️</span>
      <span>{children}</span>
    </div>
  );
}

export function Spinner({ label = 'Yükleniyor...' }: { label?: string }) {
  return (
    <div
      className="flex items-center justify-center gap-3 py-16 text-sm font-medium text-slate-500"
      role="status"
    >
      <span className="h-5 w-5 animate-spin rounded-full border-[3px] border-brand-100 border-t-brand-600" />
      {label}
    </div>
  );
}

/** Beyaz, hafif gölgeli içerik kutusu. */
export function Card({
  children,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'li';
}) {
  return (
    <Tag className={`rounded-2xl bg-white shadow-card ring-1 ring-slate-200/70 ${className}`}>
      {children}
    </Tag>
  );
}

/** Sayfa başlığı; sağ tarafa butonlar konabilir. */
export function PageHeader({
  title,
  description,
  back,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  back?: { to: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      {back && <BackLink to={back.to}>{back.label}</BackLink>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-extrabold tracking-tight break-words text-slate-900 sm:text-3xl">
            {title}
          </h1>
          {description && <p className="max-w-2xl text-slate-600">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="group inline-flex items-center gap-1 self-start text-sm font-semibold text-brand-600 hover:text-brand-800"
    >
      <span aria-hidden className="transition group-hover:-translate-x-0.5">
        ←
      </span>
      {children}
    </Link>
  );
}

type BadgeTone = 'neutral' | 'brand' | 'green' | 'amber' | 'red';
const badgeTones: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-600',
  brand: 'bg-brand-50 text-brand-700 ring-1 ring-brand-100',
  green: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-800 ring-1 ring-amber-100',
  red: 'bg-red-50 text-red-700 ring-1 ring-red-100',
};

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeTones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Boş liste durumu. */
export function EmptyState({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 px-6 py-12 text-center">
      <span
        className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-3xl"
        aria-hidden
      >
        {icon}
      </span>
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      {children && <div className="max-w-md text-sm text-slate-600">{children}</div>}
    </div>
  );
}
