import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  breadcrumbs,
  actions,
}) => {
  return (
    <div className="mb-7 space-y-2">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex items-center space-x-1.5 text-xs text-[#64748B]">
          <Link href="/dashboard" className="hover:text-[#111827] transition-colors">
            MedCore
          </Link>
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-[#111827] transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-[#111827] font-medium">{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-[28px] sm:text-[30px] font-bold tracking-tight text-[#111827] leading-tight">
            {title}
          </h1>
          {subtitle && <p className="text-sm text-[#64748B] mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
      </div>
    </div>
  );
};
