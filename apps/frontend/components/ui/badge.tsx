import React from 'react';

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  className = '',
  ...props
}) => {
  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 font-medium tracking-tight',
    md: 'text-xs px-2.5 py-1 font-semibold tracking-wide',
  };

  const variantStyles = {
    default: 'bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]',
    neutral: 'bg-[#F8FAFC] text-[#334155] border-[#E2E8F0]',
    primary: 'bg-[#EFF6FF] text-[#2563EB] border-[#DBEAFE]',
    secondary: 'bg-[#F0FDFA] text-[#0D9488] border-[#CCFBF1]',
    success: 'bg-[#F0FDF4] text-[#16A34A] border-[#DCFCE7]',
    warning: 'bg-[#FFFBEB] text-[#F59E0B] border-[#FEF3C7]',
    danger: 'bg-[#FEF2F2] text-[#DC2626] border-[#FEE2E2]',
    info: 'bg-[#EFF6FF] text-[#2563EB] border-[#DBEAFE]',
  };

  const dotColors = {
    default: 'bg-slate-400',
    neutral: 'bg-slate-500',
    primary: 'bg-[#2563EB]',
    secondary: 'bg-[#0D9488]',
    success: 'bg-[#16A34A]',
    warning: 'bg-[#F59E0B]',
    danger: 'bg-[#DC2626]',
    info: 'bg-[#2563EB]',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
};

// Specialized Clinical Status Badge Helpers matching Section 23
export const StatusBadge: React.FC<{ status: string; size?: 'sm' | 'md' }> = ({
  status,
  size = 'md',
}) => {
  const clean = (status || '').toUpperCase();

  switch (clean) {
    // Scheduled / Confirmed -> Blue
    case 'SCHEDULED':
    case 'CONFIRMED':
    case 'ACTIVE':
      return (
        <Badge variant="primary" size={size} dot>
          {clean.replace(/_/g, ' ')}
        </Badge>
      );

    // In Progress / Sample Collected -> Teal
    case 'IN_PROGRESS':
    case 'SAMPLE_COLLECTED':
    case 'PARTIALLY_FULFILLED':
    case 'ISSUED':
      return (
        <Badge variant="secondary" size={size} dot>
          {clean.replace(/_/g, ' ')}
        </Badge>
      );

    // Completed / Paid / Fulfilled / In Stock -> Green
    case 'COMPLETED':
    case 'PAID':
    case 'FULFILLED':
    case 'IN_STOCK':
      return (
        <Badge variant="success" size={size} dot>
          {clean.replace(/_/g, ' ')}
        </Badge>
      );

    // Pending / Draft / Low Stock -> Amber
    case 'PENDING':
    case 'PRESCRIBED':
    case 'LOW_STOCK':
    case 'DRAFT':
    case 'EXPIRING_SOON':
      return (
        <Badge variant="warning" size={size} dot>
          {clean.replace(/_/g, ' ')}
        </Badge>
      );

    // Cancelled / Expired / Failed -> Red
    case 'CANCELLED':
    case 'NO_SHOW':
    case 'FAILED':
    case 'EXPIRED':
    case 'INACTIVE':
      return (
        <Badge variant="danger" size={size} dot>
          {clean.replace(/_/g, ' ')}
        </Badge>
      );

    default:
      return (
        <Badge variant="neutral" size={size}>
          {clean.replace(/_/g, ' ')}
        </Badge>
      );
  }
};
