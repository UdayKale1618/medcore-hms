'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HeartPulse, Lock, Key, ArrowRight, ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

export default function ResetPasswordPage() {
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newPassword) {
      setError('Please provide the reset token and your new password.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      await api.post('/auth/reset-password', { token, newPassword }, { skipAuth: true });
      router.push('/login?reset=1');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid or expired reset token';
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
          Create New Password
        </h1>
        <p className="mt-1 text-xs text-slate-600">
          Set a secure clinical password for your MedCore account.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-sm border border-slate-200 rounded-xl">
          <form onSubmit={handleReset} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            <Input
              label="Reset Security Token"
              type="text"
              required
              value={token}
              onChange={(e) => setToken(e.target.value.trim())}
              placeholder="Paste token received via email"
              leftIcon={<Key className="w-4 h-4" />}
              disabled={isLoading}
            />

            <Input
              label="New Password"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              leftIcon={<Lock className="w-4 h-4" />}
              disabled={isLoading}
            />

            <Input
              label="Confirm New Password"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              leftIcon={<Lock className="w-4 h-4" />}
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
                Update Password
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
        </div>
      </div>
    </div>
  );
}
