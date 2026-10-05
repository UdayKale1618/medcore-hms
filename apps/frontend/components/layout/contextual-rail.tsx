'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronUp, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import type { Doctor } from '@/lib/types';

export interface ContextualRailProps {
  doctors?: Doctor[];
  stats?: {
    label: string;
    value: string;
  }[];
  title?: string;
  className?: string;
}

export const ContextualRail: React.FC<ContextualRailProps> = ({
  doctors = [],
  stats,
  title = 'Details',
  className = '',
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(currentDate.getDate());

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentMonthName = months[currentDate.getMonth()];
  const currentYear = currentDate.getFullYear();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentDate.getMonth() + 1, 1));
  };

  // Build calendar matrix
  const firstDayIndex = new Date(currentYear, currentDate.getMonth(), 1).getDay();
  const daysInMonth = new Date(currentYear, currentDate.getMonth() + 1, 0).getDate();

  const dayCells = [];
  for (let i = 0; i < firstDayIndex; i++) {
    dayCells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    dayCells.push(d);
  }

  // Sample event days for calendar dots
  const eventDays: Record<number, number> = {
    1: 2,
    7: 1,
    12: 1,
    17: 3,
    18: 2,
    23: 1,
    29: 2,
  };

  // Mock doctors if none provided
  const displayDoctors = doctors.length > 0
    ? doctors.slice(0, 4)
    : [
        { id: '1', user: { name: 'Dr. Sharma' }, specialization: 'Cardiology' },
        { id: '2', user: { name: 'Dr. Patel' }, specialization: 'Pediatrics' },
        { id: '3', user: { name: 'Dr. Rao' }, specialization: 'Neurology' },
        { id: '4', user: { name: 'Dr. Gupta' }, specialization: 'Surgery' },
      ];

  const displayStats = stats || [
    { label: 'Blood Group', value: 'O+' },
    { label: 'Available Beds', value: '42 / 50' },
    { label: 'Duty Staff', value: '18 On' },
  ];

  return (
    <aside className={`w-full lg:w-[310px] xl:w-[330px] shrink-0 space-y-6 ${className}`}>
      {/* Reference Minimalist Calendar */}
      <div className="bg-white rounded-2xl border border-[#EEF2F6] p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        {/* Month Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-[#111827] tracking-tight">
            {currentMonthName} {currentYear}
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevMonth}
              className="p-1 rounded-lg hover:bg-[#F8FAFC] text-[#64748B] hover:text-[#111827] transition-colors"
              title="Previous Month"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1 rounded-lg hover:bg-[#F8FAFC] text-[#64748B] hover:text-[#111827] transition-colors"
              title="Next Month"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Days Header */}
        <div className="grid grid-cols-7 text-center mb-2">
          {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day) => (
            <span key={day} className="text-[10px] font-bold text-[#94A3B8] tracking-wider py-1">
              {day}
            </span>
          ))}
        </div>

        {/* Date Matrix */}
        <div className="grid grid-cols-7 gap-y-1.5 text-center text-xs">
          {dayCells.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="h-8" />;
            }

            const isSelected = day === selectedDay;
            const hasDots = eventDays[day];

            return (
              <button
                key={`day-${day}`}
                onClick={() => setSelectedDay(day)}
                className={`relative flex flex-col items-center justify-center h-8 rounded-xl font-medium transition-all ${
                  isSelected
                    ? 'bg-[#2563EB] text-white font-bold shadow-xs'
                    : 'text-[#334155] hover:bg-[#F8FAFC]'
                }`}
              >
                <span>{day}</span>
                {hasDots && !isSelected && (
                  <span className="absolute bottom-1 flex gap-0.5">
                    {Array.from({ length: Math.min(hasDots, 3) }).map((_, di) => (
                      <span
                        key={di}
                        className="w-1 h-1 rounded-full bg-[#0D9488]"
                      />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Reference Doctors / Care Team Card */}
      <div className="bg-white rounded-2xl border border-[#EEF2F6] p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-1 h-4 bg-[#2563EB] rounded-full" />
            <h4 className="text-[15px] font-bold text-[#111827] tracking-tight">
              Doctors
            </h4>
          </div>
          <Link
            href="/doctors"
            className="text-xs font-semibold text-[#2563EB] hover:underline flex items-center gap-0.5"
          >
            See All <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid grid-cols-4 gap-2 pt-1">
          {displayDoctors.map((doc, idx) => {
            const initials = doc.user?.name
              ? doc.user.name.split(' ').map((n) => n[0]).join('').slice(0, 2)
              : `D${idx + 1}`;

            const bgGradients = [
              'bg-[#EFF6FF] text-[#2563EB] border-[#DBEAFE]',
              'bg-[#F0FDFA] text-[#0D9488] border-[#CCFBF1]',
              'bg-[#FFFBEB] text-[#D97706] border-[#FEF3C7]',
              'bg-[#FAF5FF] text-[#7E22CE] border-[#F3E8FF]',
            ];

            return (
              <div key={doc.id || idx} className="flex flex-col items-center text-center">
                <div
                  className={`w-11 h-11 rounded-full border flex items-center justify-center text-xs font-bold shadow-2xs ${bgGradients[idx % 4]}`}
                >
                  {initials}
                </div>
                <span className="text-[11px] font-medium text-[#334155] mt-1.5 truncate max-w-[64px]">
                  {doc.user?.name?.replace('Dr. ', '') || `Doctor ${idx + 1}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reference Details / Vitals Card */}
      <div className="bg-white rounded-2xl border border-[#EEF2F6] p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-1 h-4 bg-[#2563EB] rounded-full" />
            <h4 className="text-[15px] font-bold text-[#111827] tracking-tight">
              {title}
            </h4>
          </div>
          <Link
            href="/medical-records"
            className="text-xs font-semibold text-[#2563EB] hover:underline flex items-center gap-0.5"
          >
            See All <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center divide-x divide-[#EEF2F6] pt-1">
          {displayStats.map((item, idx) => (
            <div key={idx} className={idx > 0 ? 'pl-2' : ''}>
              <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                {item.label}
              </p>
              <p className="text-sm font-bold text-[#111827] mt-1">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Hospital Status Banner Card */}
      <div className="rounded-2xl p-5 bg-[#0F172A] text-white shadow-[0_4px_16px_rgba(15,23,42,0.1)] relative overflow-hidden">
        <div className="relative z-10">
          <div className="inline-block text-[10px] font-bold uppercase tracking-wider bg-[#2563EB] text-white px-2 py-0.5 rounded-full mb-2">
            Clinical Status
          </div>
          <h4 className="text-sm font-bold tracking-tight">
            24/7 Emergency Care
          </h4>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            All acute emergency protocols active. Direct paramedic line operational.
          </p>
          <div className="mt-3">
            <Link
              href="/appointments"
              className="inline-flex items-center gap-1 text-xs font-bold text-[#2563EB] bg-white px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Rapid Encounter <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
};
