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
      {/* LEFT COLUMN: Premium Navy Healthcare Branding Panel (~48%)   */}
      {/* ============================================================ */}
      <div
        className="hidden lg:flex lg:w-[48%] relative flex-col justify-between p-10 xl:p-14 overflow-hidden text-white"
        style={{ background: 'linear-gradient(160deg, #0B1535 0%, #101D40 45%, #16264A 100%)' }}
      >
        {/* ── Decorative background layer (non-interactive) ── */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">

          {/* Extremely subtle dotted grid */}
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: 'radial-gradient(circle, #60A5FA 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />

          {/* Soft radial navy/blue lighting — top-left */}
          <div className="absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full bg-[#60A5FA]/10 blur-3xl" />
          {/* Faint teal glow — right-mid */}
          <div className="absolute top-[40%] -right-28 w-[360px] h-[360px] rounded-full bg-[#2DD4BF]/8 blur-3xl" />
          {/* Deep navy shadow — bottom */}
          <div className="absolute -bottom-28 left-1/4 w-[420px] h-[420px] rounded-full bg-[#263D67]/40 blur-3xl" />

          {/* SVG Medical Line Art */}
          <svg
            className="absolute inset-0 w-full h-full"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 600 800"
            fill="none"
          >
            {/* Large concentric dashed rings — behind headline area */}
            <circle cx="490" cy="220" r="200" stroke="#60A5FA" strokeWidth="0.8" strokeDasharray="5 8" opacity="0.12" />
            <circle cx="490" cy="220" r="140" stroke="#60A5FA" strokeWidth="0.8" opacity="0.10" />
            <circle cx="490" cy="220" r="80"  stroke="#2DD4BF" strokeWidth="0.8" opacity="0.13" />

            {/* Medical cross watermark — lower left */}
            <path
              d="M90 490 H148 V432 H190 V490 H248 V532 H190 V590 H148 V532 H90 Z"
              stroke="#60A5FA"
              strokeWidth="0.9"
              strokeDasharray="4 6"
              opacity="0.08"
            />

            {/* EKG / heartbeat line — bottom strip */}
            <path
              d="M0 660 H155 L175 628 L196 696 L225 592 L246 682 L266 644 L284 660 H600"
              stroke="#60A5FA"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.22"
            />
          </svg>
        </div>

        {/* ── Top Brand Header ── */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div
              className="inline-flex items-center justify-center w-11 h-11 rounded-xl border border-[#60A5FA]/20 shadow-sm"
              style={{ background: 'rgba(96,165,250,0.08)' }}
            >
              <HeartPulse className="w-6 h-6 text-[#60A5FA]" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold tracking-tight text-white">MedCore</span>
              <span
                className="text-[11px] uppercase tracking-wider font-extrabold text-[#2DD4BF] px-2.5 py-0.5 rounded-full border border-[#2DD4BF]/30"
                style={{ background: 'rgba(45,212,191,0.08)' }}
              >
                HMS
              </span>
            </div>
          </div>
        </div>

        {/* ── Center Hero & Tagline ── */}
        <div className="relative z-10 my-auto py-10 max-w-lg">

          {/* Outlined enterprise badge */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium mb-6"
            style={{
              borderColor: 'rgba(96,165,250,0.25)',
              background: 'rgba(96,165,250,0.07)',
              color: '#D5DEEF',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#2DD4BF] animate-pulse" />
            <span>Enterprise Hospital Information System</span>
          </div>

          {/* Main headline */}
          <h2 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-white leading-tight">
            Connected Care.
            <span className="block" style={{ color: '#2DD4BF' }}>Smarter Hospitals.</span>
          </h2>

          {/* Supporting description */}
          <p className="mt-4 text-sm xl:text-[15px] leading-relaxed font-normal" style={{ color: '#D5DEEF' }}>
            A comprehensive, multi-tenant clinical suite orchestrating inpatient management,
            real-time diagnostics, electronic prescriptions, and synchronized healthcare operations.
          </p>

          {/* Three Clinical Pillars */}
          <div className="mt-8 space-y-2.5">
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
                className="flex items-start gap-3 p-3 rounded-xl transition-colors"
                style={{
                  background: 'rgba(22,38,74,0.60)',
                  border: '1px solid rgba(96,165,250,0.12)',
                }}
              >
                <div
                  className="p-2 rounded-lg shrink-0 mt-0.5"
                  style={{ background: 'rgba(96,165,250,0.10)' }}
                >
                  <feature.icon className="w-4 h-4" style={{ color: '#2DD4BF' }} />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-white">{feature.title}</h3>
                  <p className="text-[11px] mt-0.5" style={{ color: '#8FAAC8' }}>{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Left Bottom Footer ── */}
        <div
          className="relative z-10 pt-5 flex items-center justify-between text-xs"
          style={{ borderTop: '1px solid rgba(96,165,250,0.12)', color: '#8FAAC8' }}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" style={{ color: '#2DD4BF' }} />
            <span>99.99% Clinical Uptime Guaranteed</span>
          </div>
          <span className="text-[11px]" style={{ color: '#4A6080' }}>v2.4 Production</span>
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
