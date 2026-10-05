'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  Users,
  Calendar,
  FileText,
  Stethoscope,
  FlaskConical,
  CreditCard,
  Phone,
  Mail,
  AlertTriangle,
  ArrowLeft,
  PlusCircle,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge, Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { CardSkeleton } from '@/components/ui/loading-skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/lib/toast-context';
import { api } from '@/lib/api';
import type {
  Patient,
  Appointment,
  MedicalRecord,
  Prescription,
  LabOrder,
  Invoice,
} from '@/lib/types';
import { getRecordVitals } from '@/lib/medical-record';

export default function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const patientId = resolvedParams.id;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);

  const { toast } = useToast();

  useEffect(() => {
    async function loadPatientDetails() {
      setIsLoading(true);
      try {
        const [patRes, aptRes, recRes, prsRes, labRes, invRes] =
          await Promise.allSettled([
            api.get<Patient>(`/patients/${patientId}`),
            api.get<Appointment[]>('/appointments', { params: { patientId } }),
            api.get<MedicalRecord[]>('/medical-records', { params: { patientId } }),
            api.get<Prescription[]>('/prescriptions', { params: { patientId } }),
            api.get<LabOrder[]>('/lab-orders', { params: { patientId } }),
            api.get<Invoice[]>('/invoices', { params: { patientId } }),
          ]);

        if (patRes.status === 'fulfilled') setPatient(patRes.value);
        if (aptRes.status === 'fulfilled' && Array.isArray(aptRes.value)) setAppointments(aptRes.value);
        if (recRes.status === 'fulfilled' && Array.isArray(recRes.value)) setRecords(recRes.value);
        if (prsRes.status === 'fulfilled' && Array.isArray(prsRes.value)) setPrescriptions(prsRes.value);
        if (labRes.status === 'fulfilled' && Array.isArray(labRes.value)) setLabOrders(labRes.value);
        if (invRes.status === 'fulfilled' && Array.isArray(invRes.value)) setInvoices(invRes.value);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to retrieve patient file';
        toast.error('Patient Load Error', msg);
      } finally {
        setIsLoading(false);
      }
    }
    loadPatientDetails();
  }, [patientId, toast]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </AppLayout>
    );
  }

  if (!patient) {
    return (
      <AppLayout>
        <EmptyState
          icon={<AlertTriangle className="w-8 h-8 text-rose-500" />}
          title="Patient Record Not Found"
          description="The requested patient file does not exist or has been archived."
          action={
            <Link href="/patients">
              <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Back to Patient Directory
              </Button>
            </Link>
          }
        />
      </AppLayout>
    );
  }

  const calculateAge = (dobString?: string | null) => {
    if (!dobString) return '—';
    const dob = new Date(dobString);
    const birthYear = dob.getFullYear();
    if (isNaN(birthYear)) return '—';
    return Math.max(0, 2026 - birthYear);
  };

  const tabs = [
    { id: 'overview', label: 'Overview & Profile', icon: <Users className="w-4 h-4" /> },
    {
      id: 'appointments',
      label: 'Appointments',
      badge: appointments.length,
      icon: <Calendar className="w-4 h-4" />,
    },
    {
      id: 'records',
      label: 'Clinical Records',
      badge: records.length,
      icon: <FileText className="w-4 h-4" />,
    },
    {
      id: 'prescriptions',
      label: 'Prescriptions',
      badge: prescriptions.length,
      icon: <Stethoscope className="w-4 h-4" />,
    },
    {
      id: 'lab',
      label: 'Diagnostics',
      badge: labOrders.length,
      icon: <FlaskConical className="w-4 h-4" />,
    },
    {
      id: 'billing',
      label: 'Billing & Invoices',
      badge: invoices.length,
      icon: <CreditCard className="w-4 h-4" />,
    },
  ];

  return (
    <AppLayout>
      <PageHeader
        title={patient.name}
        subtitle={`MRN: ${patient.mrn} • Hospital Clinical Chart`}
        breadcrumbs={[
          { label: 'Patients', href: '/patients' },
          { label: patient.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/appointments?patientId=${patient.id}`}>
              <Button variant="primary" size="sm" leftIcon={<PlusCircle className="w-4 h-4" />}>
                Book Visit
              </Button>
            </Link>
            <Link href="/patients">
              <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Back
              </Button>
            </Link>
          </div>
        }
      />

      {/* Patient Clinical Banner Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs mb-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold text-xl shadow-xs">
              {patient.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900">{patient.name}</h2>
                <Badge variant={patient.isActive ? 'success' : 'neutral'} size="sm" dot>
                  {patient.isActive ? 'Active Patient' : 'Inactive'}
                </Badge>
                {patient.bloodGroup && (
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
                    Blood Group: {patient.bloodGroup.replace('_', '')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500 mt-1 flex-wrap">
                <span>
                  <strong className="text-slate-700">MRN:</strong> {patient.mrn}
                </span>
                <span>
                  <strong className="text-slate-700">Age:</strong> {calculateAge(patient.dateOfBirth)} yrs ({patient.gender})
                </span>
                {patient.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> {patient.phone}
                  </span>
                )}
                {patient.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400" /> {patient.email}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Known Allergies Warning Strip */}
        {patient.allergies && patient.allergies.length > 0 && (
          <div className="mt-4 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Allergy Alert:</strong>{' '}
              {Array.isArray(patient.allergies) ? patient.allergies.join(', ') : patient.allergies}
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="mb-6" />

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Demographic & Contact Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Legal Name</span>
                <span className="font-semibold text-slate-900">{patient.name}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Medical Record Number</span>
                <span className="font-mono font-semibold text-[#2563EB]">{patient.mrn}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Date of Birth</span>
                <span className="font-medium text-slate-900">
                  {patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString() : '—'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Gender</span>
                <span className="font-medium text-slate-900">{patient.gender}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Contact Number</span>
                <span className="font-medium text-slate-900">{patient.phone || '—'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Residential Address</span>
                <span className="font-medium text-slate-900 text-right max-w-xs">{patient.address || '—'}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Emergency Contact & Medical History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Emergency Contact</span>
                <span className="font-semibold text-slate-900">
                  {patient.emergencyContactName || 'None listed'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Relationship</span>
                <span className="font-medium text-slate-900">
                  {patient.emergencyContactRelation || '—'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Emergency Phone</span>
                <span className="font-medium text-slate-900">
                  {patient.emergencyContactPhone || '—'}
                </span>
              </div>
              <div className="pt-2">
                <span className="text-slate-500 block mb-1">Pre-existing Medical History:</span>
                <p className="p-2.5 bg-slate-50 rounded border border-slate-200 text-slate-700 leading-relaxed">
                  {patient.medicalHistory || 'No pre-existing clinical conditions noted.'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 2: Appointments */}
      {activeTab === 'appointments' && (
        <Card>
          <CardHeader>
            <CardTitle>Patient Appointment History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {appointments.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No appointment history for this patient.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appointments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium text-slate-900">
                        {a.appointmentDate} at {a.timeSlot}
                      </TableCell>
                      <TableCell>Dr. {a.doctor?.user?.name || 'Assigned Doctor'}</TableCell>
                      <TableCell>{a.department?.name || 'Department'}</TableCell>
                      <TableCell>{a.reason || 'General Consultation'}</TableCell>
                      <TableCell>
                        <StatusBadge status={a.status} size="sm" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Medical Records */}
      {activeTab === 'records' && (
        <div className="space-y-4">
          {records.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-xs text-slate-500">
                No clinical encounters or medical records recorded yet.
              </CardContent>
            </Card>
          ) : (
            records.map((r) => (
              <Card key={r.id}>
                <CardHeader>
                  <div>
                    <CardTitle>Encounter: {r.diagnosis}</CardTitle>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Recorded on {new Date(r.createdAt).toLocaleDateString()} by Dr. {r.doctor?.user?.name || 'Physician'}
                    </p>
                  </div>
                  {r.icd10Code && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-blue-50 text-[#2563EB] border border-blue-200">
                      ICD-10: {r.icd10Code}
                    </span>
                  )}
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div>
                    <span className="font-semibold text-slate-700 block">Chief Complaint:</span>
                    <p className="text-slate-600 mt-0.5">{r.chiefComplaint}</p>
                  </div>

                  {(() => {
                    const v = getRecordVitals(r);
                    if (!v) return null;
                    return (
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wide block mb-2">
                          Clinical Vitals
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-700">
                          <div>
                            <span className="text-slate-400">BP:</span> {v.bloodPressure || '—'}
                          </div>
                          <div>
                            <span className="text-slate-400">Pulse:</span>{' '}
                            {v.pulse || v.heartRate ? `${v.pulse || v.heartRate} bpm` : '—'}
                          </div>
                          <div>
                            <span className="text-slate-400">Temp:</span>{' '}
                            {v.temperature ? `${v.temperature}°F` : '—'}
                          </div>
                          <div>
                            <span className="text-slate-400">SpO2:</span>{' '}
                            {v.oxygenSaturation || v.spo2
                              ? `${v.oxygenSaturation || v.spo2}%`
                              : '—'}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div>
                    <span className="font-semibold text-slate-700 block">Treatment Plan:</span>
                    <p className="text-slate-600 mt-0.5">{r.treatmentPlan}</p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Tab 4: Prescriptions */}
      {activeTab === 'prescriptions' && (
        <Card>
          <CardHeader>
            <CardTitle>Prescription Records</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {prescriptions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No active or past prescriptions on file.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {prescriptions.map((rx) => (
                  <div key={rx.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-900">
                        Prescription #{rx.id.slice(0, 8)} • Issued {new Date(rx.issuedAt || rx.createdAt).toLocaleDateString()}
                      </span>
                      <StatusBadge status={rx.status} size="sm" />
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border border-slate-100 rounded">
                        <thead className="bg-slate-50 text-slate-600 font-semibold">
                          <tr>
                            <th className="p-2">Medication</th>
                            <th className="p-2">Dosage</th>
                            <th className="p-2">Frequency</th>
                            <th className="p-2">Duration</th>
                            <th className="p-2">Instructions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {rx.items?.map((item) => (
                            <tr key={item.id}>
                              <td className="p-2 font-medium text-slate-900">{item.medicine?.name || 'Drug'}</td>
                              <td className="p-2">{item.dosage}</td>
                              <td className="p-2">{item.frequency}</td>
                              <td className="p-2">{item.duration}</td>
                              <td className="p-2 text-slate-500">{item.instructions || 'As directed'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 5: Lab Reports */}
      {activeTab === 'lab' && (
        <Card>
          <CardHeader>
            <CardTitle>Laboratory Diagnostics</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {labOrders.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No laboratory tests ordered for this patient.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {labOrders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-semibold text-slate-900">
                        {o.orderNumber}
                      </TableCell>
                      <TableCell>{new Date(o.orderedAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <span className="font-semibold text-xs text-slate-700">{o.priority}</span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={o.status} size="sm" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 6: Billing */}
      {activeTab === 'billing' && (
        <Card>
          <CardHeader>
            <CardTitle>Hospital Invoices & Account Statements</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {invoices.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No billing statements generated for this patient.
              </div>
            ) : (
              <Table minWidth="650px">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Invoice #</TableHead>
                    <TableHead className="w-28">Subtotal</TableHead>
                    <TableHead className="w-24">Tax</TableHead>
                    <TableHead className="w-32">Total Amount</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-24 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-semibold text-slate-900">
                        #{inv.invoiceNumber}
                      </TableCell>
                      <TableCell>₹{Number(inv.subtotal).toLocaleString('en-IN')}</TableCell>
                      <TableCell>₹{Number(inv.tax).toLocaleString('en-IN')}</TableCell>
                      <TableCell className="font-bold text-[#2563EB]">
                        ₹{Number(inv.total).toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={inv.status} size="sm" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/billing?id=${inv.id}`}>
                          <Button variant="outline" size="sm">
                            View Bill
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </AppLayout>
  );
}
