import { ReactNode } from 'react';

interface CardProps {
  title?: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Card({ title, description, children, footer, className }: CardProps) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-6 shadow-sm ${className || ''}`}>
      {(title || description) && (
        <div className="mb-4">
          {title && <h3 className="m-0 text-lg font-semibold text-slate-900">{title}</h3>}
          {description && <p className="m-0 mt-1 text-sm text-slate-600">{description}</p>}
        </div>
      )}
      {children}
      {footer && <div className="mt-6 pt-4 border-t border-slate-100">{footer}</div>}
    </div>
  );
}


