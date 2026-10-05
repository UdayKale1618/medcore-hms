'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  maxWidth?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
  maxWidth,
  children,
  footer,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-5xl',
    '3xl': 'max-w-6xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-[2px] transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div
        className={`relative w-full ${maxWidth || sizeClasses[size]} bg-white rounded-2xl border border-[#EEF2F6] shadow-[0_12px_40px_rgba(15,23,42,0.12)] overflow-hidden z-10 animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]`}
      >
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-[#EEF2F6] flex items-center justify-between gap-4 bg-white">
          <div>
            <h3
              id="modal-title"
              className="text-[17px] font-semibold text-[#111827] tracking-tight"
            >
              {title}
            </h3>
            {description && (
              <p className="text-xs text-[#64748B] mt-0.5">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#94A3B8] hover:text-[#111827] p-1.5 rounded-lg hover:bg-[#F1F5F9] transition-colors focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-3.5 bg-[#F8FAFC] border-t border-[#EEF2F6] flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
