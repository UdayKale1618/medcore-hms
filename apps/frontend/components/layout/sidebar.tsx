'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Calendar,
  FileText,
  Pill,
  FlaskConical,
  CreditCard,
  Bell,
  LogOut,
  Building,
  Building2,
  Stethoscope,
  Activity,
  HeartPulse,
  Settings,
  Package,
  Layers,
  ClipboardList,
  DollarSign,
  User,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useSocket } from '@/lib/socket-context';
import type { UserRole } from '@/lib/types';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

export const Sidebar: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { unreadCount } = useSocket();

  const userRole = (user?.role || 'PATIENT') as UserRole;

  // Role-specific navigation definitions strictly matching Section 8 of the prompt
  const getNavItemsForRole = (): NavItem[] => {
    switch (userRole) {
      case 'SUPER_ADMIN':
        return [
          { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Hospitals', href: '/dashboard', icon: <Building2 className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Users', href: '/patients', icon: <Users className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Departments', href: '/doctors', icon: <Layers className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Doctors', href: '/doctors', icon: <UserCheck className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Patients', href: '/patients', icon: <Users className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Appointments', href: '/appointments', icon: <Calendar className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Laboratory', href: '/laboratory', icon: <FlaskConical className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Pharmacy', href: '/pharmacy', icon: <Pill className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Billing', href: '/billing', icon: <CreditCard className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Notifications', href: '/notifications', icon: <Bell className="w-[18px] h-[18px] shrink-0" />, badge: unreadCount > 0 ? unreadCount : undefined },
          { label: 'Settings', href: '/settings', icon: <Settings className="w-[18px] h-[18px] shrink-0" /> },
        ];

      case 'HOSPITAL_ADMIN':
        return [
          { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Patients', href: '/patients', icon: <Users className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Doctors', href: '/doctors', icon: <UserCheck className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Departments', href: '/doctors', icon: <Building className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Appointments', href: '/appointments', icon: <Calendar className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Laboratory', href: '/laboratory', icon: <FlaskConical className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Pharmacy', href: '/pharmacy', icon: <Pill className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Billing', href: '/billing', icon: <CreditCard className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Notifications', href: '/notifications', icon: <Bell className="w-[18px] h-[18px] shrink-0" />, badge: unreadCount > 0 ? unreadCount : undefined },
          { label: 'Settings', href: '/settings', icon: <Settings className="w-[18px] h-[18px] shrink-0" /> },
        ];

      case 'DOCTOR':
        return [
          { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'My Appointments', href: '/appointments', icon: <Calendar className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Patients', href: '/patients', icon: <Users className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Medical Records', href: '/medical-records', icon: <FileText className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Prescriptions', href: '/prescriptions', icon: <Stethoscope className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Lab Orders', href: '/laboratory', icon: <FlaskConical className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Notifications', href: '/notifications', icon: <Bell className="w-[18px] h-[18px] shrink-0" />, badge: unreadCount > 0 ? unreadCount : undefined },
        ];

      case 'NURSE':
        return [
          { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Patients', href: '/patients', icon: <Users className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Appointments', href: '/appointments', icon: <Calendar className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Medical Records', href: '/medical-records', icon: <FileText className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Notifications', href: '/notifications', icon: <Bell className="w-[18px] h-[18px] shrink-0" />, badge: unreadCount > 0 ? unreadCount : undefined },
        ];

      case 'RECEPTIONIST':
        return [
          { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Patients', href: '/patients', icon: <Users className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Appointments', href: '/appointments', icon: <Calendar className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Doctors', href: '/doctors', icon: <UserCheck className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Billing', href: '/billing', icon: <CreditCard className="w-[18px] h-[18px] shrink-0" /> },
        ];

      case 'LAB_TECHNICIAN':
        return [
          { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Lab Orders', href: '/laboratory', icon: <FlaskConical className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Results', href: '/laboratory', icon: <ClipboardList className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Patients', href: '/patients', icon: <Users className="w-[18px] h-[18px] shrink-0" /> },
        ];

      case 'PHARMACIST':
        return [
          { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Medicines', href: '/pharmacy', icon: <Pill className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Inventory', href: '/pharmacy', icon: <Package className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Prescriptions', href: '/prescriptions', icon: <FileText className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Dispensing', href: '/pharmacy', icon: <Activity className="w-[18px] h-[18px] shrink-0" /> },
        ];

      case 'ACCOUNTANT':
        return [
          { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Invoices', href: '/billing', icon: <CreditCard className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Payments', href: '/payments', icon: <DollarSign className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Billing', href: '/billing', icon: <FileText className="w-[18px] h-[18px] shrink-0" /> },
        ];

      case 'PATIENT':
      default:
        return [
          { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Appointments', href: '/appointments', icon: <Calendar className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Medical Records', href: '/medical-records', icon: <FileText className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Prescriptions', href: '/prescriptions', icon: <Stethoscope className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Lab Reports', href: '/laboratory', icon: <FlaskConical className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Billing', href: '/billing', icon: <CreditCard className="w-[18px] h-[18px] shrink-0" /> },
          { label: 'Notifications', href: '/notifications', icon: <Bell className="w-[18px] h-[18px] shrink-0" />, badge: unreadCount > 0 ? unreadCount : undefined },
          { label: 'Profile', href: '/settings', icon: <User className="w-[18px] h-[18px] shrink-0" /> },
        ];
    }
  };

  const navItems = getNavItemsForRole();

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#0F172A]/40 backdrop-blur-[2px] lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-white text-[#111827] border-r border-[#EEF2F6] flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-[68px] px-6 flex items-center gap-3 border-b border-[#EEF2F6] bg-white">
          <div className="w-10 h-10 rounded-xl bg-[#2563EB] flex items-center justify-center text-white shadow-xs">
            <HeartPulse className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[17px] font-bold tracking-tight text-[#111827]">
                MedCore
              </span>
              <span className="text-[10px] uppercase font-bold text-[#0D9488] bg-[#F0FDFA] px-1.5 py-0.5 rounded-full border border-[#CCFBF1]">
                HMS
              </span>
            </div>
            <p className="text-[11px] text-[#64748B] truncate font-medium">
              {user?.hospitalName || 'Apollo Specialty Hospital'}
            </p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3.5 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
            Navigation
          </div>
          {navItems.map((item, idx) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));

            return (
              <Link
                key={`${item.href}-${idx}`}
                href={item.href}
                onClick={() => onClose()}
                className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-[#EFF6FF] text-[#2563EB] font-semibold shadow-[0_1px_2px_rgba(37,99,235,0.06)]'
                    : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#111827]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`transition-colors ${
                      isActive ? 'text-[#2563EB]' : 'text-[#64748B] group-hover:text-[#111827]'
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-[#2563EB] text-white">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Card & Logout Footer */}
        <div className="p-3.5 border-t border-[#EEF2F6] bg-white">
          <div className="px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#EEF2F6] flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <p className="text-xs font-semibold text-[#111827] truncate">
                {user?.name || user?.email || 'Logged In'}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#0D9488]">
                  {userRole.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
            <button
              onClick={() => logout()}
              title="Sign Out"
              className="text-[#94A3B8] hover:text-[#DC2626] p-1.5 rounded-lg hover:bg-white transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
