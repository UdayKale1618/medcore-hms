import React from 'react';

export const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  ...props
}) => {
  return (
    <div
      className={`animate-pulse bg-[#E2E8F0]/70 rounded-xl ${className}`}
      {...props}
    />
  );
};

export const StatSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl border border-[#EEF2F6] p-5 space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
};

export const CardSkeleton = StatSkeleton;

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 6,
}) => {
  return (
    <div className="w-full bg-white rounded-2xl border border-[#EEF2F6] overflow-hidden">
      <div className="bg-[#F8FAFC] border-b border-[#EEF2F6] p-4 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-[#EEF2F6] p-4 space-y-4">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 pt-2">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export const ChartSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl border border-[#EEF2F6] p-6 space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-8 w-44 rounded-lg" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
};

export const ProfileSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl border border-[#EEF2F6] p-6 space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="w-16 h-16 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 pt-3">
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-10 rounded-xl" />
      </div>
    </div>
  );
};
