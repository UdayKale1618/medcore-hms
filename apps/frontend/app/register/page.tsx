'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  HeartPulse,
  Mail,
  Lock,
  User,
  Phone,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Please provide your full legal name.');
      return;
    }

    if (!email.trim()) {
      setError('Please provide a valid email address.');
      return;
    }

    if (password.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      await api.post(
        '/auth/register',
        {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          password,
        },
        { skipAuth: true },
      );

      // Redirect to email OTP verification page with pre-filled email
      router.push(`/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}&registered=1`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setError(msg);
    } finally {
      setIsLoading(false);
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
          Patient Portal Registration
        </h1>
        <p className="mt-1 text-xs text-slate-600 max-w-sm mx-auto">
          Create your personal patient account to access medical records, doctor appointments, and prescriptions.
        </p>
      </div>

      {/* Main Registration Card */}
      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-sm border border-slate-200 rounded-2xl">
          {error && (
            <div
              className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2.5 animate-in fade-in duration-150"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <Input
              label="Full Name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Eleanor Vance"
              leftIcon={<User className="w-4 h-4" />}
              disabled={isLoading}
            />

            {/* Email Address */}
            <Input
              label="Email Address"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="eleanor@example.com"
              leftIcon={<Mail className="w-4 h-4" />}
              disabled={isLoading}
            />

            {/* Phone Number */}
            <Input
              label="Phone Number (Optional)"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              leftIcon={<Phone className="w-4 h-4" />}
              disabled={isLoading}
            />

            {/* Password */}
            <Input
              label="Password (min. 8 characters)"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              leftIcon={<Lock className="w-4 h-4" />}
              disabled={isLoading}
            />

            {/* Confirm Password */}
            <Input
              label="Confirm Password"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
              leftIcon={<Lock className="w-4 h-4" />}
              disabled={isLoading}
            />

            {/* Patient Role Notice */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
              <span>
                <strong>Patient Self-Service:</strong> This portal is strictly for patient access. Hospital doctors, nurses, and administrative staff accounts are provisioned directly by hospital management.
              </span>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isLoading}
                disabled={isLoading}
                className="w-full justify-center shadow-xs"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Create Account &amp; Proceed to Verification
              </Button>
            </div>

            {/* Back to Sign In */}
            <div className="pt-3 text-center text-xs text-slate-600">
              <span>Already registered? </span>
              <Link
                href="/login"
                className="font-semibold text-blue-600 hover:text-blue-800 hover:underline"
              >
                Sign In to MedCore
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
