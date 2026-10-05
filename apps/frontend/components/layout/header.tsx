'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu,
  Search,
  Bell,
  Check,
  CheckCheck,
  Shield,
  LogOut,
  Clock,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useSocket } from '@/lib/socket-context';
import { GlobalSearchModal } from './global-search';

export const Header: React.FC<{
  onMenuToggle: () => void;
}> = ({ onMenuToggle }) => {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useSocket();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Global Ctrl/Cmd + K shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getPageTitle = () => {
    if (pathname.startsWith('/dashboard')) return 'Dashboard';
    if (pathname.startsWith('/patients')) return 'Patients';
    if (pathname.startsWith('/appointments')) return 'Appointments';
    if (pathname.startsWith('/doctors')) return 'Doctors & Specialists';
    if (pathname.startsWith('/medical-records')) return 'Medical Records';
    if (pathname.startsWith('/prescriptions')) return 'Prescriptions';
    if (pathname.startsWith('/pharmacy')) return 'Pharmacy';
    if (pathname.startsWith('/laboratory')) return 'Laboratory';
    if (pathname.startsWith('/billing')) return 'Billing & Invoices';
    if (pathname.startsWith('/payments')) return 'Payments & Collections';
    if (pathname.startsWith('/notifications')) return 'Notifications';
    if (pathname.startsWith('/settings')) return 'Settings & Profile';
    return 'MedCore HMS';
  };

  return (
    <>
      <header className="sticky top-0 z-30 h-[68px] bg-white border-b border-[#EEF2F6] px-4 sm:px-8 flex items-center justify-between gap-4">
        {/* Left Section: Mobile Menu + Context Title */}
        <div className="flex items-center gap-3.5 min-w-0">
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 rounded-xl text-[#64748B] hover:text-[#111827] hover:bg-[#F8FAFC] transition-colors"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h2 className="text-[17px] font-bold text-[#111827] tracking-tight truncate">
              {getPageTitle()}
            </h2>
          </div>
        </div>

        {/* Center / Right Section */}
        <div className="flex items-center gap-3.5">
          {/* Reference Search Pill (height 42-46px, bg #F8FAFC, border #E5E7EB, radius 12px) */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="hidden sm:flex items-center gap-2.5 px-4 h-11 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] text-xs text-[#94A3B8] hover:border-[#CBD5E1] hover:text-[#64748B] transition-all duration-150 shadow-[0_1px_2px_rgba(15,23,42,0.02)]"
          >
            <Search className="w-4 h-4 text-[#94A3B8]" />
            <span className="w-44 text-left">Search hospital records...</span>
            <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-white border border-[#E5E7EB] rounded-md text-[#64748B] shadow-2xs">
              Ctrl+K
            </kbd>
          </button>

          <button
            onClick={() => setIsSearchOpen(true)}
            className="sm:hidden p-2.5 text-[#64748B] hover:text-[#111827] rounded-xl hover:bg-[#F8FAFC]"
            aria-label="Search"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setIsNotificationsOpen((prev) => !prev);
                setIsUserMenuOpen(false);
              }}
              className="relative p-2.5 text-[#64748B] hover:text-[#111827] rounded-xl hover:bg-[#F8FAFC] transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-[#2563EB] text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {isNotificationsOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsNotificationsOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-[#EEF2F6] shadow-[0_12px_40px_rgba(15,23,42,0.12)] z-40 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  <div className="p-3.5 bg-[#F8FAFC] border-b border-[#EEF2F6] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#111827] uppercase tracking-wide">
                        Hospital Alerts
                      </span>
                      {unreadCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB] text-[10px] font-semibold border border-[#DBEAFE]">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllAsRead()}
                        className="text-xs text-[#2563EB] hover:underline flex items-center gap-1 font-medium"
                      >
                        <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-[#EEF2F6]">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-[#64748B]">
                        No notifications at this time
                      </div>
                    ) : (
                      notifications.slice(0, 6).map((n) => (
                        <div
                          key={n.id}
                          className={`p-3.5 text-left transition-colors flex items-start justify-between gap-2.5 ${
                            n.isRead ? 'bg-white opacity-70' : 'bg-[#EFF6FF]/40'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-[#111827] leading-tight">
                              {n.title}
                            </p>
                            <p className="text-xs text-[#64748B] mt-0.5 line-clamp-2 leading-relaxed">
                              {n.message}
                            </p>
                            <span className="text-[10px] text-[#94A3B8] mt-1.5 flex items-center gap-1 font-medium">
                              <Clock className="w-3 h-3" />
                              {new Date(n.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          {!n.isRead && (
                            <button
                              onClick={() => markAsRead(n.id)}
                              title="Mark read"
                              className="text-[#94A3B8] hover:text-[#0D9488] p-1 shrink-0"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-2.5 bg-[#F8FAFC] border-t border-[#EEF2F6] text-center">
                    <Link
                      href="/notifications"
                      onClick={() => setIsNotificationsOpen(false)}
                      className="text-xs font-semibold text-[#2563EB] hover:underline"
                    >
                      View All Notifications
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* User Profile Menu */}
          <div className="relative">
            <button
              onClick={() => {
                setIsUserMenuOpen((prev) => !prev);
                setIsNotificationsOpen(false);
              }}
              className="flex items-center gap-2.5 p-1 rounded-full hover:bg-[#F8FAFC] text-left transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-[#EFF6FF] border border-[#DBEAFE] text-[#2563EB] flex items-center justify-center font-bold text-sm shadow-xs">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
            </button>

            {isUserMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsUserMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl border border-[#EEF2F6] shadow-[0_12px_40px_rgba(15,23,42,0.12)] z-40 overflow-hidden animate-in fade-in zoom-in-95 duration-150 py-1.5">
                  <div className="px-4 py-3 border-b border-[#EEF2F6] bg-[#F8FAFC]/50">
                    <p className="text-xs font-bold text-[#111827]">{user?.name}</p>
                    <p className="text-[11px] text-[#64748B] truncate mt-0.5">{user?.email}</p>
                    <span className="inline-block mt-1.5 text-[10px] font-semibold text-[#0D9488] bg-[#F0FDFA] border border-[#CCFBF1] px-2 py-0.5 rounded-full">
                      {user?.role?.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <Link
                    href="/dashboard"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-[#334155] hover:bg-[#F8FAFC] transition-colors"
                  >
                    <Shield className="w-4 h-4 text-[#94A3B8]" />
                    Dashboard
                  </Link>

                  <Link
                    href="/notifications"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-[#334155] hover:bg-[#F8FAFC] transition-colors"
                  >
                    <Bell className="w-4 h-4 text-[#94A3B8]" />
                    Notifications
                  </Link>

                  <div className="border-t border-[#EEF2F6] my-1" />

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-[#DC2626] hover:bg-[#FEF2F2] transition-colors font-medium"
                  >
                    <LogOut className="w-4 h-4 text-[#DC2626]" />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Global Search Dialog */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </>
  );
};
