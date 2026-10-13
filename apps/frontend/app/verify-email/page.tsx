'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  HeartPulse,
  KeyRound,
  Mail,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

export default function VerifyEmailPage() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const router = useRouter();

  // Read URL query parameters on client mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const emailParam = params.get('email');
      const registeredParam = params.get('registered');

      if (emailParam || registeredParam) {
        const timer = setTimeout(() => {
          if (emailParam) {
            setEmail(emailParam);
          }
          if (registeredParam === '1') {
            setSuccessInfo('Registration completed. Enter the 6-digit passcode sent to your email.');
          }
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !otp.trim()) {
      setError('Please provide both your registered email and the 6-digit OTP code.');
      return;
    }

    if (otp.trim().length !== 6) {
      setError('The verification passcode must be exactly 6 digits.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      await api.post('/auth/verify-email', { email: email.trim(), otp: otp.trim() }, { skipAuth: true });
      router.push('/login?verified=1');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid or expired verification OTP.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!email.trim()) {
      setError('Please enter your email address to resend a verification code.');
      return;
    }

    setError(null);
    setIsResending(true);

    try {
      await api.post('/auth/send-verification-otp', { email: email.trim() }, { skipAuth: true });
      setSuccessInfo('A new 6-digit verification code has been dispatched to your email.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resend code. Please try again.';
      setError(msg);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FC] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/login" className="inline-flex items-center justify-center gap-2 mb-4 group">
          <div className="w-12 h-12 rounded-xl bg-[#2563EB] text-white shadow-md flex items-center justify-center transition-transform group-hover:scale-105">
            <HeartPulse className="w-6 h-6 text-teal-400" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-900">MedCore</span>
          <span className="text-xs uppercase font-extrabold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
            HMS
          </span>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Verify Email Address
        </h1>
        <p className="mt-1 text-xs text-slate-600 max-w-sm mx-auto">
          Confirm your identity with the 6-digit one-time passcode sent to your registered inbox.
        </p>
      </div>

      {/* Main Verification Card */}
      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-sm border border-slate-200 rounded-2xl">
          {successInfo && (
            <div
              className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-start gap-2.5 animate-in fade-in duration-150"
              role="status"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>{successInfo}</span>
            </div>
          )}

          {error && (
            <div
              className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2.5 animate-in fade-in duration-150"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            <Input
              label="Registered Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="patient@example.com"
              leftIcon={<Mail className="w-4 h-4" />}
              disabled={isLoading}
            />

            <Input
              label="6-Digit Verification Code"
              type="text"
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value.trim().replace(/\D/g, ''))}
              placeholder="123456"
              maxLength={6}
              leftIcon={<KeyRound className="w-4 h-4" />}
              disabled={isLoading}
            />

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-500">Didn&apos;t receive code?</span>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={isResending || isLoading}
                className="font-semibold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isResending ? 'animate-spin' : ''}`} />
                {isResending ? 'Sending...' : 'Resend Code'}
              </button>
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
                Confirm &amp; Verify Email
              </Button>
            </div>

            <div className="pt-3 text-center text-xs text-slate-600 flex items-center justify-center gap-4">
              <Link
                href="/login"
                className="inline-flex items-center text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Sign In
              </Link>
              <span>•</span>
              <Link
                href="/register"
                className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
              >
                Register
              </Link>
            </div>
          </form>
        </div>

        {/* Security Compliance Footer */}
        <div className="mt-6 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>HIPAA &amp; NABH Compliant Clinical Information System</span>
        </div>
      </div>
    </div>
  );
}
