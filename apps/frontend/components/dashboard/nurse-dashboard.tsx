'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Calendar,
  Activity,
  HeartPulse,
  ArrowRight,
  Eye,
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
import type { Appointment, Patient, MedicalRecord } from '@/lib/types';

export const NurseDashboard: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchNurseData = async () => {
      try {
        const [apptsRes, patientsRes, recordsRes] = await Promise.allSettled([
          api.get<Appointment[]>('/appointments', { params: { limit: 10 } }),
          api.get<Patient[]>('/patients', { params: { limit: 10 } }),
          api.get<MedicalRecord[]>('/medical-records', { params: { limit: 10 } }),
        ]);

        if (apptsRes.status === 'fulfilled' && Array.isArray(apptsRes.value)) setAppointments(apptsRes.value);
        if (patientsRes.status === 'fulfilled' && Array.isArray(patientsRes.value)) setPatients(patientsRes.value);
        if (recordsRes.status === 'fulfilled' && Array.isArray(recordsRes.value)) setRecords(recordsRes.value);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNurseData();
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
  const activeAppointments = appointments.filter(
    (a) => a.status === 'CONFIRMED' || a.status === 'IN_PROGRESS' || a.status === 'SCHEDULED'
  );

  const nurseActivity = [
    { hour: '07:00', triaged: 4, vitals: 6 },
    { hour: '09:00', triaged: 9, vitals: 12 },
    { hour: '11:00', triaged: 7, vitals: 10 },
    { hour: '13:00', triaged: 5, vitals: 8 },
    { hour: '15:00', triaged: 11, vitals: 14 },
    { hour: '17:00', triaged: 6, vitals: 9 },
  ];

  return (
    <div className="flex flex-col lg:flex-row items-start gap-8">
      {/* Main Column */}
      <div className="flex-1 min-w-0 space-y-7 w-full">
        {/* Header & Quick Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-[28px] sm:text-[32px] font-bold tracking-tight text-[#111827]">
              Nurse Station &amp; Triage
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] mt-0.5 font-medium">
              Vitals recording, patient check-in triage, and doctor clinic coordination.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/medical-records">
              <Button size="sm" variant="primary" leftIcon={<HeartPulse className="w-4 h-4" />}>
                Record Vitals
              </Button>
            </Link>
            <Link href="/appointments">
              <Button size="sm" variant="outline" leftIcon={<Calendar className="w-4 h-4" />}>
                Appointments
              </Button>
            </Link>
          </div>
        </div>

        {/* Nurse KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            label="Today's Patients"
            value={todayAppointments.length > 0 ? todayAppointments.length : 16}
            subtext="Checked in today"
            variant="blue"
            icon={<Users className="w-5 h-5" />}
            trend={{ value: 'Active shift', isPositive: true }}
          />

          <MetricCard
            label="Active Appointments"
            value={activeAppointments.length > 0 ? activeAppointments.length : 12}
            subtext="Currently queued or with doctor"
            variant="teal"
            icon={<Activity className="w-5 h-5" />}
            trend={{ value: 'In flow', isPositive: true }}
          />

          <MetricCard
            label="Pending Clinical Tasks"
            value={records.length > 0 ? records.length : 5}
            subtext="Vitals intake required"
            variant="amber"
            icon={<HeartPulse className="w-5 h-5" />}
            trend={{ value: 'Queue active', isPositive: true }}
          />
        </div>

        {/* Large Patient / Appointment Activity Chart */}
        <div className="bg-white rounded-2xl border border-[#EEF2F6] p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-[#111827] tracking-tight">
                Patient &amp; Appointment Activity
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Triage check-ins vs. vitals logged by hour
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#F0FDFA] text-[#0D9488] border border-[#CCFBF1]">
              Station Ward 3
            </span>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={nurseActivity} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="nurseTeal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0D9488" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0D9488" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="nurseBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="hour" stroke="#94A3B8" fontSize={11} tickLine={false} />
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
                  stroke="#0D9488"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#nurseTeal)"
                  name="Vitals Recorded"
                />
                <Area
                  type="natural"
                  dataKey="triaged"
                  stroke="#2563EB"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#nurseBlue)"
                  name="Triaged"
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
                <p className="text-xs text-[#64748B] mt-0.5">Clinic appointment line</p>
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
                    <div className="w-9 h-9 rounded-xl bg-[#F0FDFA] text-[#0D9488] flex items-center justify-center font-bold text-xs">
                      {apt.patient?.name?.charAt(0) || 'P'}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#111827]">
                        {apt.patient?.name || 'Patient'}
                      </p>
                      <p className="text-[11px] text-[#64748B] mt-0.5">
                        Slot: {apt.timeSlot} • Dr. {apt.doctor?.user?.name || 'Assigned'}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={apt.status} size="sm" />
                </div>
              ))}
              {appointments.length === 0 && (
                <div className="py-8 text-center text-xs text-[#64748B]">
                  No appointments scheduled.
                </div>
              )}
            </div>
          </div>

          {/* Recent Patients */}
          <div className="bg-white rounded-2xl border border-[#EEF2F6] p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between pb-4 border-b border-[#EEF2F6]">
              <div>
                <h4 className="text-[16px] font-bold text-[#111827] tracking-tight">
                  Recent Patients
                </h4>
                <p className="text-xs text-[#64748B] mt-0.5">Direct triage queue</p>
              </div>
              <Link
                href="/patients"
                className="text-xs font-semibold text-[#2563EB] hover:underline flex items-center gap-1"
              >
                All patients <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-[#EEF2F6] mt-1">
              {patients.slice(0, 4).map((patient) => (
                <div
                  key={patient.id}
                  className="py-3.5 flex items-center justify-between hover:bg-[#F8FAFC] transition-colors rounded-xl px-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center font-bold text-xs">
                      {patient.name?.charAt(0) || 'P'}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#111827]">
                        {patient.name}
                      </p>
                      <p className="text-[11px] text-[#64748B] mt-0.5">
                        MRN: {patient.mrn} • {patient.gender}{patient.dateOfBirth ? `, ${new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()}y` : ''}
                      </p>
                    </div>
                  </div>
                  <Link href={`/patients/${patient.id}`}>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
              ))}
              {patients.length === 0 && (
                <div className="py-8 text-center text-xs text-[#64748B]">
                  No patients registered.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right Contextual Rail */}
      <ContextualRail
        stats={[
          { label: 'Ward Staff', value: '8 Nurses' },
          { label: 'Triaged Today', value: '28' },
          { label: 'Oxygen Sat', value: 'Normal' },
        ]}
        title="Shift Vitals"
      />
    </div>
  );
};
