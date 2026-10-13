'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HeartPulse, KeyRound, Mail, ArrowRight, ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

export default function VerifyOtpPage() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !otp) {
      setError('Please provide both email and 6-digit OTP code.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      await api.post('/auth/verify-otp', { email, otp }, { skipAuth: true });
      router.push('/login?verified=1');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid or expired OTP code';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FC] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#2563EB] text-white shadow-md mb-4">
          <HeartPulse className="w-6 h-6 text-teal-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Verify Security OTP
        </h1>
        <p className="mt-1 text-xs text-slate-600">
          Enter the one-time verification passcode sent to your email.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-sm border border-slate-200 rounded-xl">
          <form onSubmit={handleVerify} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            <Input
              label="Registered Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@hospital.com"
              leftIcon={<Mail className="w-4 h-4" />}
              disabled={isLoading}
            />

            <Input
              label="6-Digit OTP Passcode"
              type="text"
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value.trim())}
              placeholder="123456"
              maxLength={6}
              leftIcon={<KeyRound className="w-4 h-4" />}
              disabled={isLoading}
            />

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isLoading}
                className="w-full justify-center"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Verify Code
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
      </div>
    </div>
  );
}
