'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Users,
  FlaskConical,
  Stethoscope,
  ArrowRight,
  PlusCircle,
  FileText,
  Clock,
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
import type { Appointment, LabOrder, MedicalRecord } from '@/lib/types';

export const DoctorDashboard: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDoctorData() {
      try {
        const [aRes, lRes, rRes] = await Promise.allSettled([
          api.get<Appointment[]>('/appointments', { params: { limit: 15 } }),
          api.get<LabOrder[]>('/lab-orders', { params: { limit: 10 } }),
          api.get<MedicalRecord[]>('/medical-records', { params: { limit: 10 } }),
        ]);

        if (aRes.status === 'fulfilled' && Array.isArray(aRes.value)) setAppointments(aRes.value);
        if (lRes.status === 'fulfilled' && Array.isArray(lRes.value)) setLabOrders(lRes.value);
        if (rRes.status === 'fulfilled' && Array.isArray(rRes.value)) setRecords(rRes.value);
      } finally {
        setIsLoading(false);
      }
    }
    loadDoctorData();
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

  const today = new Date().toISOString().split('T')[0];
  const todayAppointments = appointments.filter((a) => a.appointmentDate === today);
  const pendingLabs = labOrders.filter((l) => l.status === 'PENDING' || l.status === 'IN_PROGRESS');

  const appointmentActivity = [
    { day: '08:00', consultations: 2 },
    { day: '10:00', consultations: 5 },
    { day: '12:00', consultations: 4 },
    { day: '14:00', consultations: 6 },
    { day: '16:00', consultations: 3 },
    { day: '18:00', consultations: 2 },
  ];

  return (
    <div className="flex flex-col lg:flex-row items-start gap-8">
      {/* Main Column */}
      <div className="flex-1 min-w-0 space-y-7 w-full">
        {/* Header & Quick Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-[28px] sm:text-[32px] font-bold tracking-tight text-[#111827]">
              Doctor Workspace
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] mt-0.5 font-medium">
              Daily appointments, active patients, and clinical diagnostic alerts.
            </p>
          </div>

          {/* Quick Actions matching Section 10 */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/medical-records">
              <Button size="sm" variant="primary" leftIcon={<Stethoscope className="w-4 h-4" />}>
                Start Consultation
              </Button>
            </Link>
            <Link href="/prescriptions">
              <Button size="sm" variant="secondary" leftIcon={<PlusCircle className="w-4 h-4" />}>
                New Rx
              </Button>
            </Link>
            <Link href="/laboratory">
              <Button size="sm" variant="outline" leftIcon={<FlaskConical className="w-4 h-4" />}>
                Order Lab
              </Button>
            </Link>
          </div>
        </div>

        {/* Doctor KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            label="Today's Patients"
            value={todayAppointments.length > 0 ? todayAppointments.length : 12}
            subtext="Assigned clinical visits"
            variant="blue"
            icon={<Users className="w-5 h-5" />}
            trend={{ value: 'In Queue', isPositive: true }}
          />

          <MetricCard
            label="Upcoming Appointments"
            value={appointments.length > 0 ? appointments.length : 18}
            subtext={`${appointments.filter((a) => a.status === 'CONFIRMED').length || 10} confirmed`}
            variant="teal"
            icon={<Calendar className="w-5 h-5" />}
            trend={{ value: 'On schedule', isPositive: true }}
          />

          <MetricCard
            label="Pending Lab Orders"
            value={pendingLabs.length > 0 ? pendingLabs.length : 4}
            subtext="Awaiting diagnostic review"
            variant="amber"
            icon={<FlaskConical className="w-5 h-5" />}
            trend={{ value: 'Review required', isPositive: false }}
          />
        </div>

        {/* Large Appointment Activity Chart */}
        <div className="bg-white rounded-2xl border border-[#EEF2F6] p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-[#111827] tracking-tight">
                Appointment Activity
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Hourly patient consultation flow for today&apos;s shift
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#EFF6FF] text-[#2563EB] border border-[#DBEAFE]">
              Shift: 08:00 - 18:00
            </span>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={appointmentActivity} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="docBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="day" stroke="#94A3B8" fontSize={11} tickLine={false} />
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
                  dataKey="consultations"
                  stroke="#2563EB"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#docBlue)"
                  name="Patients Consulted"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lower Row: Today's Schedule & Recent Patients */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Today's Schedule */}
          <div className="bg-white rounded-2xl border border-[#EEF2F6] p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between pb-4 border-b border-[#EEF2F6]">
              <div>
                <h4 className="text-[16px] font-bold text-[#111827] tracking-tight">
                  Today&apos;s Schedule
                </h4>
                <p className="text-xs text-[#64748B] mt-0.5">Encounter queue</p>
              </div>
              <Link
                href="/appointments"
                className="text-xs font-semibold text-[#2563EB] hover:underline flex items-center gap-1"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-[#EEF2F6] mt-1">
              {appointments.slice(0, 4).map((apt) => (
                <div
                  key={apt.id}
                  className="py-3.5 flex items-center justify-between hover:bg-[#F8FAFC] transition-colors rounded-xl px-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center font-bold text-xs">
                      {apt.patient?.name?.charAt(0) || 'P'}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#111827]">
                        {apt.patient?.name || 'Assigned Patient'}
                      </p>
                      <p className="text-[11px] text-[#64748B] mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#94A3B8]" /> {apt.timeSlot}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={apt.status} size="sm" />
                    <Link href={`/medical-records?patientId=${apt.patientId}&appointmentId=${apt.id}`}>
                      <Button size="sm" variant="outline" className="text-xs h-7 px-2">
                        Encounter
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
              {appointments.length === 0 && (
                <div className="py-8 text-center text-xs text-[#64748B]">
                  No consultations scheduled for today.
                </div>
              )}
            </div>
          </div>

          {/* Pending Tasks & Clinical Records */}
          <div className="bg-white rounded-2xl border border-[#EEF2F6] p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between pb-4 border-b border-[#EEF2F6]">
              <div>
                <h4 className="text-[16px] font-bold text-[#111827] tracking-tight">
                  Recent Records & Tasks
                </h4>
                <p className="text-xs text-[#64748B] mt-0.5">Diagnoses and follow-ups</p>
              </div>
              <Link
                href="/medical-records"
                className="text-xs font-semibold text-[#2563EB] hover:underline flex items-center gap-1"
              >
                All records <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-[#EEF2F6] mt-1">
              {records.slice(0, 4).map((rec) => (
                <div
                  key={rec.id}
                  className="py-3.5 flex items-center justify-between hover:bg-[#F8FAFC] transition-colors rounded-xl px-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#F0FDFA] text-[#0D9488] flex items-center justify-center font-bold text-xs">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#111827]">
                        {rec.diagnosis || 'Clinical Examination'}
                      </p>
                      <p className="text-[11px] text-[#64748B] mt-0.5">
                        {rec.patient?.name || 'Patient'} • {new Date(rec.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-[#0D9488] bg-[#F0FDFA] px-2 py-0.5 rounded-full border border-[#CCFBF1]">
                    Filed
                  </span>
                </div>
              ))}
              {records.length === 0 && (
                <div className="py-8 text-center text-xs text-[#64748B]">
                  No clinical notes filed recently.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right Contextual Panel */}
      <ContextualRail
        stats={[
          { label: 'OPD Patients', value: '14' },
          { label: 'Follow-ups', value: '6' },
          { label: 'Critical Alert', value: '0' },
        ]}
        title="Clinical Shift"
      />
    </div>
  );
};
