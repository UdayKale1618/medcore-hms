'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HeartPulse, Mail, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please provide your registered email address.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      await api.post('/auth/forgot-password', { email }, { skipAuth: true });
      setSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to request password reset';
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
          Reset Password
        </h1>
        <p className="mt-1 text-xs text-slate-600">
          Enter your registered hospital email to receive reset instructions.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-sm border border-slate-200 rounded-xl">
          {success ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">
                Instructions Dispatched
              </h3>
              <p className="text-xs text-slate-600 max-w-xs mx-auto leading-relaxed">
                If an account exists for <span className="font-semibold">{email}</span>, you will receive password reset instructions.
              </p>
              <div className="pt-2 flex flex-col gap-2">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => router.push('/reset-password')}
                  className="w-full justify-center"
                >
                  Enter Reset Token
                </Button>
                <Link
                  href="/login"
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 py-1"
                >
                  Return to Login
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isLoading}
                  className="w-full justify-center"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Send Reset Link
                </Button>
              </div>

              <div className="pt-2 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
