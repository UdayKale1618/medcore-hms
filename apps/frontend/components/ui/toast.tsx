'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  toast: {
    success: (title: string, message?: string) => void;
    error: (title: string, message?: string) => void;
    warning: (title: string, message?: string) => void;
    info: (title: string, message?: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, title: string, message?: string, duration = 4000) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const newToast: Toast = { id, type, title, message, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast],
  );

  const toastMethods = {
    success: (title: string, message?: string) =>
      addToast('success', title, message),
    error: (title: string, message?: string) =>
      addToast('error', title, message, 6000),
    warning: (title: string, message?: string) =>
      addToast('warning', title, message, 5000),
    info: (title: string, message?: string) =>
      addToast('info', title, message),
  };

  return (
    <ToastContext.Provider value={{ toast: toastMethods }}>
      {children}
      {/* Toast container: top-right */}
      <div className="fixed top-4 right-4 z-50 flex flex-col space-y-2 max-w-sm w-full pointer-events-none p-2">
        {toasts.map((t) => {
          const typeStyles = {
            success: 'bg-[#F0FDF4] border-[#DCFCE7] text-[#14532D]',
            error: 'bg-[#FEF2F2] border-[#FEE2E2] text-[#7F1D1D]',
            warning: 'bg-[#FFFBEB] border-[#FEF3C7] text-[#78350F]',
            info: 'bg-[#EFF6FF] border-[#DBEAFE] text-[#1E3A8A]',
          };

          const iconElement = () => {
            switch (t.type) {
              case 'success':
                return <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />;
              case 'error':
                return <AlertCircle className="w-4 h-4 text-[#DC2626]" />;
              case 'warning':
                return <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />;
              case 'info':
              default:
                return <Info className="w-4 h-4 text-[#2563EB]" />;
            }
          };

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-[0_4px_16px_rgba(15,23,42,0.08)] text-sm transition-all duration-200 animate-in slide-in-from-top-2 ${typeStyles[t.type]}`}
              role="alert"
            >
              <div className="shrink-0 mt-0.5">{iconElement()}</div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-xs leading-5">{t.title}</h4>
                {t.message && (
                  <p className="text-xs opacity-85 mt-0.5 leading-relaxed">
                    {t.message}
                  </p>
                )}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="shrink-0 text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors"
                aria-label="Close notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
