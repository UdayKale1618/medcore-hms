'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Calendar,
  Clock,
  PlusCircle,
  AlertCircle,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/ui/page-header';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { useToast } from '@/lib/toast-context';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type {
  Appointment,
  Patient,
  Doctor,
  Department,
  DoctorAvailability,
  AppointmentStatus,
} from '@/lib/types';

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');

  // Booking Modal
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);

  // Doctor availability slots
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Cancel Modal
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const [bookingData, setBookingData] = useState({
    patientId: '',
    departmentId: '',
    doctorId: '',
    date: new Date().toISOString().split('T')[0],
    timeSlot: '',
    type: 'REGULAR',
    reason: '',
  });

  const { isPatient } = useAuth();
  const { toast } = useToast();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refreshAppointments = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let ignore = false;
    async function fetchAppointments() {
      try {
        const endpoint = isPatient ? '/patient-portal/appointments' : '/appointments';
        const params: Record<string, string> = {};
        if (statusFilter) params.status = statusFilter;
        if (dateFilter) params.date = dateFilter;
        if (doctorFilter) params.doctorId = doctorFilter;

        const res = await api.get<Appointment[]>(endpoint, { params });
        if (!ignore) {
          setAppointments(Array.isArray(res) ? res : []);
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : 'Failed to fetch appointments';
          toast.error('Schedule Error', msg);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }
    fetchAppointments();
    return () => {
      ignore = true;
    };
  }, [isPatient, statusFilter, dateFilter, doctorFilter, toast, refreshTrigger]);

  // Load departments, doctors, and patients for booking
  useEffect(() => {
    async function loadMetadata() {
      try {
        const [deptRes, docRes, patRes] = await Promise.allSettled([
          api.get<Department[]>('/departments'),
          api.get<Doctor[]>('/doctors'),
          isPatient ? Promise.resolve([]) : api.get<Patient[]>('/patients', { params: { limit: 100 } }),
        ]);

        if (deptRes.status === 'fulfilled' && Array.isArray(deptRes.value)) setDepartments(deptRes.value);
        if (docRes.status === 'fulfilled' && Array.isArray(docRes.value)) setDoctors(docRes.value);
        if (patRes.status === 'fulfilled' && Array.isArray(patRes.value)) setPatients(patRes.value);
      } catch {
        // non-blocking
      }
    }
    loadMetadata();
  }, [isPatient]);

  // When Doctor or Date changes in booking modal, fetch doctor availability slots
  useEffect(() => {
    if (!bookingData.doctorId || !bookingData.date) {
      return;
    }

    let ignore = false;
    async function fetchSlots() {
      setLoadingSlots(true);
      try {
        const availList = await api.get<DoctorAvailability[]>(
          `/availability/doctor/${bookingData.doctorId}`,
        );

        const targetDate = new Date(bookingData.date);
        const dayOfWeek = targetDate.getDay(); // 0=Sun, 1=Mon...

        const matchedAvail = Array.isArray(availList)
          ? availList.find((a) => a.dayOfWeek === dayOfWeek && a.isAvailable)
          : null;

        if (matchedAvail) {
          // Generate slots between startTime and endTime based on slotDurationMinutes
          const slots: string[] = [];
          const [startHour, startMin] = matchedAvail.startTime.split(':').map(Number);
          const [endHour, endMin] = matchedAvail.endTime.split(':').map(Number);

          let current = startHour * 60 + startMin;
          const end = endHour * 60 + endMin;
          const duration = matchedAvail.slotDurationMinutes || 30;

          while (current + duration <= end) {
            const h = Math.floor(current / 60)
              .toString()
              .padStart(2, '0');
            const m = (current % 60).toString().padStart(2, '0');
            slots.push(`${h}:${m}`);
            current += duration;
          }
          setAvailableSlots(slots);
        } else {
          // Fallback standard clinic slots if availability is not explicitly seeded
          setAvailableSlots([
            '09:00',
            '09:30',
            '10:00',
            '10:30',
            '11:00',
            '11:30',
            '14:00',
            '14:30',
            '15:00',
            '15:30',
            '16:00',
          ]);
        }
      } catch {
        setAvailableSlots([
          '09:00',
          '09:30',
          '10:00',
          '10:30',
          '11:00',
          '14:00',
          '14:30',
          '15:00',
        ]);
      } finally {
        if (!ignore) setLoadingSlots(false);
      }
    }

    fetchSlots();
    return () => {
      ignore = true;
    };
  }, [bookingData.doctorId, bookingData.date]);

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingData.doctorId || !bookingData.date || !bookingData.timeSlot) {
      setBookError('Please select a doctor, appointment date, and time slot.');
      return;
    }

    setBookError(null);
    setIsBooking(true);

    try {
      let patientIdToBook = bookingData.patientId;
      if (isPatient) {
        const profile = await api.get<Patient>('/patient-portal/profile');
        patientIdToBook = profile.id;
      }

      if (!patientIdToBook) {
        setBookError('Please select a patient for this appointment.');
        setIsBooking(false);
        return;
      }

      const doctorObj = doctors.find((d) => d.id === bookingData.doctorId);
      const departmentId = bookingData.departmentId || doctorObj?.departmentId || departments[0]?.id;

      const [hours, minutes] = bookingData.timeSlot.split(':').map(Number);
      const startDt = new Date(`${bookingData.date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000Z`);
      const endDt = new Date(startDt.getTime() + 30 * 60 * 1000);
      const apptDate = new Date(`${bookingData.date}T00:00:00.000Z`);

      let appointmentType = 'REGULAR';
      if (bookingData.type === 'EMERGENCY') appointmentType = 'EMERGENCY';
      if (bookingData.type === 'FOLLOW_UP') appointmentType = 'FOLLOW_UP';

      await api.post('/appointments', {
        patientId: patientIdToBook,
        doctorId: bookingData.doctorId,
        departmentId,
        appointmentDate: apptDate.toISOString(),
        startTime: startDt.toISOString(),
        endTime: endDt.toISOString(),
        type: appointmentType,
        reason: bookingData.reason || 'General Consultation',
      });

      toast.success('Appointment Scheduled', `Consultation confirmed for ${bookingData.date} at ${bookingData.timeSlot}`);
      setIsBookModalOpen(false);
      setBookingData({
        patientId: '',
        departmentId: '',
        doctorId: '',
        date: new Date().toISOString().split('T')[0],
        timeSlot: '',
        type: 'REGULAR',
        reason: '',
      });
      refreshAppointments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to schedule appointment';
      setBookError(msg);
    } finally {
      setIsBooking(false);
    }
  };

  const handleUpdateStatus = async (appointmentId: string, newStatus: AppointmentStatus) => {
    try {
      await api.patch(`/appointments/${appointmentId}/status`, { status: newStatus });
      toast.success('Status Updated', `Appointment marked as ${newStatus.replace(/_/g, ' ')}`);
      refreshAppointments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Status update failed';
      toast.error('Update Failed', msg);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTargetId) return;
    setIsCancelling(true);
    try {
      const endpoint = isPatient
        ? `/patient-portal/appointments/${cancelTargetId}/cancel`
        : `/appointments/${cancelTargetId}/cancel`;

      await api.patch(endpoint, {
        reason: cancelReason || 'Cancelled by patient/staff',
      });

      toast.success('Appointment Cancelled', 'The scheduled slot has been released.');
      setIsCancelModalOpen(false);
      setCancelTargetId(null);
      setCancelReason('');
      refreshAppointments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Cancellation failed';
      toast.error('Cancel Failed', msg);
    } finally {
      setIsCancelling(false);
    }
  };

  const filteredDoctors = bookingData.departmentId
    ? doctors.filter((d) => d.departmentId === bookingData.departmentId)
    : doctors;

  return (
    <AppLayout>
      <PageHeader
        title="Appointment Management"
        subtitle="Manage clinic appointments, patient queues, and physician availability"
        breadcrumbs={[{ label: 'Appointments' }]}
        actions={
          <Button
            variant="primary"
            size="md"
            leftIcon={<PlusCircle className="w-4 h-4" />}
            onClick={() => setIsBookModalOpen(true)}
          >
            Book Appointment
          </Button>
        }
      />

      {/* Filter and Date Bar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs mb-6 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-44 text-xs"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs rounded-xl border border-[#E2E8F0] px-3 py-2 bg-white text-slate-700 focus:outline-none focus:border-[#2563EB]"
          >
            <option value="">All Statuses</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="NO_SHOW">No Show</option>
          </select>

          {!isPatient && (
            <select
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
              className="text-xs rounded-xl border border-[#E2E8F0] px-3 py-2 bg-white text-slate-700 focus:outline-none focus:border-[#2563EB]"
            >
              <option value="">All Physicians</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  Dr. {d.user?.name || 'Physician'} ({d.specialization})
                </option>
              ))}
            </select>
          )}

          {(statusFilter || dateFilter || doctorFilter) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatusFilter('');
                setDateFilter('');
                setDoctorFilter('');
              }}
            >
              Reset Filters
            </Button>
          )}
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing {appointments.length} consultations
        </div>
      </div>

      {/* Appointments Table */}
      {isLoading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : appointments.length === 0 ? (
        <EmptyState
          icon={<Calendar className="w-8 h-8 text-slate-400" />}
          title="No Appointments Scheduled"
          description="There are no consultations scheduled matching your current filter criteria."
          action={
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsBookModalOpen(true)}
            >
              Schedule Appointment
            </Button>
          }
        />
      ) : (
        <Table minWidth="880px">
          <TableHeader>
            <TableRow>
              <TableHead className="w-36">Date & Slot</TableHead>
              <TableHead className="w-52">Patient Details</TableHead>
              <TableHead className="w-52">Doctor / Specialty</TableHead>
              <TableHead>Visit Type & Reason</TableHead>
              <TableHead className="w-32">Status</TableHead>
              <TableHead className="w-36 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {appointments.map((apt) => {
              const canModify = apt.status !== 'COMPLETED' && apt.status !== 'CANCELLED';

              return (
                <TableRow key={apt.id}>
                  <TableCell>
                    <div className="font-semibold text-slate-900">{apt.appointmentDate}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-slate-400" /> {apt.timeSlot}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-slate-900">
                      {apt.patient?.user?.name || apt.patient?.name || 'Patient'}
                    </div>
                    {apt.patient?.mrn && (
                      <div className="text-xs font-mono text-slate-400">MRN: {apt.patient.mrn}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-900">
                      Dr. {apt.doctor?.user?.name || 'Physician'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {apt.department?.name || apt.doctor?.specialization || 'Consultation'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-slate-800 text-xs block">
                      {apt.type}
                    </span>
                    <span className="text-xs text-slate-500 line-clamp-1">
                      {apt.reason || 'General Checkup'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={apt.status} size="sm" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                      {!isPatient && canModify && apt.status === 'SCHEDULED' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateStatus(apt.id, 'CONFIRMED')}
                        >
                          Confirm
                        </Button>
                      )}
                      {!isPatient && canModify && (apt.status === 'CONFIRMED' || apt.status === 'SCHEDULED') && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleUpdateStatus(apt.id, 'IN_PROGRESS')}
                        >
                          Start
                        </Button>
                      )}
                      {!isPatient && canModify && apt.status === 'IN_PROGRESS' && (
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => handleUpdateStatus(apt.id, 'COMPLETED')}
                        >
                          Complete
                        </Button>
                      )}
                      {canModify && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          onClick={() => {
                            setCancelTargetId(apt.id);
                            setIsCancelModalOpen(true);
                          }}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Book Appointment Modal */}
      <Modal
        isOpen={isBookModalOpen}
        onClose={() => setIsBookModalOpen(false)}
        title="Schedule Clinical Appointment"
        description="Book a consultation slot with real-time physician availability check"
        size="lg"
      >
        <form onSubmit={handleBookSubmit} className="space-y-4">
          {bookError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{bookError}</span>
            </div>
          )}

          {!isPatient && (
            <Select
              label="Select Patient"
              required
              value={bookingData.patientId}
              onChange={(e) => setBookingData({ ...bookingData, patientId: e.target.value })}
            >
              <option value="">-- Choose Registered Patient --</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (MRN: {p.mrn} • {p.phone || 'No phone'})
                </option>
              ))}
            </Select>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Department"
              value={bookingData.departmentId}
              onChange={(e) =>
                setBookingData({
                  ...bookingData,
                  departmentId: e.target.value,
                  doctorId: '',
                  timeSlot: '',
                })
              }
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </Select>

            <Select
              label="Consulting Doctor"
              required
              value={bookingData.doctorId}
              onChange={(e) =>
                setBookingData({ ...bookingData, doctorId: e.target.value, timeSlot: '' })
              }
            >
              <option value="">-- Select Physician --</option>
              {filteredDoctors.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  Dr. {doc.user?.name || 'Physician'} ({doc.specialization} • Fee: ₹{Number(doc.consultationFee)})
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Appointment Date"
              type="date"
              required
              min={new Date().toISOString().split('T')[0]}
              value={bookingData.date}
              onChange={(e) =>
                setBookingData({ ...bookingData, date: e.target.value, timeSlot: '' })
              }
            />

            <Select
              label="Appointment Category"
              value={bookingData.type}
              onChange={(e) => setBookingData({ ...bookingData, type: e.target.value })}
              options={[
                { value: 'REGULAR', label: 'Initial Consultation' },
                { value: 'FOLLOW_UP', label: 'Follow-up Visit' },
                { value: 'EMERGENCY', label: 'Urgent / Priority' },
              ]}
            />
          </div>

          {/* Time Slot Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 tracking-wide uppercase mb-1">
              Available Time Slots <span className="text-rose-500">*</span>
            </label>
            {loadingSlots ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded text-center text-xs text-slate-500">
                Checking physician clinic schedule...
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                Doctor is not available on this date. Please select another date.
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-40 overflow-y-auto p-1">
                {availableSlots.map((slot) => {
                  const isSelected = bookingData.timeSlot === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setBookingData({ ...bookingData, timeSlot: slot })}
                      className={`p-2 rounded-lg text-xs font-semibold transition-colors border ${
                        isSelected
                          ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-[#2563EB] hover:text-[#2563EB]'
                      }`}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 tracking-wide uppercase mb-1">
              Reason for Visit / Symptoms
            </label>
            <textarea
              rows={2}
              value={bookingData.reason}
              onChange={(e) => setBookingData({ ...bookingData, reason: e.target.value })}
              placeholder="e.g. Persistent headache for 3 days, routine follow-up"
              className="w-full text-xs rounded-xl border border-[#E2E8F0] p-2.5 text-slate-900 focus:outline-none focus:border-[#2563EB]"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsBookModalOpen(false)}
              disabled={isBooking}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isBooking}
              disabled={!bookingData.timeSlot}
            >
              Confirm Appointment
            </Button>
          </div>
        </form>
      </Modal>

      {/* Cancel Appointment Modal */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Cancel Scheduled Appointment"
        description="Are you sure you want to cancel this appointment?"
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Cancellation Reason"
            required
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="e.g. Patient requested reschedule, doctor unavailable"
          />

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <Button
              variant="outline"
              size="md"
              onClick={() => setIsCancelModalOpen(false)}
              disabled={isCancelling}
            >
              Keep Appointment
            </Button>
            <Button
              variant="danger"
              size="md"
              isLoading={isCancelling}
              onClick={handleConfirmCancel}
            >
              Confirm Cancellation
            </Button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}
