import React from 'react';

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options?: SelectOption[];
  error?: string;
  helperText?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      options,
      error,
      helperText,
      children,
      id,
      className = '',
      required,
      disabled,
      ...props
    },
    ref,
  ) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-[13px] font-medium text-[#111827]"
          >
            {label}
            {required && <span className="text-[#DC2626] ml-1">*</span>}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          disabled={disabled}
          className={`block w-full h-[44px] rounded-[10px] border text-sm transition-all duration-150 px-3.5 bg-white ${
            error
              ? 'border-[#DC2626] text-[#DC2626] focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/20'
              : 'border-[#E2E8F0] text-[#111827] focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20'
          } ${disabled ? 'bg-[#F8FAFC] text-[#94A3B8] cursor-not-allowed' : ''} ${className}`}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        {error ? (
          <p className="text-xs text-[#DC2626] font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-[#64748B]">{helperText}</p>
        ) : null}
      </div>
    );
  },
);

Select.displayName = 'Select';
