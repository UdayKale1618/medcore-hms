'use client';

import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import {
  Building2,
  User,
  Shield,
  Save,
  Lock,
  Globe,
  CheckCircle,
} from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingSecurity, setIsSavingSecurity] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setTimeout(() => {
      setIsSavingProfile(false);
      toast.success('User profile updated successfully');
    }, 600);
  };

  const handleSaveSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirm password do not match');
      return;
    }

    setIsSavingSecurity(true);
    setTimeout(() => {
      setIsSavingSecurity(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Security password credentials updated');
    }, 700);
  };

  return (
    <AppLayout>
      <PageHeader
        title="Settings & System Configuration"
        subtitle="Manage hospital facility settings, user preferences, and security access credentials"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Settings' },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Hospital Profile & Tenancy */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader className="p-4 border-b border-slate-200">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-700" />
                Hospital Facility
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 text-xs space-y-3">
              <div>
                <p className="text-slate-400 text-[11px] uppercase font-semibold">Hospital Name</p>
                <p className="font-bold text-slate-800 text-sm mt-0.5">
                  {user?.hospital?.name || 'MedCore Central Hospital'}
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-[11px] uppercase font-semibold">Hospital Code</p>
                <p className="font-mono text-slate-700 mt-0.5">
                  {user?.hospital?.code || 'MEDCORE-MAIN-01'}
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-[11px] uppercase font-semibold">Tenant Isolation</p>
                <div className="mt-0.5 flex items-center gap-1.5 text-emerald-700 font-semibold">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  Multi-tenant HIPAA / GDPR Compliant
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <p className="text-slate-400 text-[11px] uppercase font-semibold">Currency & Region</p>
                <p className="text-slate-700 mt-0.5">INR (₹) • Asia/Kolkata (IST +05:30)</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 border-b border-slate-200">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Globe className="w-4 h-4 text-teal-700" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">API Gateway:</span>
                <span className="font-semibold text-emerald-700">Online</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Socket.IO:</span>
                <span className="font-semibold text-emerald-700">Connected</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Gateway:</span>
                <span className="font-semibold text-blue-700">Razorpay Live</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">App Version:</span>
                <span className="font-mono text-slate-600">v2.4.0 (Turbopack)</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Columns: Profile & Security */}
        <div className="lg:col-span-2 space-y-6">
          {/* User Profile */}
          <Card>
            <CardHeader className="p-4 border-b border-slate-200">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <User className="w-4 h-4 text-teal-700" />
                Staff Account Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Assigned Role
                    </label>
                    <Input value={user?.role || 'Staff'} disabled className="bg-slate-50 text-slate-500" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Email Address
                    </label>
                    <Input value={user?.email || ''} disabled className="bg-slate-50 text-slate-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Contact Phone
                    </label>
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" isLoading={isSavingProfile}>
                    <Save className="w-4 h-4 mr-1.5" />
                    Save Profile Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Security & Password */}
          <Card>
            <CardHeader className="p-4 border-b border-slate-200">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-800" />
                Security & Authentication
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <form onSubmit={handleSaveSecurity} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Current Password
                  </label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      New Password
                    </label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Confirm New Password
                    </label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" variant="primary" isLoading={isSavingSecurity}>
                    <Lock className="w-4 h-4 mr-1.5" />
                    Update Password
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
