import React from 'react';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  const renderIcon = () => {
    if (!icon) return <Inbox className="w-5 h-5" />;
    if (React.isValidElement(icon)) return icon;
    const IconComp = icon as React.ComponentType<{ className?: string }>;
    return <IconComp className="w-5 h-5" />;
  };

  return (
    <div
      className={`text-center py-12 px-6 rounded-2xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC]/60 flex flex-col items-center justify-center ${className}`}
    >
      <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center mb-3">
        {renderIcon()}
      </div>
      <h3 className="text-[15px] font-semibold text-[#111827] mb-1">{title}</h3>
      <p className="text-xs text-[#64748B] max-w-sm mb-4 leading-relaxed">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
};
