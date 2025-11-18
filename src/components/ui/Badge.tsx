import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'neutral' | 'success' | 'warning' | 'error' | 'primary';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge = ({ 
  children, 
  variant = 'neutral', 
  size = 'md',
  className = '' 
}: BadgeProps) => {
  const variants = {
    neutral: "bg-gray-100 text-[var(--cds-text-secondary)]",
    success: "bg-green-100 text-[var(--cds-success)]",
    warning: "bg-yellow-100 text-yellow-800",
    error: "bg-red-100 text-[var(--cds-error)]",
    primary: "bg-blue-100 text-[var(--cds-primary)]",
  };

  const sizes = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
  };

  return (
    <span className={`inline-flex items-center font-medium rounded-md ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </span>
  );
};

