'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Users,
  UserCheck,
  Calendar,
  FileText,
  CreditCard,
  FlaskConical,
  X,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Patient, Doctor, Appointment, Invoice, LabOrder } from '@/lib/types';

interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'patient' | 'doctor' | 'appointment' | 'invoice' | 'lab';
  url: string;
}

export const GlobalSearchModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const [patientsRes, doctorsRes, appointmentsRes, invoicesRes, labOrdersRes] =
          await Promise.allSettled([
            api.get<Patient[]>('/patients', { params: { search: query, limit: 4 } }),
            api.get<Doctor[]>('/doctors', { params: { search: query, limit: 4 } }),
            api.get<Appointment[]>('/appointments', { params: { limit: 4 } }),
            api.get<Invoice[]>('/invoices', { params: { search: query, limit: 4 } }),
            api.get<LabOrder[]>('/lab-orders', { params: { limit: 4 } }),
          ]);

        const items: SearchResultItem[] = [];

        if (patientsRes.status === 'fulfilled' && Array.isArray(patientsRes.value)) {
          patientsRes.value.forEach((p) => {
            items.push({
              id: p.id,
              title: p.name,
              subtitle: `MRN: ${p.mrn} • ${p.gender} • ${p.phone || 'No phone'}`,
              category: 'patient',
              url: `/patients/${p.id}`,
            });
          });
        }

        if (doctorsRes.status === 'fulfilled' && Array.isArray(doctorsRes.value)) {
          doctorsRes.value.forEach((d) => {
            items.push({
              id: d.id,
              title: `Dr. ${d.user?.name || 'Doctor'}`,
              subtitle: `${d.specialization} • ${d.department?.name || 'Department'}`,
              category: 'doctor',
              url: `/doctors?id=${d.id}`,
            });
          });
        }

        if (invoicesRes.status === 'fulfilled' && Array.isArray(invoicesRes.value)) {
          invoicesRes.value.forEach((inv) => {
            items.push({
              id: inv.id,
              title: `Invoice ${inv.invoiceNumber}`,
              subtitle: `Total: ₹${inv.total} • Status: ${inv.status}`,
              category: 'invoice',
              url: `/billing?id=${inv.id}`,
            });
          });
        }

        if (appointmentsRes.status === 'fulfilled' && Array.isArray(appointmentsRes.value)) {
          appointmentsRes.value
            .filter(
              (a) =>
                a.patient?.name?.toLowerCase().includes(query.toLowerCase()) ||
                a.doctor?.user?.name?.toLowerCase().includes(query.toLowerCase()),
            )
            .forEach((a) => {
              items.push({
                id: a.id,
                title: `Appointment: ${a.patient?.name || 'Patient'}`,
                subtitle: `${a.appointmentDate} at ${a.timeSlot} • Dr. ${a.doctor?.user?.name || ''}`,
                category: 'appointment',
                url: `/appointments?id=${a.id}`,
              });
            });
        }

        if (labOrdersRes.status === 'fulfilled' && Array.isArray(labOrdersRes.value)) {
          labOrdersRes.value
            .filter(
              (o) =>
                o.orderNumber?.toLowerCase().includes(query.toLowerCase()) ||
                o.patient?.name?.toLowerCase().includes(query.toLowerCase()),
            )
            .forEach((o) => {
              items.push({
                id: o.id,
                title: `Lab Order ${o.orderNumber}`,
                subtitle: `Patient: ${o.patient?.name || 'Patient'} • Status: ${o.status}`,
                category: 'lab',
                url: `/laboratory?orderId=${o.id}`,
              });
            });
        }

        setResults(items);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const handleClose = () => {
    setQuery('');
    setResults([]);
    onClose();
  };

  const handleSelect = (url: string) => {
    handleClose();
    router.push(url);
  };

  const getIcon = (cat: string) => {
    switch (cat) {
      case 'patient':
        return <Users className="w-4 h-4 text-[#2563EB]" />;
      case 'doctor':
        return <UserCheck className="w-4 h-4 text-[#0D9488]" />;
      case 'appointment':
        return <Calendar className="w-4 h-4 text-[#F59E0B]" />;
      case 'invoice':
        return <CreditCard className="w-4 h-4 text-[#16A34A]" />;
      case 'lab':
        return <FlaskConical className="w-4 h-4 text-[#7E22CE]" />;
      default:
        return <FileText className="w-4 h-4 text-[#64748B]" />;
    }
  };

  const displayedResults = query.trim().length >= 2 ? results : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-[2px] transition-opacity"
        onClick={handleClose}
      />

      <div className="relative w-full max-w-xl bg-white rounded-2xl border border-[#EEF2F6] shadow-[0_12px_40px_rgba(15,23,42,0.12)] overflow-hidden z-10 animate-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="p-3.5 border-b border-[#EEF2F6] flex items-center gap-3 bg-[#F8FAFC]">
          <Search className="w-5 h-5 text-[#94A3B8] shrink-0 ml-1" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search patients, doctors, appointments, invoices, lab orders..."
            className="w-full bg-transparent text-sm text-[#111827] placeholder-[#94A3B8] focus:outline-none"
          />
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-[#2563EB] shrink-0" />}
          <button
            onClick={handleClose}
            className="text-[#94A3B8] hover:text-[#111827] p-1.5 rounded-lg hover:bg-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto divide-y divide-[#EEF2F6] p-2">
          {query.trim().length < 2 ? (
            <div className="text-center py-8 text-xs text-[#94A3B8]">
              Type at least 2 characters to search hospital records...
            </div>
          ) : isLoading ? (
            <div className="text-center py-8 text-xs text-[#64748B] flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" /> Searching database...
            </div>
          ) : displayedResults.length === 0 ? (
            <div className="text-center py-8 text-xs text-[#94A3B8]">
              No hospital records match &ldquo;{query}&rdquo;
            </div>
          ) : (
            displayedResults.map((item) => (
              <button
                key={`${item.category}-${item.id}`}
                onClick={() => handleSelect(item.url)}
                className="w-full text-left p-3 rounded-xl hover:bg-[#F8FAFC] flex items-center justify-between group transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-slate-100 shrink-0">
                    {getIcon(item.category)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#111827] truncate">
                      {item.title}
                    </p>
                    <p className="text-xs text-[#64748B] truncate">{item.subtitle}</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#CBD5E1] group-hover:text-[#2563EB] shrink-0 ml-2 transition-colors" />
              </button>
            ))
          )}
        </div>

        {/* Shortcut Footer */}
        <div className="px-4 py-2.5 bg-[#F8FAFC] border-t border-[#EEF2F6] flex items-center justify-between text-[11px] text-[#94A3B8]">
          <span>MedCore Hospital Registry Search</span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-white border border-[#E5E7EB] rounded font-sans text-[#64748B] shadow-2xs">
              ESC
            </kbd>{' '}
            to close
          </span>
        </div>
      </div>
    </div>
  );
};
