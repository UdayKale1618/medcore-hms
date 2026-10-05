'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  FileText,
  Pill,
  CreditCard,
  MoreHorizontal,
  Plus,
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
import type { Appointment, Prescription, LabOrder, Invoice } from '@/lib/types';

export const PatientDashboard: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadPatientPortalData() {
      try {
        const [aRes, pRes, lRes, iRes] = await Promise.allSettled([
          api.get<Appointment[]>('/patient-portal/appointments'),
          api.get<Prescription[]>('/patient-portal/prescriptions'),
          api.get<LabOrder[]>('/patient-portal/lab-orders'),
          api.get<Invoice[]>('/patient-portal/invoices'),
        ]);

        if (aRes.status === 'fulfilled' && Array.isArray(aRes.value)) setAppointments(aRes.value);
        if (pRes.status === 'fulfilled' && Array.isArray(pRes.value)) setPrescriptions(pRes.value);
        if (lRes.status === 'fulfilled' && Array.isArray(lRes.value)) setLabOrders(lRes.value);
        if (iRes.status === 'fulfilled' && Array.isArray(iRes.value)) setInvoices(iRes.value);
      } finally {
        setIsLoading(false);
      }
    }
    loadPatientPortalData();
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

  const upcomingApt = appointments.find((a) => a.status === 'CONFIRMED' || a.status === 'SCHEDULED');
  const pendingInvoices = invoices.filter((i) => i.status !== 'PAID');
  const outstandingTotal = pendingInvoices.reduce((sum, i) => sum + Number(i.total || 0), 0);
  const activeRx = prescriptions.filter((p) => p.status === 'PRESCRIBED' || p.status === 'PARTIALLY_FULFILLED');

  const healthTimeline = [
    { month: 'Jan', vitals: 72, bloodPressure: 118 },
    { month: 'Feb', vitals: 75, bloodPressure: 120 },
    { month: 'Mar', vitals: 70, bloodPressure: 119 },
    { month: 'Apr', vitals: 74, bloodPressure: 122 },
    { month: 'May', vitals: 68, bloodPressure: 116 },
    { month: 'Jun', vitals: 72, bloodPressure: 120 },
  ];

  const currentDateFormatted = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="flex flex-col lg:flex-row items-start gap-8">
      {/* Main Column */}
      <div className="flex-1 min-w-0 space-y-7 w-full">
        {/* Header Bar matching Reference */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-[28px] sm:text-[32px] font-bold tracking-tight text-[#111827]">
              Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] mt-0.5 font-medium">
              Welcome back to your MedCore health portal and personal care records.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="px-3.5 py-1.5 bg-white border border-[#EEF2F6] rounded-xl text-xs font-semibold text-[#64748B] shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
              <span>📅</span> {currentDateFormatted}
            </div>
            <Link href="/appointments">
              <Button size="sm" variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
                Book Visit
              </Button>
            </Link>
          </div>
        </div>

        {/* Reference-Inspired KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            label="Next Appointment"
            value={upcomingApt ? `${upcomingApt.appointmentDate.split('-').slice(1).join('/')}` : 'Clear'}
            subtext={upcomingApt ? `${upcomingApt.timeSlot} • Dr. ${upcomingApt.doctor?.user?.name || 'Doctor'}` : 'No upcoming visits'}
            variant="blue"
            icon={<Calendar className="w-5 h-5" />}
            trend={{ value: upcomingApt ? 'Confirmed' : 'Up to date', isPositive: true }}
          />

          <MetricCard
            label="Outstanding Bill"
            value={`₹${outstandingTotal.toLocaleString('en-IN')}`}
            subtext={outstandingTotal > 0 ? `${pendingInvoices.length} pending invoice` : 'All invoices cleared'}
            variant="purple"
            icon={<CreditCard className="w-5 h-5" />}
            trend={{ value: outstandingTotal > 0 ? 'Pay Online' : 'Settled', isPositive: outstandingTotal === 0 }}
          />

          <MetricCard
            label="Active Prescriptions"
            value={activeRx.length > 0 ? `${activeRx.length} Regimens` : 'None'}
            subtext="Take medications on schedule"
            variant="teal"
            icon={<Pill className="w-5 h-5" />}
            trend={{ value: 'Active regimen', isPositive: true }}
          />
        </div>

        {/* Large Appointment Timeline / Health Activity Chart */}
        <div className="bg-white rounded-2xl border border-[#EEF2F6] p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-[#111827] tracking-tight">
                Health Activity &amp; Vitals
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Resting pulse rate (BPM) &amp; systolic blood pressure trends
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#EFF6FF] text-[#2563EB] border border-[#DBEAFE]">
              6 Month Review
            </span>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={healthTimeline} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="patBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="patTeal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0D9488" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#0D9488" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="month" stroke="#94A3B8" fontSize={11} tickLine={false} />
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
                  dataKey="vitals"
                  stroke="#2563EB"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#patBlue)"
                  name="Pulse (BPM)"
                />
                <Area
                  type="natural"
                  dataKey="bloodPressure"
                  stroke="#0D9488"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#patTeal)"
                  name="BP Systolic"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lower Row: Recommendation / Recent Reports & Treatment / Prescriptions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Recommendation & Reports */}
          <div className="bg-white rounded-2xl border border-[#EEF2F6] p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between pb-4 border-b border-[#EEF2F6]">
              <div>
                <h4 className="text-[16px] font-bold text-[#111827] tracking-tight">
                  Recent Reports
                </h4>
                <p className="text-xs text-[#64748B] mt-0.5">Laboratory &amp; clinical summaries</p>
              </div>
              <button className="text-[#94A3B8] hover:text-[#111827] p-1">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>

            <div className="divide-y divide-[#EEF2F6] mt-1">
              {labOrders.length > 0 ? (
                labOrders.slice(0, 3).map((order) => (
                  <div
                    key={order.id}
                    className="py-3.5 flex items-center justify-between hover:bg-[#F8FAFC] transition-colors rounded-xl px-2"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center font-bold text-xs">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#111827]">
                          Lab Order #{order.orderNumber}
                        </p>
                        <p className="text-[11px] text-[#64748B] mt-0.5">
                          {order.results?.length || 1} diagnostic tests
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={order.status} size="sm" />
                  </div>
                ))
              ) : (
                [
                  { title: 'Cardiovascular Health Guide', date: '12 April 2026', tag: 'Guide' },
                  { title: 'Lipid Profile Report', date: '28 March 2026', tag: 'Report' },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="py-3.5 flex items-center justify-between hover:bg-[#F8FAFC] transition-colors rounded-xl px-2"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center font-bold text-xs">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#111827]">{item.title}</p>
                        <p className="text-[11px] text-[#64748B] mt-0.5">{item.date}</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded-full border border-[#DBEAFE]">
                      {item.tag}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Card 2: Treatment & Active Prescriptions (matching Reference image) */}
          <div className="bg-white rounded-2xl border border-[#EEF2F6] p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between pb-4 border-b border-[#EEF2F6]">
              <div>
                <h4 className="text-[16px] font-bold text-[#111827] tracking-tight">
                  Treatment
                </h4>
                <p className="text-xs text-[#64748B] mt-0.5">Active medication schedules</p>
              </div>
              <button className="text-[#94A3B8] hover:text-[#111827] p-1">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>

            <div className="divide-y divide-[#EEF2F6] mt-1">
              {[
                { name: 'Vitamin A & D3 Drops', dose: '1 tablet twice a day', color: 'bg-[#FAF5FF] text-[#7E22CE]' },
                { name: 'Amoxicillin 500mg', dose: '1 capsule three times daily', color: 'bg-[#F0FDFA] text-[#0D9488]' },
                { name: 'Multivitamin Complex', dose: '1 tablet post breakfast', color: 'bg-[#EFF6FF] text-[#2563EB]' },
              ].map((med, idx) => (
                <div
                  key={idx}
                  className="py-3.5 flex items-center justify-between hover:bg-[#F8FAFC] transition-colors rounded-xl px-2"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${med.color}`}>
                      <Pill className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#111827]">{med.name}</p>
                      <p className="text-[11px] text-[#64748B] mt-0.5">{med.dose}</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-[#16A34A] bg-[#F0FDF4] px-2 py-0.5 rounded-full border border-[#DCFCE7]">
                    Active
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Contextual Rail: Personal Vitals matching Reference Image */}
      <ContextualRail
        stats={[
          { label: 'Blood Group', value: 'A+' },
          { label: 'Height', value: '170 CM' },
          { label: 'Weight', value: '70 KG' },
        ]}
        title="Details"
      />
    </div>
  );
};
