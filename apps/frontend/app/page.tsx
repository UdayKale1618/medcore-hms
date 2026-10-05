'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { HeartPulse, Loader2 } from 'lucide-react';

export default function RootPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [user, isLoading, router]);

  return (
    <div className="min-h-screen bg-[#F6F8FC] flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center gap-3 bg-white p-8 rounded-2xl border border-[#EEF2F6] shadow-sm max-w-sm w-full text-center">
        <div className="w-12 h-12 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shadow-xs">
          <HeartPulse className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-lg font-bold text-[#111827]">MedCore HMS</h2>
        <p className="text-xs text-[#64748B]">Initializing Hospital Management System...</p>
        <div className="flex items-center gap-2 text-xs text-[#64748B] mt-2">
          <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" />
          <span>Verifying credentials</span>
        </div>
      </div>
    </div>
  );
}
