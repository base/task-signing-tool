import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  elevated?: boolean;
  interactive?: boolean;
}

export function Card({ children, className = '', elevated = false, interactive = false }: CardProps) {
  const baseClasses = 'bg-white rounded-xl border border-gray-200';
  const elevatedClasses = elevated ? 'shadow-lg' : 'shadow-sm';
  const interactiveClasses = interactive 
    ? 'cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5' 
    : '';
  
  return (
    <div className={`${baseClasses} ${elevatedClasses} ${interactiveClasses} ${className}`}>
      {children}
    </div>
  );
}

