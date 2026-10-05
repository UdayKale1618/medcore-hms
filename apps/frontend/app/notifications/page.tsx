'use client';

import React, { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useSocket } from '@/lib/socket-context';
import { useToast } from '@/lib/toast-context';
import { api, ApiError } from '@/lib/api';
import { Notification } from '@/lib/types';
import {
  Bell,
  CheckCheck,
  Calendar,
  Pill,
  FlaskConical,
  Receipt,
  CreditCard,
  CheckCircle,
  ExternalLink,
  Clock,
  Filter,
} from 'lucide-react';
import Link from 'next/link';

export default function NotificationsPage() {
  const { unreadCount, markAsRead, markAllAsRead } = useSocket();
  const { toast } = useToast();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    let ignore = false;
    async function loadNotifications() {
      try {
        const res = await api.get<{
          success?: boolean;
          data?: { notifications: Notification[]; unreadCount: number };
          notifications?: Notification[];
        }>('/notifications?limit=50');

        if (!ignore) {
          const list = res.data?.notifications || (res as unknown as { notifications: Notification[] }).notifications || (Array.isArray(res) ? res : []);
          setNotifications(list);
        }
      } catch (err) {
        if (!ignore) {
          const error = err as ApiError;
          toast.error(error.message || 'Failed to load notifications');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadNotifications();
    return () => {
      ignore = true;
    };
  }, [toast]);

  const handleMarkOne = async (id: string) => {
    await markAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const handleMarkAll = async () => {
    await markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    toast.success('All notifications marked as read');
  };

  const getNotificationIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case 'APPOINTMENT_SCHEDULED':
      case 'APPOINTMENT_CANCELLED':
      case 'APPOINTMENT_REMINDER':
      case 'APPOINTMENT':
        return <Calendar className="w-5 h-5 text-blue-600" />;
      case 'PRESCRIPTION_ISSUED':
      case 'MEDICINE_DISPENSED':
      case 'PRESCRIPTION':
        return <Pill className="w-5 h-5 text-teal-600" />;
      case 'LAB_ORDER_CREATED':
      case 'LAB_RESULT_AVAILABLE':
      case 'LABORATORY':
        return <FlaskConical className="w-5 h-5 text-purple-600" />;
      case 'INVOICE_GENERATED':
      case 'BILLING':
        return <Receipt className="w-5 h-5 text-amber-600" />;
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT':
        return <CreditCard className="w-5 h-5 text-emerald-600" />;
      default:
        return <Bell className="w-5 h-5 text-slate-600" />;
    }
  };

  const getActionLink = (n: Notification) => {
    const type = n.type.toUpperCase();
    if (type.includes('APPOINTMENT')) return '/appointments';
    if (type.includes('PRESCRIPTION') || type.includes('MEDICINE')) return '/prescriptions';
    if (type.includes('LAB')) return '/laboratory';
    if (type.includes('INVOICE') || type.includes('BILLING')) return '/billing';
    if (type.includes('PAYMENT')) return '/payments';
    return null;
  };

  const filtered = notifications.filter((n) => {
    if (filter === 'unread' && n.isRead) return false;
    if (filter === 'read' && !n.isRead) return false;
    if (typeFilter !== 'all' && !n.type.toLowerCase().includes(typeFilter.toLowerCase())) return false;
    return true;
  });

  return (
    <AppLayout>
      <PageHeader
        title="Notification Center"
        subtitle="Real-time clinical events, patient appointments, test reports, and billing updates"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Notifications' },
        ]}
        actions={
          unreadCount > 0 ? (
            <Button variant="outline" onClick={handleMarkAll}>
              <CheckCheck className="w-4 h-4 mr-1.5 text-teal-600" />
              Mark All as Read ({unreadCount})
            </Button>
          ) : undefined
        }
      />

      {/* Filter and Tab bar */}
      <Card className="mb-6">
        <CardContent className="p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                filter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                filter === 'unread' ? 'bg-white text-teal-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Unread ({notifications.filter((n) => !n.isRead).length})
            </button>
            <button
              onClick={() => setFilter('read')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                filter === 'read' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Read ({notifications.filter((n) => n.isRead).length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded border border-slate-300 px-2.5 py-1 text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-600"
            >
              <option value="all">All Event Categories</option>
              <option value="appointment">Appointments</option>
              <option value="prescription">Prescriptions</option>
              <option value="lab">Laboratory Orders</option>
              <option value="invoice">Invoices & Billing</option>
              <option value="payment">Payments</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Notifications Feed */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No Notifications"
          description={
            filter === 'unread'
              ? 'You have caught up with all incoming clinical alerts.'
              : 'No notification records match your selected criteria.'
          }
        />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((item) => {
            const actionLink = getActionLink(item);
            return (
              <div
                key={item.id}
                className={`p-4 rounded-lg border transition-all flex items-start justify-between gap-4 ${
                  !item.isRead
                    ? 'bg-blue-50/40 border-blue-200 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      !item.isRead ? 'bg-white shadow-xs border border-blue-100' : 'bg-slate-100'
                    }`}
                  >
                    {getNotificationIcon(item.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4
                        className={`text-sm ${
                          !item.isRead ? 'font-bold text-slate-900' : 'font-medium text-slate-800'
                        }`}
                      >
                        {item.title}
                      </h4>
                      {!item.isRead && (
                        <span className="w-2 h-2 rounded-full bg-teal-600 inline-block" />
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{item.message}</p>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(item.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="capitalize px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px]">
                        {item.type.replace(/_/g, ' ').toLowerCase()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 pt-1">
                  {actionLink && (
                    <Link href={actionLink}>
                      <Button variant="outline" size="sm">
                        <ExternalLink className="w-3.5 h-3.5 mr-1" />
                        Open
                      </Button>
                    </Link>
                  )}
                  {!item.isRead && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkOne(item.id)}
                      title="Mark as read"
                    >
                      <CheckCircle className="w-4 h-4 text-slate-400 hover:text-teal-600" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
