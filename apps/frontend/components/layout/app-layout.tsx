'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { UserRole } from '@/lib/types';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export interface AppLayoutProps {
  children: React.ReactNode;
  requiredRole?: UserRole | UserRole[] | string[];
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  requiredRole,
}) => {
  const { user, isLoading } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F6F8FC] flex flex-col items-center justify-center p-4">
        <div className="flex items-center gap-3 bg-white px-6 py-5 rounded-2xl border border-[#EEF2F6] shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
          <Loader2 className="w-5 h-5 animate-spin text-[#2563EB]" />
          <span className="text-sm font-semibold text-[#111827]">
            Connecting to MedCore Hospital System...
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <>{children}</>;
  }

  // Check role authorization if requiredRole is specified
  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (user.role && !roles.includes(user.role)) {
      return (
        <div className="min-h-screen bg-[#F6F8FC] flex">
          <Sidebar
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
          />
          <div className="flex-1 flex flex-col min-w-0 lg:pl-64 transition-all duration-200">
            <Header onMenuToggle={() => setIsSidebarOpen((prev) => !prev)} />
            <main className="flex-1 p-8 max-w-4xl w-full mx-auto flex items-center justify-center">
              <div className="bg-white p-8 rounded-2xl border border-[#FEE2E2] shadow-[0_4px_16px_rgba(15,23,42,0.06)] text-center max-w-md">
                <div className="w-12 h-12 rounded-xl bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center mx-auto mb-4">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-bold text-[#111827] mb-2">Restricted Access Module</h2>
                <p className="text-xs text-[#64748B] mb-6">
                  Your current account role (<strong>{user.role}</strong>) does not have authorization to view this department.
                </p>
                <Link href="/dashboard">
                  <Button variant="primary">Return to Dashboard</Button>
                </Link>
              </div>
            </main>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen bg-[#F6F8FC] flex">
      {/* Left Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64 transition-all duration-200">
        <Header onMenuToggle={() => setIsSidebarOpen((prev) => !prev)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
