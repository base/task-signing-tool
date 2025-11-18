import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  isLoading = false,
  icon,
  className = '',
  disabled,
  ...props
}: ButtonProps) => {
  const baseStyles = "inline-flex items-center justify-center font-sans font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60";
  
  const variants = {
    primary: "bg-[var(--cds-primary)] text-white hover:bg-[var(--cds-primary-hover)] active:bg-[var(--cds-primary-hover)] focus:ring-[var(--cds-primary)] rounded-full shadow-sm hover:shadow-md",
    secondary: "bg-white text-[var(--cds-text-primary)] border border-[var(--cds-border)] hover:border-[var(--cds-text-secondary)] hover:bg-gray-50 focus:ring-gray-200 rounded-full",
    danger: "bg-[var(--cds-error)] text-white hover:bg-red-700 focus:ring-[var(--cds-error)] rounded-full",
    ghost: "bg-transparent text-[var(--cds-primary)] hover:bg-blue-50 focus:ring-blue-100 rounded-md",
  };

  const sizes = {
    sm: "text-xs px-4 py-2 h-8 gap-1.5",
    md: "text-sm px-6 py-3 h-12 gap-2",
    lg: "text-base px-8 py-4 h-14 gap-2.5",
  };

  const widthStyles = fullWidth ? "w-full" : "";

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${widthStyles} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : icon ? (
        <span className="flex items-center justify-center">{icon}</span>
      ) : null}
      {children}
    </button>
  );
};

