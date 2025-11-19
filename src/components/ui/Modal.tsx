import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { Card } from './Card';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  maxWidth?: string;
}

export const Modal = ({ isOpen, onClose, children, title, maxWidth = 'max-w-lg' }: ModalProps) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <Card
        className={`relative w-full ${maxWidth} max-h-[90vh] overflow-y-auto shadow-xl z-10 bg-white`}
        padding="lg"
      >
        {title && (
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-[var(--cds-text-primary)]">{title}</h2>
            <button
              onClick={onClose}
              className="text-[var(--cds-text-secondary)] hover:text-[var(--cds-text-primary)] transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        )}
        {!title && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-[var(--cds-text-secondary)] hover:text-[var(--cds-text-primary)] transition-colors"
          >
            <X size={24} />
          </button>
        )}

        {children}
      </Card>
    </div>
  );
};
