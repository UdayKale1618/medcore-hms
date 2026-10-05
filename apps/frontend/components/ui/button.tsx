import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | 'primary'
    | 'secondary'
    | 'outline'
    | 'ghost'
    | 'danger'
    | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      className = '',
      ...props
    },
    ref,
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none rounded-[10px]';

    const sizeStyles = {
      sm: 'text-xs px-3 h-8 gap-1.5',
      md: 'text-sm px-4 h-10 gap-2',
      lg: 'text-sm px-5 h-11 gap-2.5 font-semibold',
    };

    const variantStyles = {
      primary:
        'bg-[#2563EB] text-white hover:bg-[#1D4ED8] focus:ring-[#2563EB]/40 active:bg-[#1E40AF] shadow-[0_1px_2px_rgba(37,99,235,0.2)]',
      secondary:
        'bg-white border border-[#E5E7EB] text-[#334155] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] focus:ring-[#2563EB]/20 active:bg-[#F1F5F9]',
      outline:
        'border border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F8FAFC] focus:ring-[#2563EB]/20 active:bg-[#F1F5F9]',
      ghost:
        'text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#111827] focus:ring-slate-300',
      danger:
        'bg-[#DC2626] text-white hover:bg-[#B91C1C] focus:ring-[#DC2626]/40 active:bg-[#991B1B] shadow-[0_1px_2px_rgba(220,38,38,0.2)]',
      success:
        'bg-[#16A34A] text-white hover:bg-[#15803D] focus:ring-[#16A34A]/40 active:bg-[#166534] shadow-[0_1px_2px_rgba(22,163,74,0.2)]',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  },
);

Button.displayName = 'Button';
