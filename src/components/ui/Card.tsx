import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
  selected?: boolean;
}

export const Card = ({
  children,
  padding = 'md',
  interactive = false,
  selected = false,
  className = '',
  ...props
}: CardProps) => {
  const baseStyles = "bg-[var(--cds-surface)] border rounded-2xl transition-all duration-200 overflow-hidden";
  
  const interactiveStyles = interactive 
    ? "cursor-pointer hover:shadow-md hover:border-[var(--cds-text-secondary)] hover:-translate-y-0.5" 
    : "shadow-sm";

  const selectedStyles = selected
    ? "border-[var(--cds-primary)] ring-1 ring-[var(--cds-primary)] bg-blue-50/30 shadow-md"
    : "border-[var(--cds-border)]";

  const paddingStyles = {
    none: "",
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  };

  return (
    <div
      className={`${baseStyles} ${interactiveStyles} ${selectedStyles} ${paddingStyles[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

