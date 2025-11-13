import { ButtonHTMLAttributes, forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

const variantClassNames: Record<ButtonVariant, string> = {
  primary:
    'bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:outline-indigo-600 disabled:bg-indigo-300',
  secondary:
    'bg-slate-100 text-slate-800 hover:bg-slate-200 focus-visible:outline-slate-400 disabled:bg-slate-100 disabled:text-slate-400',
  ghost:
    'bg-transparent text-slate-700 hover:bg-slate-100 focus-visible:outline-slate-300 disabled:text-slate-400',
  danger:
    'bg-rose-600 text-white hover:bg-rose-700 focus-visible:outline-rose-600 disabled:bg-rose-300',
  success:
    'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:outline-emerald-600 disabled:bg-emerald-300',
};

const sizeClassNames: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', fullWidth, ...props }, ref) => {
    const classes = [
      'inline-flex items-center justify-center rounded-lg font-semibold transition-colors focus-visible:outline focus-visible:outline-2 disabled:cursor-not-allowed',
      variantClassNames[variant],
      sizeClassNames[size],
      fullWidth ? 'w-full' : '',
      className || '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={ref}
        className={classes}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';


