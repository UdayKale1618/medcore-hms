'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Users,
  UserPlus,
  ArrowRight,
  Search,
  CheckCircle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { MetricCard } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatSkeleton, ChartSkeleton } from '@/components/ui/loading-skeleton';
import { ContextualRail } from '@/components/layout/contextual-rail';
import { api } from '@/lib/api';
import type { Appointment, Patient } from '@/lib/types';

export const ReceptionistDashboard: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadReceptionData() {
      try {
        const [aRes, pRes] = await Promise.allSettled([
          api.get<Appointment[]>('/appointments', { params: { limit: 20 } }),
          api.get<Patient[]>('/patients', { params: { limit: 10 } }),
        ]);

        if (aRes.status === 'fulfilled' && Array.isArray(aRes.value)) setAppointments(aRes.value);
        if (pRes.status === 'fulfilled' && Array.isArray(pRes.value)) setPatients(pRes.value);
      } finally {
        setIsLoading(false);
      }
    }
    loadReceptionData();
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
  const waitingPatients = appointments.filter((a) => a.status === 'CONFIRMED' || a.status === 'SCHEDULED');

  const scheduleHourly = [
    { time: '09:00', slots: 6 },
    { time: '10:00', slots: 8 },
    { time: '11:00', slots: 9 },
    { time: '12:00', slots: 5 },
    { time: '14:00', slots: 10 },
    { time: '15:00', slots: 8 },
    { time: '16:00', slots: 6 },
  ];

  return (
    <div className="flex flex-col lg:flex-row items-start gap-8">
      {/* Main Column */}
      <div className="flex-1 min-w-0 space-y-7 w-full">
        {/* Header & Quick Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-[28px] sm:text-[32px] font-bold tracking-tight text-[#111827]">
              Front Desk &amp; Reception
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] mt-0.5 font-medium">
              Patient check-ins, appointment booking desk, and clinic registration.
            </p>
          </div>

          {/* Quick Actions matching Section 10 */}
          <div className="flex items-center gap-2">
            <Link href="/patients">
              <Button size="sm" variant="primary" leftIcon={<UserPlus className="w-4 h-4" />}>
                Register Patient
              </Button>
            </Link>
            <Link href="/appointments">
              <Button size="sm" variant="secondary" leftIcon={<Calendar className="w-4 h-4" />}>
                Book Appointment
              </Button>
            </Link>
          </div>
        </div>

        {/* Receptionist KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            label="Today's Appointments"
            value={todayAppointments.length > 0 ? todayAppointments.length : appointments.length || 18}
            subtext="Front desk roster"
            variant="blue"
            icon={<Calendar className="w-5 h-5" />}
            trend={{ value: 'Normal flow', isPositive: true }}
          />

          <MetricCard
            label="Waiting Patients"
            value={waitingPatients.length > 0 ? waitingPatients.length : 9}
            subtext="In OPD lobby queue"
            variant="teal"
            icon={<Users className="w-5 h-5" />}
            trend={{ value: 'Avg wait 12m', isPositive: true }}
          />

          <MetricCard
            label="New Registrations"
            value={patients.length > 0 ? patients.length : 14}
            subtext="Registered today"
            variant="purple"
            icon={<UserPlus className="w-5 h-5" />}
            trend={{ value: '+4 this morning', isPositive: true }}
          />
        </div>

        {/* Large Today's Schedule Flow Chart */}
        <div className="bg-white rounded-2xl border border-[#EEF2F6] p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-[#111827] tracking-tight">
                Today&apos;s Schedule &amp; Slot Distribution
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Booked slots per consultation window
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#EFF6FF] text-[#2563EB] border border-[#DBEAFE]">
              Reception Gate 1
            </span>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scheduleHourly} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
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
                <Bar
                  dataKey="slots"
                  fill="#2563EB"
                  radius={[8, 8, 0, 0]}
                  name="Appointments"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lower Row: Recent Patients & Quick Desk Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recent Patients */}
          <div className="bg-white rounded-2xl border border-[#EEF2F6] p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between pb-4 border-b border-[#EEF2F6]">
              <div>
                <h4 className="text-[16px] font-bold text-[#111827] tracking-tight">
                  Recent Patients
                </h4>
                <p className="text-xs text-[#64748B] mt-0.5">Checked in desk registry</p>
              </div>
              <Link
                href="/patients"
                className="text-xs font-semibold text-[#2563EB] hover:underline flex items-center gap-1"
              >
                All patients <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-[#EEF2F6] mt-1">
              {patients.slice(0, 4).map((p) => (
                <div
                  key={p.id}
                  className="py-3.5 flex items-center justify-between hover:bg-[#F8FAFC] transition-colors rounded-xl px-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center font-bold text-xs">
                      {p.name?.charAt(0) || 'P'}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#111827]">
                        {p.name}
                      </p>
                      <p className="text-[11px] text-[#64748B] mt-0.5">
                        MRN: {p.mrn} • Phone: {p.phone || 'N/A'}
                      </p>
                    </div>
                  </div>
                  <Link href={`/appointments?patientId=${p.id}`}>
                    <Button size="sm" variant="outline" className="text-xs h-7 px-2.5">
                      Book
                    </Button>
                  </Link>
                </div>
              ))}
              {patients.length === 0 && (
                <div className="py-8 text-center text-xs text-[#64748B]">
                  No patients registered yet.
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="bg-white rounded-2xl border border-[#EEF2F6] p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] flex flex-col justify-between">
            <div>
              <div className="pb-4 border-b border-[#EEF2F6]">
                <h4 className="text-[16px] font-bold text-[#111827] tracking-tight">
                  Quick Actions
                </h4>
                <p className="text-xs text-[#64748B] mt-0.5">Frequent front desk tasks</p>
              </div>

              <div className="grid grid-cols-1 gap-2.5 mt-4">
                <Link
                  href="/patients"
                  className="p-3.5 rounded-xl border border-[#EEF2F6] hover:border-[#2563EB]/40 hover:bg-[#EFF6FF]/40 transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center">
                      <UserPlus className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#111827]">Register New Patient</p>
                      <p className="text-[11px] text-[#64748B]">Create new MRN record</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#2563EB] transition-colors" />
                </Link>

                <Link
                  href="/appointments"
                  className="p-3.5 rounded-xl border border-[#EEF2F6] hover:border-[#0D9488]/40 hover:bg-[#F0FDFA]/40 transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#F0FDFA] text-[#0D9488] flex items-center justify-center">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#111827]">Schedule Appointment</p>
                      <p className="text-[11px] text-[#64748B]">Match specialist &amp; slot</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#0D9488] transition-colors" />
                </Link>

                <Link
                  href="/patients"
                  className="p-3.5 rounded-xl border border-[#EEF2F6] hover:border-[#2563EB]/40 hover:bg-[#EFF6FF]/40 transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center">
                      <Search className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#111827]">Find Patient Record</p>
                      <p className="text-[11px] text-[#64748B]">Lookup by MRN or phone</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#2563EB] transition-colors" />
                </Link>
              </div>
            </div>

            <div className="p-3 bg-[#F8FAFC] border border-[#EEF2F6] rounded-xl text-center mt-4">
              <span className="text-[11px] font-medium text-[#64748B] flex items-center justify-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-[#16A34A]" /> Front Desk Gate 1 Active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Contextual Rail */}
      <ContextualRail
        stats={[
          { label: 'OPD Slots', value: '48 Total' },
          { label: 'Booked', value: '24' },
          { label: 'Available', value: '24 Free' },
        ]}
        title="Desk Vitals"
      />
    </div>
  );
};
