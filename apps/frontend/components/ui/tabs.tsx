import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  badge?: string | number;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className = '',
}) => {
  return (
    <div className={`border-b border-[#EEF2F6] ${className}`}>
      <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`whitespace-nowrap pb-3.5 px-1 border-b-2 font-medium text-xs sm:text-sm flex items-center gap-2 transition-all duration-150 ${
                isActive
                  ? 'border-[#2563EB] text-[#2563EB] font-semibold'
                  : 'border-transparent text-[#64748B] hover:text-[#111827] hover:border-[#CBD5E1]'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              {tab.icon}
              {tab.label}
              {tab.badge !== undefined && (
                <span
                  className={`ml-1.5 py-0.5 px-2 rounded-full text-[11px] font-semibold ${
                    isActive
                      ? 'bg-[#EFF6FF] text-[#2563EB]'
                      : 'bg-[#F1F5F9] text-[#64748B]'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
