import {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  forwardRef,
  HTMLAttributes,
  ReactNode,
  Ref,
} from 'react';
import { cn } from '@/lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconPosition?: 'start' | 'end';
  fullWidth?: boolean;
  as?: 'button' | 'a';
}

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

const buttonVariantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--color-primary)] text-white shadow-[0_20px_35px_rgba(10,27,58,0.18)] hover:-translate-y-0.5 hover:shadow-[0_30px_40px_rgba(10,27,58,0.22)] focus-visible:outline-[var(--color-primary)]',
  secondary:
    'bg-white text-[var(--color-text)] border border-[var(--color-border-strong)] shadow-sm hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus-visible:outline-[var(--color-primary)]',
  quiet:
    'bg-transparent text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface-muted)] focus-visible:outline-[var(--color-border-strong)]',
  danger:
    'bg-[var(--color-danger)] text-white shadow-[0_20px_35px_rgba(200,60,60,0.2)] hover:-translate-y-0.5 hover:shadow-[0_30px_45px_rgba(200,60,60,0.25)] focus-visible:outline-[var(--color-danger)]',
};

const buttonSizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-2 text-sm rounded-xl',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
};

export const Button = forwardRef<HTMLElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      icon,
      iconPosition = 'start',
      fullWidth,
      children,
      as = 'button',
      ...props
    },
    ref
  ) => {
    const iconMarkup =
      icon &&
      (typeof icon === 'string' ? (
        <span aria-hidden className="text-current/70">
          {icon}
        </span>
      ) : (
        icon
      ));

    const content = (
      <>
        {icon && iconPosition === 'start' && iconMarkup}
        {children}
        {icon && iconPosition === 'end' && iconMarkup}
      </>
    );

    const classNames = cn(
      buttonBase,
      buttonVariantClasses[variant],
      buttonSizeClasses[size],
      fullWidth && 'w-full',
      className
    );

    if (as === 'a') {
      const anchorProps = props as AnchorHTMLAttributes<HTMLAnchorElement>;
      return (
        <a ref={ref as Ref<HTMLAnchorElement>} className={classNames} {...anchorProps}>
          {content}
        </a>
      );
    }

    const { type, ...restButtonProps } = props as ButtonHTMLAttributes<HTMLButtonElement>;
    return (
      <button
        ref={ref as Ref<HTMLButtonElement>}
        className={classNames}
        type={type ?? 'button'}
        {...restButtonProps}
      >
        {content}
      </button>
    );
  }
);
Button.displayName = 'Button';

type CardVariant = 'elevated' | 'outline' | 'subtle';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  bleed?: boolean;
}

const cardVariantClasses: Record<CardVariant, string> = {
  elevated:
    'bg-[var(--color-surface)] shadow-[0_30px_70px_rgba(12,26,75,0.08)] border border-[var(--color-border)]',
  outline: 'bg-[var(--color-surface)] border border-[var(--color-border-strong)]',
  subtle: 'bg-[var(--color-surface-muted)] border border-transparent shadow-inner',
};

const cardPaddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function Card({
  className,
  variant = 'elevated',
  padding = 'lg',
  bleed,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'relative rounded-3xl transition-shadow duration-300',
        cardVariantClasses[variant],
        cardPaddingClasses[padding],
        bleed && '-mx-4 sm:-mx-6',
        className
      )}
      {...props}
    />
  );
}

interface SectionHeaderProps extends HTMLAttributes<HTMLDivElement> {
  eyebrow?: string;
  title: string;
  description?: string;
  aside?: ReactNode;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  aside,
  className,
  ...props
}: SectionHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)} {...props}>
      <div>
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-soft)]">
            {eyebrow}
          </p>
        )}
        <h2 className="text-2xl font-semibold text-[var(--color-text)]">{title}</h2>
        {description && <p className="mt-1 text-sm text-[var(--color-text-muted)]">{description}</p>}
      </div>
      {aside && <div className="flex-shrink-0">{aside}</div>}
    </div>
  );
}

type BadgeTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

const badgeToneClasses: Record<BadgeTone, string> = {
  info: 'text-[var(--color-primary)] bg-[var(--color-primary-soft)]',
  success: 'text-[var(--color-success)] bg-[var(--color-success-soft)]',
  warning: 'text-[var(--color-warning)] bg-[var(--color-warning-soft)]',
  danger: 'text-[var(--color-danger)] bg-[var(--color-danger-soft)]',
  neutral: 'text-[var(--color-text-muted)] bg-[var(--color-surface-muted)]',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = 'info', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
        badgeToneClasses[tone],
        className
      )}
      {...props}
    />
  );
}

