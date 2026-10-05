'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  UserCheck,
  Search,
  Building,
  CreditCard,
  Clock,
  Eye,
  Stethoscope,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { useToast } from '@/lib/toast-context';
import { api } from '@/lib/api';
import type { Doctor, DoctorAvailability } from '@/lib/types';

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Profile Modal
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [doctorAvailability, setDoctorAvailability] = useState<DoctorAvailability[]>([]);
  const [loadingAvail, setLoadingAvail] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    async function loadDoctors() {
      try {
        const res = await api.get<Doctor[]>('/doctors');
        if (Array.isArray(res)) setDoctors(res);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to retrieve doctors';
        toast.error('Doctors Load Error', msg);
      } finally {
        setIsLoading(false);
      }
    }
    loadDoctors();
  }, [toast]);

  const handleOpenDoctorProfile = async (doc: Doctor) => {
    setSelectedDoctor(doc);
    setLoadingAvail(true);
    try {
      const avail = await api.get<DoctorAvailability[]>(
        `/availability/doctor/${doc.id}`,
      );
      setDoctorAvailability(Array.isArray(avail) ? avail : []);
    } catch {
      setDoctorAvailability([]);
    } finally {
      setLoadingAvail(false);
    }
  };

  const filteredDoctors = doctors.filter((doc) => {
    return (
      doc.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
      doc.specialization?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <AppLayout>
      <PageHeader
        title="Physician & Doctor Directory"
        subtitle="Clinical medical staff, specializations, consultation fees, and weekly schedule"
        breadcrumbs={[{ label: 'Doctors' }]}
      />

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs mb-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-80 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by physician name or specialty..."
            className="w-full text-xs rounded-xl border border-[#E2E8F0] pl-9 pr-3 py-2.5 text-slate-900 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10"
          />
        </div>

        <div className="text-xs text-slate-500 font-medium">
          {filteredDoctors.length} Active Medical Consultants
        </div>
      </div>

      {/* Doctors Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <TableSkeleton rows={4} cols={3} />
        </div>
      ) : filteredDoctors.length === 0 ? (
        <EmptyState
          icon={<UserCheck className="w-8 h-8 text-slate-400" />}
          title="No Physicians Found"
          description="No doctors match your query in the hospital directory."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDoctors.map((doc) => (
            <Card key={doc.id} className="hover:border-slate-300 transition-colors">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold text-base shadow-xs">
                      {doc.user?.name ? doc.user.name.charAt(0).toUpperCase() : 'D'}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Dr. {doc.user?.name || 'Physician'}
                      </h3>
                      <p className="text-xs font-semibold text-teal-700">
                        {doc.specialization}
                      </p>
                    </div>
                  </div>
                  <Badge variant={doc.isActive ? 'success' : 'neutral'} size="sm" dot>
                    {doc.isActive ? 'On Duty' : 'Inactive'}
                  </Badge>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5" /> Department:
                    </span>
                    <span className="font-medium text-slate-800">
                      {doc.department?.name || 'General Medicine'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" /> Consultation Fee:
                    </span>
                    <span className="font-bold text-[#2563EB]">
                      ₹{Number(doc.consultationFee).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Stethoscope className="w-3.5 h-3.5" /> License Number:
                    </span>
                    <span className="font-mono text-slate-700">{doc.licenseNumber}</span>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 justify-center"
                    leftIcon={<Eye className="w-3.5 h-3.5" />}
                    onClick={() => handleOpenDoctorProfile(doc)}
                  >
                    View Schedule
                  </Button>
                  <Link href={`/appointments?doctorId=${doc.id}`} className="flex-1">
                    <Button variant="primary" size="sm" className="w-full justify-center">
                      Book Visit
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Doctor Availability Profile Modal */}
      <Modal
        isOpen={!!selectedDoctor}
        onClose={() => setSelectedDoctor(null)}
        title={selectedDoctor ? `Dr. ${selectedDoctor.user?.name || 'Physician'}` : 'Doctor Profile'}
        description={selectedDoctor?.specialization}
        size="lg"
      >
        {selectedDoctor && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-slate-400 block">Department</span>
                <span className="font-semibold text-slate-900">
                  {selectedDoctor.department?.name || 'General Medicine'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Consultation Fee</span>
                <span className="font-bold text-[#2563EB]">
                  ₹{Number(selectedDoctor.consultationFee).toLocaleString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Medical License</span>
                <span className="font-mono text-slate-900">{selectedDoctor.licenseNumber}</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-teal-600" /> Weekly Availability Schedule
              </h4>
              {loadingAvail ? (
                <div className="p-6 text-center text-slate-500">Checking clinic availability...</div>
              ) : doctorAvailability.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded text-amber-800">
                  Standard clinic hours apply: Monday to Saturday, 09:00 AM – 05:00 PM.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {doctorAvailability.map((avail) => (
                    <div
                      key={avail.id}
                      className="p-3 bg-white rounded border border-slate-200 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-slate-900">
                          {daysOfWeek[avail.dayOfWeek] || 'Day'}
                        </span>
                        <p className="text-slate-500 mt-0.5">
                          {avail.startTime} – {avail.endTime}
                        </p>
                      </div>
                      <Badge variant={avail.isAvailable ? 'success' : 'neutral'} size="sm">
                        {avail.isAvailable ? 'Available' : 'Off Duty'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setSelectedDoctor(null)}>
                Close
              </Button>
              <Link href={`/appointments?doctorId=${selectedDoctor.id}`}>
                <Button variant="primary" size="sm">
                  Schedule Consultation
                </Button>
              </Link>
            </div>
          </div>
        )}
      </Modal>
    </AppLayout>
  );
}
