import React from 'react';

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => {
  return (
    <div
      className={`bg-white rounded-2xl border border-[#EEF2F6] shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden transition-all duration-150 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => {
  return (
    <div
      className={`px-5 py-4 border-b border-[#EEF2F6] flex items-center justify-between gap-4 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className = '',
  children,
  ...props
}) => {
  return (
    <h3
      className={`text-[16px] font-semibold text-[#111827] tracking-tight ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
};

export const CardDescription: React.FC<
  React.HTMLAttributes<HTMLParagraphElement>
> = ({ className = '', children, ...props }) => {
  return (
    <p className={`text-xs text-[#64748B] mt-0.5 ${className}`} {...props}>
      {children}
    </p>
  );
};

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => {
  return (
    <div className={`p-5 ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => {
  return (
    <div
      className={`px-5 py-3.5 bg-[#F8FAFC] border-t border-[#EEF2F6] flex items-center justify-end gap-3 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: React.ReactNode;
  variant?: 'blue' | 'teal' | 'purple' | 'amber' | 'white';
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  className?: string;
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtext,
  icon,
  variant = 'white',
  trend,
  className = '',
  onClick,
}) => {
  const variantStyles = {
    white: {
      card: 'bg-white border-[#EEF2F6] shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:shadow-[0_4px_16px_rgba(15,23,42,0.06)]',
      iconBox: 'bg-[#EFF6FF] text-[#2563EB]',
      title: 'text-[#64748B]',
      val: 'text-[#111827]',
      sub: 'text-[#94A3B8]',
    },
    blue: {
      card: 'bg-gradient-to-br from-[#EFF6FF] to-[#DBEAFE]/40 border-[#BFDBFE]/60 shadow-[0_1px_3px_rgba(37,99,235,0.06)]',
      iconBox: 'bg-white text-[#2563EB] shadow-xs',
      title: 'text-[#1E40AF]',
      val: 'text-[#1E3A8A]',
      sub: 'text-[#3B82F6]',
    },
    teal: {
      card: 'bg-gradient-to-br from-[#F0FDFA] to-[#CCFBF1]/40 border-[#99F6E4]/60 shadow-[0_1px_3px_rgba(13,148,136,0.06)]',
      iconBox: 'bg-white text-[#0D9488] shadow-xs',
      title: 'text-[#115E59]',
      val: 'text-[#134E4A]',
      sub: 'text-[#0D9488]',
    },
    purple: {
      card: 'bg-gradient-to-br from-[#FAF5FF] to-[#F3E8FF]/40 border-[#E9D5FF]/60 shadow-[0_1px_3px_rgba(126,34,206,0.06)]',
      iconBox: 'bg-white text-[#7E22CE] shadow-xs',
      title: 'text-[#6B21A8]',
      val: 'text-[#581C87]',
      sub: 'text-[#9333EA]',
    },
    amber: {
      card: 'bg-gradient-to-br from-[#FFFBEB] to-[#FEF3C7]/40 border-[#FDE68A]/60 shadow-[0_1px_3px_rgba(217,119,6,0.06)]',
      iconBox: 'bg-white text-[#D97706] shadow-xs',
      title: 'text-[#92400E]',
      val: 'text-[#78350F]',
      sub: 'text-[#B45309]',
    },
  };

  const style = variantStyles[variant];

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border p-5 transition-all duration-200 flex flex-col justify-between ${
        onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''
      } ${style.card} ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${style.iconBox}`}>
          {icon}
        </div>
        {trend && (
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              trend.isPositive
                ? 'bg-[#F0FDF4] text-[#16A34A] border border-[#DCFCE7]'
                : 'bg-[#FEF2F2] text-[#DC2626] border border-[#FEE2E2]'
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>

      <div className="mt-4">
        <h4 className={`text-xs font-semibold uppercase tracking-wider ${style.title}`}>
          {label}
        </h4>
        <div className="flex items-baseline gap-2 mt-1">
          <span className={`text-[28px] font-bold tracking-tight leading-none ${style.val}`}>
            {value}
          </span>
        </div>
        {subtext && (
          <p className={`text-xs mt-1.5 font-medium ${style.sub}`}>
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
};
