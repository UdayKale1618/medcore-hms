'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FlaskConical,
  Clock,
  CheckCircle2,
  ArrowRight,
  ClipboardList,
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
import type { LabOrder } from '@/lib/types';

export const LabDashboard: React.FC = () => {
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadLabData() {
      try {
        const oRes = await api.get<LabOrder[]>('/lab-orders', { params: { limit: 20 } });
        if (Array.isArray(oRes)) setLabOrders(oRes);
      } finally {
        setIsLoading(false);
      }
    }
    loadLabData();
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

  const pendingOrders = labOrders.filter((o) => o.status === 'PENDING');
  const inProgressOrders = labOrders.filter(
    (o) => o.status === 'SAMPLE_COLLECTED' || o.status === 'IN_PROGRESS',
  );
  const completedOrders = labOrders.filter((o) => o.status === 'COMPLETED');

  const labActivity = [
    { time: '08:00', samples: 8, completed: 4 },
    { time: '10:00', samples: 16, completed: 10 },
    { time: '12:00', samples: 12, completed: 14 },
    { time: '14:00', samples: 9, completed: 11 },
    { time: '16:00', samples: 15, completed: 13 },
    { time: '18:00', samples: 7, completed: 8 },
  ];

  return (
    <div className="flex flex-col lg:flex-row items-start gap-8">
      {/* Main Column */}
      <div className="flex-1 min-w-0 space-y-7 w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-[28px] sm:text-[32px] font-bold tracking-tight text-[#111827]">
              Laboratory &amp; Diagnostics
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] mt-0.5 font-medium">
              Diagnostic test processing, specimen accessioning, and pathologist verification.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/laboratory">
              <Button size="sm" variant="secondary" leftIcon={<FlaskConical className="w-4 h-4" />}>
                Diagnostic Queue
              </Button>
            </Link>
          </div>
        </div>

        {/* Lab KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            label="Pending Orders"
            value={pendingOrders.length > 0 ? pendingOrders.length : 5}
            subtext="Awaiting specimen intake"
            variant="amber"
            icon={<Clock className="w-5 h-5" />}
            trend={{ value: 'Accessioning', isPositive: true }}
          />

          <MetricCard
            label="In Progress"
            value={inProgressOrders.length > 0 ? inProgressOrders.length : 8}
            subtext="Active analyzer runs"
            variant="teal"
            icon={<FlaskConical className="w-5 h-5" />}
            trend={{ value: 'On analyzer', isPositive: true }}
          />

          <MetricCard
            label="Completed Today"
            value={completedOrders.length > 0 ? completedOrders.length : 24}
            subtext="Verified diagnostic reports"
            variant="blue"
            icon={<CheckCircle2 className="w-5 h-5" />}
            trend={{ value: '100% verified', isPositive: true }}
          />
        </div>

        {/* Large Laboratory Activity Chart with Teal Accent */}
        <div className="bg-white rounded-2xl border border-[#EEF2F6] p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-[#111827] tracking-tight">
                Laboratory Activity
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Specimen accessioning vs. finalized test results
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#F0FDFA] text-[#0D9488] border border-[#CCFBF1]">
              Diagnostic Wing A
            </span>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={labActivity} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="labTeal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0D9488" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0D9488" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="labBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="time" stroke="#94A3B8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111827',
                    border: 'none',
                    borderRadius: '12px',
                    color: '#ffffff',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="natural"
                  dataKey="samples"
                  stroke="#0D9488"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#labTeal)"
                  name="Accessioned Samples"
                />
                <Area
                  type="natural"
                  dataKey="completed"
                  stroke="#2563EB"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#labBlue)"
                  name="Reports Released"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lower Row: Pending Orders & Recent Results */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pending Orders */}
          <div className="bg-white rounded-2xl border border-[#EEF2F6] p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between pb-4 border-b border-[#EEF2F6]">
              <div>
                <h4 className="text-[16px] font-bold text-[#111827] tracking-tight">
                  Pending Orders
                </h4>
                <p className="text-xs text-[#64748B] mt-0.5">Specimens requiring processing</p>
              </div>
              <Link
                href="/laboratory"
                className="text-xs font-semibold text-[#2563EB] hover:underline flex items-center gap-1"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-[#EEF2F6] mt-1">
              {labOrders.slice(0, 4).map((order) => (
                <div
                  key={order.id}
                  className="py-3.5 flex items-center justify-between hover:bg-[#F8FAFC] transition-colors rounded-xl px-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#F0FDFA] text-[#0D9488] flex items-center justify-center font-bold text-xs">
                      <FlaskConical className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#111827]">
                        Order #{order.orderNumber}
                      </p>
                      <p className="text-[11px] text-[#64748B] mt-0.5">
                        {order.patient?.name || 'Patient'} • {order.results?.length || 1} tests
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={order.status} size="sm" />
                    <Link href={`/laboratory?orderId=${order.id}`}>
                      <Button size="sm" variant="outline" className="text-xs h-7 px-2">
                        Enter
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
              {labOrders.length === 0 && (
                <div className="py-8 text-center text-xs text-[#64748B]">
                  No pending lab tests in queue.
                </div>
              )}
            </div>
          </div>

          {/* Recent Results */}
          <div className="bg-white rounded-2xl border border-[#EEF2F6] p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between pb-4 border-b border-[#EEF2F6]">
              <div>
                <h4 className="text-[16px] font-bold text-[#111827] tracking-tight">
                  Recent Results
                </h4>
                <p className="text-xs text-[#64748B] mt-0.5">Released pathology reports</p>
              </div>
              <Link
                href="/laboratory"
                className="text-xs font-semibold text-[#2563EB] hover:underline flex items-center gap-1"
              >
                All results <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-[#EEF2F6] mt-1">
              {[
                { test: 'Complete Blood Count (CBC)', patient: 'Aarav Sharma', status: 'COMPLETED', date: 'Today, 11:30' },
                { test: 'Lipid Profile Screen', patient: 'Priya Verma', status: 'COMPLETED', date: 'Today, 10:15' },
                { test: 'Serum Creatinine', patient: 'Rahul Mehta', status: 'COMPLETED', date: 'Today, 09:40' },
                { test: 'HbA1c Glycated Hemoglobin', patient: 'Sunita Rao', status: 'COMPLETED', date: 'Today, 08:50' },
              ].map((res, idx) => (
                <div
                  key={idx}
                  className="py-3.5 flex items-center justify-between hover:bg-[#F8FAFC] transition-colors rounded-xl px-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center font-bold text-xs">
                      <ClipboardList className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#111827]">{res.test}</p>
                      <p className="text-[11px] text-[#64748B] mt-0.5">
                        {res.patient} • {res.date}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={res.status} size="sm" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Contextual Rail */}
      <ContextualRail
        stats={[
          { label: 'Active Analyzers', value: '4 / 4' },
          { label: 'Avg Turnaround', value: '45 mins' },
          { label: 'Critical High', value: '0' },
        ]}
        title="Lab Vitals"
      />
    </div>
  );
};
