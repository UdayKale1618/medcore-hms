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
  Activity,
  Stethoscope,
  CheckCircle2,
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
    <div className="min-h-screen bg-[#F6F8FC] flex flex-col lg:flex-row">
      {/* ============================================================ */}
      {/* LEFT COLUMN: Premium Healthcare Branding Panel (Desktop ~48%) */}
      {/* ============================================================ */}
      <div className="hidden lg:flex lg:w-[48%] relative flex-col justify-between p-10 xl:p-14 overflow-hidden bg-gradient-to-br from-[#1D4ED8] via-[#2563EB] to-[#0D9488] text-white">
        {/* Subtle Decorative Healthcare Background Shapes & Line Art */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          {/* Subtle medical grid dots */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          {/* Soft ambient blur spheres */}
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#60A5FA]/20 blur-3xl" />
          <div className="absolute top-1/2 -right-24 w-80 h-80 rounded-full bg-[#2DD4BF]/20 blur-3xl" />
          <div className="absolute -bottom-24 left-1/3 w-96 h-96 rounded-full bg-[#1D4ED8]/30 blur-3xl" />

          {/* Subtle Medical Line Art SVG */}
          <svg
            className="absolute inset-0 w-full h-full opacity-15"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 600 800"
            fill="none"
          >
            {/* Concentric healthcare connectivity circles */}
            <circle cx="480" cy="240" r="180" stroke="white" strokeWidth="1.5" strokeDasharray="6 6" />
            <circle cx="480" cy="240" r="120" stroke="white" strokeWidth="1.5" />
            <circle cx="480" cy="240" r="60" stroke="#5EEAD4" strokeWidth="1.5" />

            {/* Medical Plus / Cross watermark */}
            <path
              d="M120 480 H180 V420 H220 V480 H280 V520 H220 V580 H180 V520 H120 Z"
              stroke="white"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />

            {/* Continuous Pulse / EKG Wave across the panel */}
            <path
              d="M0 640 H160 L180 610 L200 680 L230 580 L250 670 L270 630 L290 640 H600"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Top Brand Header */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 shadow-xs">
              <HeartPulse className="w-6 h-6 text-white" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold tracking-tight text-white">
                MedCore
              </span>
              <span className="text-[11px] uppercase tracking-wider font-extrabold text-[#CCFBF1] bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20">
                HMS
              </span>
            </div>
          </div>
        </div>

        {/* Center Hero & Tagline */}
        <div className="relative z-10 my-auto py-10 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur-xs text-xs font-medium text-[#CCFBF1] mb-6">
            <span className="w-2 h-2 rounded-full bg-[#2DD4BF] animate-pulse" />
            <span>Enterprise Hospital Information System</span>
          </div>

          <h2 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-white leading-tight">
            Connected Care.
            <span className="block text-[#99F6E4]">Smarter Hospitals.</span>
          </h2>

          <p className="mt-4 text-sm xl:text-base text-blue-100/90 leading-relaxed font-normal">
            A comprehensive, multi-tenant clinical suite orchestrating inpatient management,
            real-time diagnostics, electronic prescriptions, and synchronized healthcare operations.
          </p>

          {/* Three Clinical Pillars */}
          <div className="mt-8 space-y-3">
            {[
              {
                icon: Activity,
                title: 'Unified Electronic Medical Records',
                desc: 'Instant longitudinal patient charts & vitals telemetry',
              },
              {
                icon: Stethoscope,
                title: 'Integrated Clinical Workflows',
                desc: 'Coordinated doctor, nurse, lab, and pharmacy pipelines',
              },
              {
                icon: ShieldCheck,
                title: 'Multi-Tenant Security Architecture',
                desc: 'Strict role-based isolation & HIPAA-ready auditability',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs transition-colors hover:bg-white/10"
              >
                <div className="p-2 rounded-lg bg-white/10 text-[#5EEAD4] shrink-0 mt-0.5">
                  <feature.icon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-white">
                    {feature.title}
                  </h3>
                  <p className="text-[11px] text-blue-100/80 mt-0.5">
                    {feature.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Left Bottom Footer */}
        <div className="relative z-10 pt-6 border-t border-white/15 flex items-center justify-between text-xs text-blue-100/80">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#5EEAD4]" />
            <span>99.99% Clinical Uptime Guaranteed</span>
          </div>
          <span className="text-[11px] text-blue-200/70">v2.4 Production</span>
        </div>
      </div>

      {/* ============================================================ */}
      {/* RIGHT COLUMN: Clean White / #F6F8FC Login Form (Desktop ~52%) */}
      {/* ============================================================ */}
      <div className="w-full lg:w-[52%] min-h-screen flex flex-col justify-center items-center py-10 px-4 sm:px-8 lg:px-10 xl:px-16 bg-[#F6F8FC]">
        <div className="w-full max-w-[460px]">
          {/* Mobile Header (Brand visible only when left panel is collapsed on mobile) */}
          <div className="lg:hidden text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#2563EB] text-white shadow-xs mb-3">
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
            <p className="mt-1 text-xs text-[#64748B] font-medium">
              Connected Care. Smarter Hospitals.
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-white py-7 sm:py-8 px-6 sm:px-9 shadow-[0_4px_24px_rgba(15,23,42,0.05)] border border-[#EEF2F6] rounded-2xl">
            <div className="mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-[#111827] tracking-tight">
                Staff &amp; Patient Portal
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-[#64748B]">
                Sign in with your verified clinical or patient credentials to continue.
              </p>
            </div>

            {error && (
              <div
                className="mb-5 p-3.5 bg-[#FEF2F2] border border-[#FEE2E2] text-[#DC2626] rounded-xl text-xs flex items-start gap-2.5 animate-in fade-in duration-150"
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

              <div className="flex items-center justify-between text-xs pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer text-[#64748B] select-none">
                  <input
                    type="checkbox"
                    className="rounded border-[#E5E7EB] text-[#2563EB] focus:ring-[#2563EB]/20"
                  />
                  <span>Remember me</span>
                </label>
                <Link
                  href="/forgot-password"
                  className="font-semibold text-[#2563EB] hover:text-[#1D4ED8] hover:underline"
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
            <div className="mt-6 pt-5 border-t border-[#EEF2F6]">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-[#94A3B8]" /> Quick Demo Accounts
                </p>
                <span className="text-[10px] text-[#94A3B8]">Click to autofill</span>
              </div>
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
                    className="p-1.5 text-left rounded-xl border border-[#EEF2F6] hover:border-[#2563EB]/40 hover:bg-[#EFF6FF]/50 transition-colors focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30 cursor-pointer"
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
            <ShieldCheck className="w-4 h-4 text-[#16A34A] shrink-0" />
            <span>HIPAA &amp; NABH Compliant Clinical Information System</span>
          </div>
        </div>
      </div>
    </div>
  );
}
