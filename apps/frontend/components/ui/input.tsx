import React from 'react';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      id,
      className = '',
      required,
      disabled,
      ...props
    },
    ref,
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-[13px] font-medium text-[#111827]"
          >
            {label}
            {required && <span className="text-[#DC2626] ml-1">*</span>}
          </label>
        )}
        <div className="relative rounded-[10px]">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            disabled={disabled}
            className={`block w-full h-[44px] rounded-[10px] border text-sm transition-all duration-150 ${
              leftIcon ? 'pl-10' : 'pl-3.5'
            } ${rightIcon ? 'pr-10' : 'pr-3.5'} ${
              error
                ? 'border-[#DC2626] text-[#DC2626] placeholder-[#FCA5A5] focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/20'
                : 'border-[#E2E8F0] text-[#111827] placeholder-[#94A3B8] focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20'
            } ${disabled ? 'bg-[#F8FAFC] text-[#94A3B8] cursor-not-allowed' : 'bg-white'} ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#94A3B8]">
              {rightIcon}
            </div>
          )}
        </div>
        {error ? (
          <p className="text-xs text-[#DC2626] font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-[#64748B]">{helperText}</p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = 'Input';
