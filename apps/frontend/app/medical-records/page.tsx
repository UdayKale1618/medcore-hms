'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  FileText,
  Search,
  PlusCircle,
  Activity,
  AlertCircle,
  Eye,
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
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { useToast } from '@/lib/toast-context';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { MedicalRecord, Patient, Appointment } from '@/lib/types';
import {
  parseSymptoms,
  getRecordVitals,
  getPatientName,
  getDoctorName,
} from '@/lib/medical-record';

export default function MedicalRecordsPage() {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // New Record Modal
  const [isNewRecordOpen, setIsNewRecordOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Record Detail Modal
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);

  const [formData, setFormData] = useState({
    patientId: '',
    appointmentId: '',
    chiefComplaint: '',
    symptoms: '',
    diagnosis: '',
    icd10Code: '',
    treatmentPlan: '',
    allergies: '',
    adverseDrugReactions: '',
    notes: '',
    familyHistory: '',
    // Vitals
    bloodPressure: '120/80',
    heartRate: '72',
    temperature: '98.6',
    oxygenSaturation: '99',
    height: '170',
    weight: '70',
  });

  const { toast } = useToast();
  const { user, hasRole } = useAuth();
  const canCreate = hasRole(['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR']);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refreshRecords = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let ignore = false;
    async function fetchRecords() {
      try {
        const endpoint = user?.role === 'PATIENT' ? '/patient-portal/medical-records' : '/medical-records';
        const res = await api.get<MedicalRecord[]>(endpoint);
        if (!ignore) {
          setRecords(Array.isArray(res) ? res : []);
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : 'Failed to retrieve clinical records';
          toast.error('Records Error', msg);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    fetchRecords();
    return () => {
      ignore = true;
    };
  }, [user, toast, refreshTrigger]);

  // Load patients and appointments if doctor/admin
  useEffect(() => {
    if (canCreate) {
      Promise.allSettled([
        api.get<Patient[]>('/patients', { params: { limit: 100 } }),
        api.get<Appointment[]>('/appointments', { params: { limit: 100 } }),
      ]).then(([pRes, aRes]) => {
        if (pRes.status === 'fulfilled' && Array.isArray(pRes.value)) setPatients(pRes.value);
        if (aRes.status === 'fulfilled' && Array.isArray(aRes.value)) setAppointments(aRes.value);
      });
    }
  }, [canCreate]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.patientId || !formData.chiefComplaint || !formData.diagnosis || !formData.treatmentPlan) {
      setFormError('Patient, Chief Complaint, Diagnosis, and Treatment Plan are required.');
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    try {
      let targetAppointmentId = formData.appointmentId;
      if (!targetAppointmentId) {
        const patAppt = appointments.find((a) => a.patientId === formData.patientId);
        if (patAppt) {
          targetAppointmentId = patAppt.id;
        } else {
          setFormError('No appointment found for this patient. Please schedule an appointment before documenting an encounter.');
          setIsSubmitting(false);
          return;
        }
      }

      // Convert Fahrenheit temperature (> 45) to Celsius
      let tempC = Number(formData.temperature) || 37.0;
      if (tempC > 45) {
        tempC = parseFloat(((tempC - 32) * 5 / 9).toFixed(1));
      }

      const h = Number(formData.height) || 0;
      const w = Number(formData.weight) || 0;
      const bmi = h > 0 ? parseFloat((w / Math.pow(h / 100, 2)).toFixed(1)) : undefined;

      await api.post('/medical-records', {
        appointmentId: targetAppointmentId,
        patientId: formData.patientId,
        chiefComplaint: formData.chiefComplaint,
        symptoms: formData.symptoms || undefined,
        diagnosis: formData.diagnosis,
        icd10Code: formData.icd10Code || undefined,
        treatmentPlan: formData.treatmentPlan,
        allergies: formData.allergies || undefined,
        adverseDrugReactions: formData.adverseDrugReactions || undefined,
        notes: formData.notes || undefined,
        familyHistory: formData.familyHistory || undefined,
        bloodPressure: formData.bloodPressure || undefined,
        pulse: formData.heartRate ? Number(formData.heartRate) : 72,
        temperature: tempC,
        spo2: formData.oxygenSaturation ? Number(formData.oxygenSaturation) : 99,
        height: h || undefined,
        weight: w || undefined,
        bmi,
      });

      toast.success('Clinical Record Created', 'The medical encounter has been documented in the patient chart.');
      setIsNewRecordOpen(false);
      setFormData({
        patientId: '',
        appointmentId: '',
        chiefComplaint: '',
        symptoms: '',
        diagnosis: '',
        icd10Code: '',
        treatmentPlan: '',
        allergies: '',
        adverseDrugReactions: '',
        notes: '',
        familyHistory: '',
        bloodPressure: '120/80',
        heartRate: '72',
        temperature: '98.6',
        oxygenSaturation: '99',
        height: '170',
        weight: '70',
      });
      refreshRecords();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Record creation failed';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredRecords = records.filter((r) => {
    const pName = getPatientName(r.patient).toLowerCase();
    const diag = (r.diagnosis || '').toLowerCase();
    const chief = (r.chiefComplaint || '').toLowerCase();
    const symStr = typeof r.symptoms === 'string'
      ? r.symptoms.toLowerCase()
      : Array.isArray(r.symptoms)
      ? r.symptoms.join(' ').toLowerCase()
      : '';
    const q = search.toLowerCase();
    return pName.includes(q) || diag.includes(q) || chief.includes(q) || symStr.includes(q);
  });

  return (
    <AppLayout>
      <PageHeader
        title="Clinical Medical Records"
        subtitle="In-depth diagnostic records, clinical vitals, ICD-10 classifications, and treatment plans"
        breadcrumbs={[{ label: 'Medical Records' }]}
        actions={
          canCreate && (
            <Button
              variant="primary"
              size="md"
              leftIcon={<PlusCircle className="w-4 h-4" />}
              onClick={() => setIsNewRecordOpen(true)}
            >
              New Clinical Record
            </Button>
          )
        }
      />

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs mb-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-80 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by patient, diagnosis, or symptom..."
            className="w-full text-xs rounded-xl border border-[#E2E8F0] pl-9 pr-3 py-2 text-slate-900 focus:outline-none focus:border-[#2563EB]"
          />
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing {filteredRecords.length} clinical files
        </div>
      </div>

      {/* Records Table */}
      {isLoading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : filteredRecords.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-8 h-8 text-slate-400" />}
          title="No Medical Records Found"
          description="No documented clinical encounters match your search query."
          action={
            canCreate && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsNewRecordOpen(true)}
              >
                Create First Clinical Record
              </Button>
            )
          }
        />
      ) : (
        <Table minWidth="880px">
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Date</TableHead>
              <TableHead className="w-52">Patient Details</TableHead>
              <TableHead className="w-48">Physician</TableHead>
              <TableHead className="w-56">Clinical Diagnosis</TableHead>
              <TableHead>Vitals Recorded</TableHead>
              <TableHead className="w-24 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRecords.map((rec) => (
              <TableRow key={rec.id}>
                <TableCell className="font-medium text-slate-900">
                  {new Date(rec.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/patients/${rec.patientId}`}
                    className="font-semibold text-slate-900 hover:text-[#2563EB] hover:underline"
                  >
                    {getPatientName(rec.patient)}
                  </Link>
                  {rec.patient?.mrn && (
                    <p className="text-xs text-slate-400 font-mono">MRN: {rec.patient.mrn}</p>
                  )}
                </TableCell>
                <TableCell>
                  Dr. {getDoctorName(rec.doctor)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-slate-900 text-xs">{rec.diagnosis}</span>
                    {rec.icd10Code && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-blue-50 text-[#2563EB] border border-blue-200">
                        {rec.icd10Code}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                    {rec.chiefComplaint}
                  </p>
                </TableCell>
                <TableCell>
                  {(() => {
                    const v = getRecordVitals(rec);
                    if (!v) return <span className="text-xs text-slate-400">None</span>;
                    return (
                      <span className="text-xs text-slate-600">
                        BP: {v.bloodPressure || '—'} • Pulse: {v.pulse || v.heartRate ? `${v.pulse || v.heartRate} bpm` : '—'}
                      </span>
                    );
                  })()}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<Eye className="w-3.5 h-3.5" />}
                    onClick={() => setSelectedRecord(rec)}
                  >
                    View Chart
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* New Clinical Record Modal */}
      <Modal
        isOpen={isNewRecordOpen}
        onClose={() => setIsNewRecordOpen(false)}
        title="Document Clinical Encounter"
        description="Record comprehensive examination vitals, diagnosis, and treatment plan"
        size="2xl"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{formError}</span>
            </div>
          )}

          <Select
            label="Select Patient"
            required
            value={formData.patientId}
            onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
          >
            <option value="">-- Choose Registered Patient --</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (MRN: {p.mrn})
              </option>
            ))}
          </Select>

          {formData.patientId && (
            <Select
              label="Associated Appointment Encounter"
              value={formData.appointmentId}
              onChange={(e) => setFormData({ ...formData, appointmentId: e.target.value })}
            >
              <option value="">-- Choose Encounter Appointment (or auto-link) --</option>
              {appointments
                .filter((a) => a.patientId === formData.patientId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {new Date(a.appointmentDate).toLocaleDateString()} - {a.reason || 'Consultation'} ({a.status})
                  </option>
                ))}
            </Select>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Chief Complaint"
              required
              value={formData.chiefComplaint}
              onChange={(e) => setFormData({ ...formData, chiefComplaint: e.target.value })}
              placeholder="e.g. Acute chest pain radiating to left arm"
            />
            <Input
              label="Associated Symptoms (comma-separated)"
              value={formData.symptoms}
              onChange={(e) => setFormData({ ...formData, symptoms: e.target.value })}
              placeholder="Shortness of breath, dizziness, diaphoresis"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Clinical Diagnosis"
              required
              value={formData.diagnosis}
              onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
              placeholder="e.g. Unstable Angina"
            />
            <Input
              label="ICD-10 Code"
              value={formData.icd10Code}
              onChange={(e) => setFormData({ ...formData, icd10Code: e.target.value.toUpperCase() })}
              placeholder="e.g. I20.0"
            />
          </div>

          {/* Vitals Strip */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-3 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-[#2563EB]" /> Examination Vitals
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Input
                label="BP (mmHg)"
                value={formData.bloodPressure}
                onChange={(e) => setFormData({ ...formData, bloodPressure: e.target.value })}
                placeholder="120/80"
              />
              <Input
                label="Pulse (bpm)"
                type="number"
                value={formData.heartRate}
                onChange={(e) => setFormData({ ...formData, heartRate: e.target.value })}
                placeholder="72"
              />
              <Input
                label="Temp (°F)"
                value={formData.temperature}
                onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                placeholder="98.6"
              />
              <Input
                label="SpO2 (%)"
                type="number"
                value={formData.oxygenSaturation}
                onChange={(e) => setFormData({ ...formData, oxygenSaturation: e.target.value })}
                placeholder="99"
              />
              <Input
                label="Height (cm)"
                type="number"
                value={formData.height}
                onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                placeholder="170"
              />
              <Input
                label="Weight (kg)"
                type="number"
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                placeholder="70"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 tracking-wide uppercase mb-1">
              Treatment & Care Plan <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={formData.treatmentPlan}
              onChange={(e) => setFormData({ ...formData, treatmentPlan: e.target.value })}
              placeholder="Immediate medications, lifestyle modifications, follow-up schedule..."
              className="w-full text-xs rounded-xl border border-[#E2E8F0] p-2.5 text-slate-900 focus:outline-none focus:border-[#2563EB]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Documented Allergies"
              value={formData.allergies}
              onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
              placeholder="e.g. Aspirin, Penicillin"
            />
            <Input
              label="Adverse Drug Reactions"
              value={formData.adverseDrugReactions}
              onChange={(e) => setFormData({ ...formData, adverseDrugReactions: e.target.value })}
              placeholder="e.g. Cutaneous rash, Nausea"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Family Clinical History"
              value={formData.familyHistory}
              onChange={(e) => setFormData({ ...formData, familyHistory: e.target.value })}
              placeholder="CAD in father, T2DM in mother"
            />
            <Input
              label="Clinical Notes / Follow-up"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Follow up in 4 weeks for evaluation"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsNewRecordOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
            >
              Save Clinical Chart
            </Button>
          </div>
        </form>
      </Modal>

      {/* Record View Modal */}
      <Modal
        isOpen={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        title={selectedRecord ? `Clinical Encounter: ${selectedRecord.diagnosis || 'Medical Record'}` : 'Record'}
        description={
          selectedRecord
            ? `Patient: ${getPatientName(selectedRecord.patient)} • Encounter Date: ${
                selectedRecord.createdAt
                  ? new Date(selectedRecord.createdAt).toLocaleDateString()
                  : ''
              }`
            : ''
        }
        size="xl"
      >
        {selectedRecord && (
          <div className="space-y-4 text-xs">
            {/* Patient, Doctor, Date Header */}
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-slate-500 block text-[11px] uppercase tracking-wider font-semibold">
                  Patient
                </span>
                <span className="font-bold text-slate-900 text-sm">
                  {getPatientName(selectedRecord.patient)}
                </span>
                {selectedRecord.patient?.mrn && (
                  <span className="block text-[11px] font-mono text-slate-500">
                    MRN: {selectedRecord.patient.mrn}
                  </span>
                )}
              </div>
              <div>
                <span className="text-slate-500 block text-[11px] uppercase tracking-wider font-semibold">
                  Attending Physician
                </span>
                <span className="font-bold text-slate-900 text-sm">
                  Dr. {getDoctorName(selectedRecord.doctor)}
                </span>
                {selectedRecord.doctor?.specialization && (
                  <span className="block text-[11px] text-slate-500">
                    {selectedRecord.doctor.specialization}
                  </span>
                )}
              </div>
              <div>
                <span className="text-slate-500 block text-[11px] uppercase tracking-wider font-semibold">
                  Encounter Date
                </span>
                <span className="font-semibold text-slate-900 text-sm">
                  {selectedRecord.createdAt
                    ? new Date(selectedRecord.createdAt).toLocaleDateString(undefined, {
                        dateStyle: 'medium',
                      })
                    : '—'}
                </span>
              </div>
            </div>

            {/* Chief Complaint */}
            <div>
              <span className="font-bold text-slate-700 block uppercase tracking-wide text-[11px]">
                Chief Complaint:
              </span>
              <p className="p-2.5 bg-white rounded-lg border border-slate-200 text-slate-800 mt-1">
                {selectedRecord.chiefComplaint || 'None documented'}
              </p>
            </div>

            {/* Symptoms */}
            <div>
              <span className="font-bold text-slate-700 block uppercase tracking-wide text-[11px]">
                Symptoms:
              </span>
              {(() => {
                const symptomList = parseSymptoms(selectedRecord.symptoms);
                if (symptomList.length === 0) {
                  return (
                    <p className="p-2.5 bg-white rounded-lg border border-slate-200 text-slate-400 italic mt-1">
                      No symptoms documented.
                    </p>
                  );
                }
                if (symptomList.length > 1) {
                  return (
                    <div className="flex gap-1.5 flex-wrap mt-1.5">
                      {symptomList.map((s, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-[#2563EB] border border-blue-200 shadow-2xs"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  );
                }
                return (
                  <p className="p-2.5 bg-white rounded-lg border border-slate-200 text-slate-800 mt-1 leading-relaxed">
                    {symptomList[0]}
                  </p>
                );
              })()}
            </div>

            {/* Diagnosis & ICD-10 */}
            <div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 block uppercase tracking-wide text-[11px]">
                  Clinical Diagnosis:
                </span>
                {selectedRecord.icd10Code && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-blue-50 text-[#2563EB] border border-blue-200 font-semibold">
                    ICD-10: {selectedRecord.icd10Code}
                  </span>
                )}
              </div>
              <p className="p-2.5 bg-white rounded-lg border border-slate-200 text-slate-800 mt-1 font-semibold">
                {selectedRecord.diagnosis || 'Clinical evaluation pending'}
              </p>
            </div>

            {/* Treatment Plan */}
            <div>
              <span className="font-bold text-slate-700 block uppercase tracking-wide text-[11px]">
                Treatment Plan:
              </span>
              <p className="p-2.5 bg-white rounded-lg border border-slate-200 text-slate-800 mt-1 whitespace-pre-line leading-relaxed">
                {selectedRecord.treatmentPlan || 'None documented'}
              </p>
            </div>

            {/* Allergies & Adverse Drug Reactions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="font-bold text-slate-700 block uppercase tracking-wide text-[11px]">
                  Documented Allergies:
                </span>
                <p className="p-2.5 bg-white rounded-lg border border-slate-200 text-slate-800 mt-1">
                  {selectedRecord.allergies || 'No known drug allergies (NKDA)'}
                </p>
              </div>
              <div>
                <span className="font-bold text-slate-700 block uppercase tracking-wide text-[11px]">
                  Adverse Drug Reactions:
                </span>
                <p className="p-2.5 bg-white rounded-lg border border-slate-200 text-slate-800 mt-1">
                  {selectedRecord.adverseDrugReactions ||
                    selectedRecord.adverseReactions ||
                    'None documented'}
                </p>
              </div>
            </div>

            {/* Examination Vitals */}
            <div>
              <span className="font-bold text-slate-700 uppercase tracking-wide block text-[11px] mb-1">
                Examination Vitals:
              </span>
              {(() => {
                const v = getRecordVitals(selectedRecord);
                if (!v) {
                  return (
                    <p className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-400 italic">
                      No clinical vitals documented for this encounter.
                    </p>
                  );
                }
                return (
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-slate-800 text-xs">
                      <div>
                        <span className="text-slate-500">BP:</span>{' '}
                        <strong>{v.bloodPressure || '—'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Pulse:</span>{' '}
                        <strong>
                          {v.pulse || v.heartRate ? `${v.pulse || v.heartRate} bpm` : '—'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Temp:</span>{' '}
                        <strong>{v.temperature ? `${v.temperature}°F` : '—'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">SpO2:</span>{' '}
                        <strong>
                          {v.oxygenSaturation || v.spo2
                            ? `${v.oxygenSaturation || v.spo2}%`
                            : '—'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Height:</span>{' '}
                        <strong>{v.height ? `${v.height} cm` : '—'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Weight:</span>{' '}
                        <strong>{v.weight ? `${v.weight} kg` : '—'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">BMI:</span>{' '}
                        <strong>{v.bmi || '—'}</strong>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Family History & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="font-bold text-slate-700 block uppercase tracking-wide text-[11px]">
                  Family Clinical History:
                </span>
                <p className="p-2.5 bg-white rounded-lg border border-slate-200 text-slate-800 mt-1">
                  {selectedRecord.familyHistory || 'No significant family history documented'}
                </p>
              </div>
              <div>
                <span className="font-bold text-slate-700 block uppercase tracking-wide text-[11px]">
                  Clinical Notes / Follow-up:
                </span>
                <p className="p-2.5 bg-white rounded-lg border border-slate-200 text-slate-800 mt-1 whitespace-pre-line">
                  {selectedRecord.notes || 'No additional clinical notes'}
                </p>
              </div>
            </div>

            <div className="pt-4 flex justify-end border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setSelectedRecord(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </AppLayout>
  );
}
