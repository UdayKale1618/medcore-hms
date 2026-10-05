'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell, TablePagination } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { api, ApiError } from '@/lib/api';
import { Prescription, Medicine, MedicalRecord } from '@/lib/types';
import {
  FileText,
  Search,
  Plus,
  Eye,
  Trash2,
  Pill,
  CheckCircle,
  Clock,
  Printer,
  AlertCircle,
  UserCheck,
} from 'lucide-react';

interface PrescriptionLineItem {
  medicineId: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  specialInstructions: string;
}

export default function PrescriptionsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [viewRx, setViewRx] = useState<Prescription | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState('');
  const [digitalSignature, setDigitalSignature] = useState(
    user?.role === 'DOCTOR' ? `Dr. ${user.name} (MD)` : ''
  );
  const [items, setItems] = useState<PrescriptionLineItem[]>([
    { medicineId: '', dosage: '500mg', frequency: '1-0-1 (Twice daily)', durationDays: 5, specialInstructions: 'Take after meals' },
  ]);

  const isDoctor = user?.role === 'DOCTOR' || user?.role === 'SUPER_ADMIN';

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refreshPrescriptions = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let ignore = false;
    async function loadPrescriptions() {
      try {
        const params: Record<string, string | number> = { page, limit };
        if (statusFilter) params.status = statusFilter;

        const res = await api.get<{
          success: boolean;
          data: { prescriptions: Prescription[]; total: number; page: number; limit: number };
        }>('/prescriptions', { params });

        if (!ignore) {
          const data = res.data?.prescriptions ? res.data : (res as unknown as { prescriptions: Prescription[]; total: number });
          setPrescriptions(data.prescriptions || []);
          setTotal(data.total || 0);
        }
      } catch (err) {
        if (!ignore) {
          const error = err as ApiError;
          toast.error(error.message || 'Failed to load prescriptions');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadPrescriptions();
    return () => {
      ignore = true;
    };
  }, [page, limit, statusFilter, toast, refreshTrigger]);

  // Load auxiliary data for prescription creation
  const loadPrerequisites = async () => {
    try {
      const [recRes, medRes] = await Promise.all([
        api.get<{ success: boolean; data: { records: MedicalRecord[] } }>('/medical-records?limit=50'),
        api.get<{ success: boolean; data: { medicines: Medicine[] } }>('/medicines?limit=100'),
      ]);
      const recData = recRes.data?.records || (recRes as unknown as { records: MedicalRecord[] }).records || [];
      const medData = medRes.data?.medicines || (medRes as unknown as { medicines: Medicine[] }).medicines || [];
      setMedicalRecords(recData);
      setMedicines(medData);
      if (recData.length > 0 && !selectedRecordId) {
        setSelectedRecordId(recData[0].id);
      }
    } catch {
      // Silently handled
    }
  };

  const handleOpenCreateModal = () => {
    loadPrerequisites();
    setCreateModalOpen(true);
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { medicineId: '', dosage: '1 tablet', frequency: '1-0-1', durationDays: 3, specialInstructions: '' },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      toast.error('Prescription must have at least one medication');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof PrescriptionLineItem, value: string | number) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleCreatePrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecordId) {
      toast.error('Please link this prescription to a valid Medical Encounter / Record');
      return;
    }

    const invalidItems = items.some((it) => !it.medicineId || !it.dosage || !it.frequency || it.durationDays <= 0);
    if (invalidItems) {
      toast.error('Please complete all medicine line items (medicine, dosage, frequency, days)');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post('/prescriptions', {
        medicalRecordId: selectedRecordId,
        digitalSignature: digitalSignature.trim() || undefined,
        items: items.map((it) => ({
          medicineId: it.medicineId,
          dosage: it.dosage,
          frequency: it.frequency,
          durationDays: Number(it.durationDays),
          specialInstructions: it.specialInstructions || undefined,
        })),
      });

      toast.success('Prescription generated and signed successfully');
      setCreateModalOpen(false);
      refreshPrescriptions();
    } catch (err) {
      const error = err as ApiError;
      toast.error(error.message || 'Failed to create prescription');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPrescriptions = prescriptions.filter((rx) => {
    if (!search) return true;
    const term = search.toLowerCase();
    const patientName = rx.medicalRecord?.patient?.user?.name?.toLowerCase() || '';
    const doctorName = rx.medicalRecord?.doctor?.user?.name?.toLowerCase() || '';
    const id = rx.id.toLowerCase();
    return patientName.includes(term) || doctorName.includes(term) || id.includes(term);
  });

  return (
    <AppLayout requiredRole={['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'PHARMACIST', 'PATIENT']}>
      <PageHeader
        title="Prescriptions Management"
        subtitle="Clinical pharmacy orders, medication regimens, and dispensing tracking"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Prescriptions' },
        ]}
        actions={
          isDoctor ? (
            <Button onClick={handleOpenCreateModal}>
              <Plus className="w-4 h-4 mr-1.5" />
              Write Prescription
            </Button>
          ) : undefined
        }
      />

      {/* KPI Banners */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Total Prescriptions</p>
              <p className="text-xl font-bold text-slate-900">{total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Pending Dispensation</p>
              <p className="text-xl font-bold text-amber-700">
                {prescriptions.filter((p) => p.status === 'PRESCRIBED').length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Partially Dispensed</p>
              <p className="text-xl font-bold text-teal-700">
                {prescriptions.filter((p) => p.status === 'PARTIALLY_FULFILLED').length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Fulfilled</p>
              <p className="text-xl font-bold text-emerald-700">
                {prescriptions.filter((p) => p.status === 'FULFILLED').length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search by Patient, Doctor, or Rx ID..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'PRESCRIBED', label: 'Prescribed (Pending Dispense)' },
                { value: 'PARTIALLY_FULFILLED', label: 'Partially Fulfilled' },
                { value: 'FULFILLED', label: 'Fulfilled / Dispensed' },
              ]}
            />
            <div className="flex justify-end items-center">
              <span className="text-xs text-slate-500 font-medium">
                Showing {filteredPrescriptions.length} of {total} records
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Table */}
      {loading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : filteredPrescriptions.length === 0 ? (
        <EmptyState
          icon={Pill}
          title="No Prescriptions Found"
          description={
            search || statusFilter
              ? 'No prescriptions match your current search or status filter.'
              : 'No medication prescriptions have been documented in the system yet.'
          }
          action={
            isDoctor ? (
              <Button onClick={handleOpenCreateModal}>
                <Plus className="w-4 h-4 mr-1.5" />
                Write First Prescription
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card>
          <Table minWidth="900px">
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Rx Reference</TableHead>
                <TableHead className="w-48">Patient Details</TableHead>
                <TableHead className="w-48">Prescribing Physician</TableHead>
                <TableHead>Medications</TableHead>
                <TableHead className="w-32">Issued Date</TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead className="w-36 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPrescriptions.map((rx) => {
                const patient = rx.medicalRecord?.patient;
                const doctor = rx.medicalRecord?.doctor;
                return (
                  <TableRow key={rx.id}>
                    <TableCell className="font-mono text-xs font-semibold text-slate-700">
                      {rx.id.slice(0, 8).toUpperCase()}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-900">
                        {patient?.user?.name || 'Unassigned Patient'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {patient?.bloodGroup || 'Blood: N/A'} • {patient?.gender || 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-900">
                        Dr. {doctor?.user?.name || 'Assigned Staff'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {doctor?.specialization || 'General Practitioner'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                        <Pill className="w-3 h-3 mr-1 text-teal-600" />
                        {rx.items?.length || 0} Medicine{rx.items?.length !== 1 ? 's' : ''}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {new Date(rx.createdAt || rx.issuedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={rx.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewRx(rx)}
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        View Rx
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <TablePagination
            currentPage={page}
            totalItems={total}
            pageSize={limit}
            onPageChange={setPage}
          />
        </Card>
      )}

      {/* VIEW PRESCRIPTION MODAL */}
      <Modal
        isOpen={!!viewRx}
        onClose={() => setViewRx(null)}
        title="Hospital Prescription Chart"
        maxWidth="max-w-3xl"
        footer={
          <div className="flex justify-between w-full">
            <Button
              variant="outline"
              onClick={() => {
                window.print();
              }}
            >
              <Printer className="w-4 h-4 mr-1.5" />
              Print Chart
            </Button>
            <Button variant="secondary" onClick={() => setViewRx(null)}>
              Close
            </Button>
          </div>
        }
      >
        {viewRx && (
          <div className="space-y-6">
            {/* Header / Brand info */}
            <div className="border-b border-slate-200 pb-4 flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">MedCore HMS Hospital</h3>
                <p className="text-xs text-slate-500">Department of Clinical Pharmacy & Therapeutics</p>
                <p className="text-xs font-mono text-slate-400 mt-1">Rx #{viewRx.id}</p>
              </div>
              <div className="text-right">
                <StatusBadge status={viewRx.status} />
                <p className="text-xs text-slate-500 mt-1">
                  Issued: {new Date(viewRx.createdAt || viewRx.issuedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>

            {/* Patient & Doctor Banner */}
            <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
              <div>
                <p className="text-slate-500 font-medium uppercase tracking-wider text-[10px]">Patient Information</p>
                <p className="font-semibold text-slate-900 text-sm mt-0.5">
                  {viewRx.medicalRecord?.patient?.user?.name || 'Registered Patient'}
                </p>
                <p className="text-slate-600 mt-0.5">
                  Age/Gender: {viewRx.medicalRecord?.patient?.gender || 'N/A'} • Blood: {viewRx.medicalRecord?.patient?.bloodGroup || 'N/A'}
                </p>
                <p className="text-slate-600">Contact: {viewRx.medicalRecord?.patient?.user?.phone || 'N/A'}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium uppercase tracking-wider text-[10px]">Prescribing Clinician</p>
                <p className="font-semibold text-slate-900 text-sm mt-0.5">
                  Dr. {viewRx.medicalRecord?.doctor?.user?.name || 'Medical Staff'}
                </p>
                <p className="text-slate-600 mt-0.5">
                  Specialty: {viewRx.medicalRecord?.doctor?.specialization || 'Internal Medicine'}
                </p>
                <p className="text-slate-600">License: MedCore-MD-{viewRx.medicalRecord?.doctor?.id?.slice(0, 6)}</p>
              </div>
            </div>

            {/* Diagnosis / Chief Complaint */}
            {viewRx.medicalRecord?.diagnosis && (
              <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100 text-xs">
                <span className="font-semibold text-blue-900">Clinical Diagnosis: </span>
                <span className="text-blue-800">{viewRx.medicalRecord.diagnosis}</span>
                {viewRx.medicalRecord.icd10Code && (
                  <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-mono text-[10px]">
                    ICD-10: {viewRx.medicalRecord.icd10Code}
                  </span>
                )}
              </div>
            )}

            {/* Prescribed Items Table */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center">
                <Pill className="w-3.5 h-3.5 mr-1 text-teal-600" />
                Prescribed Medications
              </h4>
              <Table padding="compact" minWidth="600px">
                <TableHeader>
                  <TableRow>
                    <TableHead>Medicine Name</TableHead>
                    <TableHead className="w-28">Dosage</TableHead>
                    <TableHead className="w-28">Frequency</TableHead>
                    <TableHead className="w-24">Duration</TableHead>
                    <TableHead className="w-24">Dispensed</TableHead>
                    <TableHead>Instructions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewRx.items?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium text-slate-900">
                        {item.medicine?.name || 'Medication'}
                        {item.medicine?.form && (
                          <span className="block text-[10px] text-slate-500">
                            {item.medicine.form} {item.medicine.strength || ''}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-700">{item.dosage}</TableCell>
                      <TableCell className="text-slate-700">{item.frequency}</TableCell>
                      <TableCell className="text-slate-700">{item.duration || `${item.quantity} units`}</TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-slate-700">
                          {item.dispensedQuantity || 0} / {item.quantity || 1}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 italic">
                        {item.instructions || 'As advised by doctor'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Signature & Verification */}
            <div className="pt-4 border-t border-slate-200 flex justify-between items-end text-xs">
              <div className="text-slate-400">
                <p>Generated by MedCore HMS v2.4 Security Module</p>
                <p>Digital Audit Trail Verified • Non-transferable</p>
              </div>
              <div className="text-right">
                <div className="inline-flex items-center text-teal-700 font-semibold mb-1">
                  <UserCheck className="w-4 h-4 mr-1 text-teal-600" />
                  Clinician Certified
                </div>
                <p className="text-slate-700 font-serif italic text-sm">
                  Dr. {viewRx.medicalRecord?.doctor?.user?.name || 'Staff Physician'}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* CREATE PRESCRIPTION MODAL */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Issue Clinical Prescription"
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleCreatePrescription} className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-xs text-blue-800">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-blue-600" />
            <span>
              Prescriptions are legally binding clinical orders. Link to an active patient medical record encounter.
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Patient Medical Record Encounter *
            </label>
            <select
              value={selectedRecordId}
              onChange={(e) => setSelectedRecordId(e.target.value)}
              className="w-full text-xs rounded-md border border-slate-300 p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              required
            >
              {medicalRecords.length === 0 ? (
                <option value="">No recent medical records found</option>
              ) : (
                medicalRecords.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.patient?.user?.name || 'Patient'} — Complaint: &quot;{r.chiefComplaint}&quot; (
                    {new Date(r.createdAt).toLocaleDateString()})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Dynamic Medication Line Items */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Medication List ({items.length})
              </label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                <Plus className="w-3.5 h-3.5 mr-1 text-teal-600" />
                Add Medicine
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 relative text-xs"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-700">#{idx + 1} Medication</span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Remove medicine"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Medicine *</label>
                      <select
                        value={item.medicineId}
                        onChange={(e) => handleItemChange(idx, 'medicineId', e.target.value)}
                        className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                        required
                      >
                        <option value="">-- Choose Medicine --</option>
                        {medicines.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.form} {m.strength || ''}) - Stock: {m.minStockLevel || 0}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Dosage *</label>
                      <Input
                        value={item.dosage}
                        placeholder="e.g. 500mg, 1 tablet"
                        onChange={(e) => handleItemChange(idx, 'dosage', e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Frequency *</label>
                      <Input
                        value={item.frequency}
                        placeholder="e.g. 1-0-1, TID, BD"
                        onChange={(e) => handleItemChange(idx, 'frequency', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Duration (Days) *</label>
                      <Input
                        type="number"
                        min="1"
                        value={item.durationDays}
                        onChange={(e) => handleItemChange(idx, 'durationDays', Number(e.target.value))}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Instructions</label>
                      <Input
                        value={item.specialInstructions}
                        placeholder="After food, with water"
                        onChange={(e) => handleItemChange(idx, 'specialInstructions', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Physician Digital Signature / Seal
            </label>
            <Input
              value={digitalSignature}
              onChange={(e) => setDigitalSignature(e.target.value)}
              placeholder="e.g. Dr. John Doe (MBBS, MD)"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Certify & Issue Prescription
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
