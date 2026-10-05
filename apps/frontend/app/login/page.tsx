'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  HeartPulse,
  Mail,
  Lock,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Building,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide your staff or patient email and password.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid login credentials';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FC] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Hospital System Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#2563EB] text-white shadow-xs mb-3.5">
          <HeartPulse className="w-6 h-6 text-white" />
        </div>
        <div className="flex items-center justify-center gap-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
            MedCore
          </h1>
          <span className="text-xs uppercase font-bold text-[#0D9488] bg-[#F0FDFA] px-2 py-0.5 rounded-full border border-[#CCFBF1]">
            HMS
          </span>
        </div>
        <p className="mt-1.5 text-xs sm:text-sm text-[#64748B] font-medium">
          Hospital Information &amp; Clinical Management Portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-[0_12px_40px_rgba(15,23,42,0.06)] border border-[#EEF2F6] rounded-2xl">
          {error && (
            <div
              className="mb-6 p-3.5 bg-[#FEF2F2] border border-[#FEE2E2] text-[#DC2626] rounded-xl text-xs flex items-start gap-2.5 animate-in fade-in duration-150"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Staff / Patient Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. doctor@apollo.com"
              leftIcon={<Mail className="w-4 h-4" />}
            />

            <Input
              label="Password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              leftIcon={<Lock className="w-4 h-4" />}
            />

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-[#64748B]">
                <input
                  type="checkbox"
                  className="rounded border-[#E5E7EB] text-[#2563EB] focus:ring-[#2563EB]/20"
                />
                Remember me
              </label>
              <Link
                href="/forgot-password"
                className="font-semibold text-[#2563EB] hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isLoading}
                className="w-full justify-center shadow-xs"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Sign In to MedCore
              </Button>
            </div>
          </form>

          {/* Quick Demo Access Bar */}
          <div className="mt-6 pt-6 border-t border-[#EEF2F6]">
            <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-[#94A3B8]" /> Quick Demo Accounts
            </p>
            <div className="grid grid-cols-3 gap-1.5 text-[11px]">
              {[
                { role: 'Super Admin', email: 'superadmin@medcore.com' },
                { role: 'Hospital Admin', email: 'admin@apollo.com' },
                { role: 'Doctor', email: 'doctor@apollo.com' },
                { role: 'Nurse', email: 'nurse@apollo.com' },
                { role: 'Receptionist', email: 'receptionist@apollo.com' },
                { role: 'Lab Tech', email: 'lab@apollo.com' },
                { role: 'Pharmacist', email: 'pharmacy@apollo.com' },
                { role: 'Accountant', email: 'accountant@apollo.com' },
                { role: 'Patient', email: 'patient@apollo.com' },
              ].map((acc) => (
                <button
                  key={acc.role}
                  type="button"
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword('Password123!');
                  }}
                  className="p-1.5 text-left rounded-xl border border-[#EEF2F6] hover:border-[#2563EB]/40 hover:bg-[#EFF6FF]/40 transition-colors"
                >
                  <span className="font-bold text-[#111827] block truncate">{acc.role}</span>
                  <span className="text-[#94A3B8] text-[10px] truncate block">{acc.email.split('@')[0]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Security Compliance Footer */}
        <div className="mt-6 text-center text-xs text-[#64748B] flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#16A34A]" />
          <span>HIPAA &amp; NABH Compliant Clinical Information System</span>
        </div>
      </div>
    </div>
  );
}
