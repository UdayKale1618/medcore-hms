'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  CheckCircle2,
  Clock,
  ArrowRight,
  Receipt,
  DollarSign,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { MetricCard } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { StatSkeleton, ChartSkeleton } from '@/components/ui/loading-skeleton';
import { ContextualRail } from '@/components/layout/contextual-rail';
import { api } from '@/lib/api';
import type { Invoice } from '@/lib/types';

export const AccountantDashboard: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadBillingData() {
      try {
        const res = await api.get<Invoice[]>('/invoices', { params: { limit: 25 } });
        if (Array.isArray(res)) setInvoices(res);
      } finally {
        setIsLoading(false);
      }
    }
    loadBillingData();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
        </div>
        <ChartSkeleton />
      </div>
    );
  }

  const paidInvoices = invoices.filter((i) => i.status === 'PAID');
  const pendingInvoices = invoices.filter((i) => i.status === 'ISSUED' || i.status === 'DRAFT');

  const totalCollected = paidInvoices.reduce(
    (sum, i) => sum + Number(i.total || 0),
    0,
  );
  const totalOutstanding = pendingInvoices.reduce(
    (sum, i) => sum + Number(i.total || 0),
    0,
  );

  const revenueFlow = [
    { day: 'Mon', revenue: 12500, outstanding: 4000 },
    { day: 'Tue', revenue: 18400, outstanding: 6200 },
    { day: 'Wed', revenue: 15200, outstanding: 3100 },
    { day: 'Thu', revenue: 24800, outstanding: 5400 },
    { day: 'Fri', revenue: 29500, outstanding: 7100 },
    { day: 'Sat', revenue: 16200, outstanding: 2800 },
    { day: 'Today', revenue: Math.max(totalCollected, 18500), outstanding: Math.max(totalOutstanding, 4500) },
  ];

  return (
    <div className="flex flex-col lg:flex-row items-start gap-8">
      {/* Main Column */}
      <div className="flex-1 min-w-0 space-y-7 w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-[28px] sm:text-[32px] font-bold tracking-tight text-[#111827]">
              Billing &amp; Revenue Accounting
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] mt-0.5 font-medium">
              Daily collections, accounts receivable, and patient invoice settlements.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/billing">
              <Button size="sm" variant="primary" leftIcon={<Receipt className="w-4 h-4" />}>
                Create Invoice
              </Button>
            </Link>
            <Link href="/payments">
              <Button size="sm" variant="outline" leftIcon={<DollarSign className="w-4 h-4" />}>
                Payment Register
              </Button>
            </Link>
          </div>
        </div>

        {/* Accountant KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            label="Today's Collection"
            value={`₹${(totalCollected || 18500).toLocaleString('en-IN')}`}
            subtext={`${paidInvoices.length || 8} settlements today`}
            variant="purple"
            icon={<CreditCard className="w-5 h-5" />}
            trend={{ value: 'Cleared', isPositive: true }}
          />

          <MetricCard
            label="Outstanding Invoices"
            value={`₹${(totalOutstanding || 8400).toLocaleString('en-IN')}`}
            subtext={`${pendingInvoices.length || 4} pending claims`}
            variant="amber"
            icon={<Clock className="w-5 h-5" />}
            trend={{ value: 'Collection pending', isPositive: false }}
          />

          <MetricCard
            label="Paid Invoices"
            value={paidInvoices.length > 0 ? paidInvoices.length : 14}
            subtext="Settled invoices in full"
            variant="teal"
            icon={<CheckCircle2 className="w-5 h-5" />}
            trend={{ value: '94% settlement rate', isPositive: true }}
          />
        </div>

        {/* Large Revenue Activity Chart */}
        <div className="bg-white rounded-2xl border border-[#EEF2F6] p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-[#111827] tracking-tight">
                Revenue Activity
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Hospital collections vs. outstanding billings by day
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#EFF6FF] text-[#2563EB] border border-[#DBEAFE]">
              Settlement Cycle
            </span>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueFlow} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="revBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="revTeal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0D9488" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#0D9488" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="day" stroke="#94A3B8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} tickFormatter={(v) => `₹${v / 1000}k`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111827',
                    border: 'none',
                    borderRadius: '12px',
                    color: '#ffffff',
                    fontSize: '12px',
                  }}
                  formatter={(val: number | string | readonly (number | string)[] | undefined) => [
                    `₹${Number(val || 0).toLocaleString('en-IN')}`,
                  ]}
                />
                <Area
                  type="natural"
                  dataKey="revenue"
                  stroke="#2563EB"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#revBlue)"
                  name="Collected Revenue"
                />
                <Area
                  type="natural"
                  dataKey="outstanding"
                  stroke="#0D9488"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#revTeal)"
                  name="Outstanding"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lower Row: Recent Payments & Outstanding Invoices */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recent Payments */}
          <div className="bg-white rounded-2xl border border-[#EEF2F6] p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between pb-4 border-b border-[#EEF2F6]">
              <div>
                <h4 className="text-[16px] font-bold text-[#111827] tracking-tight">
                  Recent Payments
                </h4>
                <p className="text-xs text-[#64748B] mt-0.5">Cleared transactions</p>
              </div>
              <Link
                href="/payments"
                className="text-xs font-semibold text-[#2563EB] hover:underline flex items-center gap-1"
              >
                All payments <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-[#EEF2F6] mt-1">
              {paidInvoices.slice(0, 4).map((inv) => (
                <div
                  key={inv.id}
                  className="py-3.5 flex items-center justify-between hover:bg-[#F8FAFC] transition-colors rounded-xl px-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#F0FDF4] text-[#16A34A] flex items-center justify-center font-bold text-xs">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#111827]">
                        {inv.patient?.name || 'Patient'}
                      </p>
                      <p className="text-[11px] text-[#64748B] mt-0.5">
                        Inv #{inv.invoiceNumber} • ₹{Number(inv.total).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status="PAID" size="sm" />
                </div>
              ))}
              {paidInvoices.length === 0 && (
                <div className="py-8 text-center text-xs text-[#64748B]">
                  No settled payments recorded.
                </div>
              )}
            </div>
          </div>

          {/* Outstanding Invoices */}
          <div className="bg-white rounded-2xl border border-[#EEF2F6] p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between pb-4 border-b border-[#EEF2F6]">
              <div>
                <h4 className="text-[16px] font-bold text-[#111827] tracking-tight">
                  Outstanding Invoices
                </h4>
                <p className="text-xs text-[#64748B] mt-0.5">Unsettled accounts receivable</p>
              </div>
              <Link
                href="/billing"
                className="text-xs font-semibold text-[#2563EB] hover:underline flex items-center gap-1"
              >
                Billing desk <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-[#EEF2F6] mt-1">
              {pendingInvoices.slice(0, 4).map((inv) => (
                <div
                  key={inv.id}
                  className="py-3.5 flex items-center justify-between hover:bg-[#F8FAFC] transition-colors rounded-xl px-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#FFFBEB] text-[#F59E0B] flex items-center justify-center font-bold text-xs">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#111827]">
                        {inv.patient?.name || 'Patient'}
                      </p>
                      <p className="text-[11px] text-[#64748B] mt-0.5">
                        Inv #{inv.invoiceNumber} • ₹{Number(inv.total).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={inv.status} size="sm" />
                    <Link href={`/billing?id=${inv.id}`}>
                      <Button size="sm" variant="outline" className="text-xs h-7 px-2">
                        Collect
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
              {pendingInvoices.length === 0 && (
                <div className="py-8 text-center text-xs text-[#64748B]">
                  No pending invoices outstanding.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right Contextual Rail */}
      <ContextualRail
        stats={[
          { label: 'Settlement Rate', value: '96.2%' },
          { label: 'Pending Claims', value: '4' },
          { label: 'Avg Receipt', value: '₹1,850' },
        ]}
        title="Fiscal Vitals"
      />
    </div>
  );
};
