import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Card } from './Card';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export const Modal = ({ isOpen, onClose, children }: ModalProps) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <Card
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl z-10 bg-white"
        padding="lg"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--cds-text-secondary)] hover:text-[var(--cds-text-primary)] transition-colors"
        >
          <X size={24} />
        </button>

        {children}
      </Card>
    </div>,
    document.body
  );
};
