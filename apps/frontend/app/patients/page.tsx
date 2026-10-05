'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  UserPlus,
  Eye,
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
  TablePagination,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { useToast } from '@/lib/toast-context';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { Patient } from '@/lib/types';

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [bloodGroupFilter, setBloodGroupFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Register Modal State
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: 'MALE',
    bloodGroup: 'A+',
    address: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',
    allergies: '',
    medicalHistory: '',
  });

  const { toast } = useToast();
  const { hasRole } = useAuth();
  const canRegister = hasRole(['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'RECEPTIONIST', 'DOCTOR', 'NURSE']);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refreshPatients = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let ignore = false;
    async function fetchPatients() {
      try {
        const params: Record<string, string | number> = {
          page,
          limit: 10,
        };
        if (search.trim()) params.search = search.trim();
        if (genderFilter) params.gender = genderFilter;
        if (bloodGroupFilter) params.bloodGroup = bloodGroupFilter;

        const res = await api.get<Patient[] | { data: Patient[]; total: number; totalPages: number }>(
          '/patients',
          { params },
        );

        if (!ignore) {
          if (Array.isArray(res)) {
            setPatients(res);
            setTotalCount(res.length);
            setTotalPages(Math.ceil(res.length / 10) || 1);
          } else if (res && Array.isArray(res.data)) {
            setPatients(res.data);
            setTotalCount(res.total);
            setTotalPages(res.totalPages || 1);
          }
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : 'Failed to retrieve patient registry';
          toast.error('Error Loading Patients', msg);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    fetchPatients();
    return () => {
      ignore = true;
    };
  }, [page, search, genderFilter, bloodGroupFilter, toast, refreshTrigger]);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.gender) {
      setFormError('Patient full name and gender are required.');
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    try {
      const allergiesArr = formData.allergies
        ? formData.allergies.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

      await api.post('/patients', {
        name: formData.name,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
        gender: formData.gender,
        bloodGroup: formData.bloodGroup || undefined,
        address: formData.address || undefined,
        emergencyContactName: formData.emergencyContactName || undefined,
        emergencyContactPhone: formData.emergencyContactPhone || undefined,
        emergencyContactRelation: formData.emergencyContactRelation || undefined,
        allergies: allergiesArr,
        medicalHistory: formData.medicalHistory || undefined,
      });

      toast.success('Patient Registered', `Patient record for ${formData.name} created successfully.`);
      setIsRegisterOpen(false);
      setFormData({
        name: '',
        email: '',
        phone: '',
        dateOfBirth: '',
        gender: 'MALE',
        bloodGroup: 'A+',
        address: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        emergencyContactRelation: '',
        allergies: '',
        medicalHistory: '',
      });
      refreshPatients();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateAge = (dobString?: string | null) => {
    if (!dobString) return '—';
    const dob = new Date(dobString);
    const birthYear = dob.getFullYear();
    if (isNaN(birthYear)) return '—';
    return Math.max(0, 2026 - birthYear);
  };

  return (
    <AppLayout>
      <PageHeader
        title="Patient Directory & Registry"
        subtitle="Manage hospital patient demographics, clinical charts, and medical history"
        breadcrumbs={[{ label: 'Patients' }]}
        actions={
          canRegister && (
            <Button
              variant="primary"
              size="md"
              leftIcon={<UserPlus className="w-4 h-4" />}
              onClick={() => setIsRegisterOpen(true)}
            >
              Register New Patient
            </Button>
          )
        }
      />

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs mb-6 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="w-full md:w-80 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, phone, MRN..."
            className="w-full text-xs rounded-xl border border-[#E2E8F0] pl-9 pr-3 py-2 text-slate-900 focus:outline-none focus:border-[#2563EB]"
          />
        </div>

        <div className="w-full md:w-auto flex items-center gap-2 flex-wrap">
          <select
            value={genderFilter}
            onChange={(e) => {
              setGenderFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs rounded-xl border border-[#E2E8F0] px-3 py-2 bg-white text-slate-700 focus:outline-none focus:border-[#2563EB]"
          >
            <option value="">All Genders</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>

          <select
            value={bloodGroupFilter}
            onChange={(e) => {
              setBloodGroupFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs rounded-xl border border-[#E2E8F0] px-3 py-2 bg-white text-slate-700 focus:outline-none focus:border-[#2563EB]"
          >
            <option value="">All Blood Groups</option>
            <option value="A_POSITIVE">A+</option>
            <option value="A_NEGATIVE">A-</option>
            <option value="B_POSITIVE">B+</option>
            <option value="B_NEGATIVE">B-</option>
            <option value="AB_POSITIVE">AB+</option>
            <option value="AB_NEGATIVE">AB-</option>
            <option value="O_POSITIVE">O+</option>
            <option value="O_NEGATIVE">O-</option>
          </select>

          {(search || genderFilter || bloodGroupFilter) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setGenderFilter('');
                setBloodGroupFilter('');
                setPage(1);
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Patient Table */}
      {isLoading ? (
        <TableSkeleton rows={6} cols={7} />
      ) : patients.length === 0 ? (
        <EmptyState
          icon={<Users className="w-8 h-8 text-slate-400" />}
          title="No Patients Found"
          description={
            search || genderFilter || bloodGroupFilter
              ? "No hospital patient records match your current filter criteria."
              : "No patients have been registered into this hospital's database yet."
          }
          action={
            canRegister && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsRegisterOpen(true)}
              >
                Register First Patient
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-4">
          <Table minWidth="850px">
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">MRN</TableHead>
                <TableHead className="w-52">Patient Name</TableHead>
                <TableHead className="w-32">Age / Gender</TableHead>
                <TableHead className="w-32">Blood Group</TableHead>
                <TableHead className="w-40">Contact Phone</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-28 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {patients.map((patient) => (
                <TableRow key={patient.id}>
                  <TableCell className="font-mono text-xs font-semibold text-[#2563EB]">
                    {patient.mrn}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/patients/${patient.id}`}
                      className="font-semibold text-slate-900 hover:text-[#2563EB] hover:underline"
                    >
                      {patient.name}
                    </Link>
                    {patient.email && (
                      <p className="text-[11px] text-slate-400">{patient.email}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-slate-700">{calculateAge(patient.dateOfBirth)} yrs</span>
                    <span className="text-slate-400 text-xs ml-1">• {patient.gender}</span>
                  </TableCell>
                  <TableCell>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      {patient.bloodGroup ? patient.bloodGroup.replace('_', '') : 'Unknown'}
                    </span>
                  </TableCell>
                  <TableCell>{patient.phone || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={patient.isActive ? 'success' : 'neutral'} size="sm" dot>
                      {patient.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/patients/${patient.id}`}>
                      <Button variant="outline" size="sm" leftIcon={<Eye className="w-3.5 h-3.5" />}>
                        Clinical Chart
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <TablePagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalCount}
            pageSize={10}
            onPageChange={(newPage) => setPage(newPage)}
          />
        </div>
      )}

      {/* Patient Registration Modal */}
      <Modal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        title="Register New Patient"
        description="Add a new patient to MedCore Hospital Master Index"
        size="xl"
      >
        <form onSubmit={handleRegisterSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full Legal Name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Johnathan Doe"
            />
            <Input
              label="Email Address"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="patient@example.com"
            />
            <Input
              label="Contact Phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+91 98765 43210"
            />
            <Input
              label="Date of Birth"
              type="date"
              value={formData.dateOfBirth}
              onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
            />
            <Select
              label="Gender"
              required
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              options={[
                { value: 'MALE', label: 'Male' },
                { value: 'FEMALE', label: 'Female' },
                { value: 'OTHER', label: 'Other' },
              ]}
            />
            <Select
              label="Blood Group"
              value={formData.bloodGroup}
              onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
              options={[
                { value: 'A+', label: 'A+' },
                { value: 'A-', label: 'A-' },
                { value: 'B+', label: 'B+' },
                { value: 'B-', label: 'B-' },
                { value: 'AB+', label: 'AB+' },
                { value: 'AB-', label: 'AB-' },
                { value: 'O+', label: 'O+' },
                { value: 'O-', label: 'O-' },
              ]}
            />
          </div>

          <Input
            label="Residential Address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="Street address, city, pin code"
          />

          <div className="pt-2 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">
              Emergency Contact Information
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Contact Name"
                value={formData.emergencyContactName}
                onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                placeholder="Full name"
              />
              <Input
                label="Contact Phone"
                value={formData.emergencyContactPhone}
                onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                placeholder="+91 ..."
              />
              <Input
                label="Relationship"
                value={formData.emergencyContactRelation}
                onChange={(e) => setFormData({ ...formData, emergencyContactRelation: e.target.value })}
                placeholder="Spouse / Parent / Sibling"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">
              Clinical Background
            </h4>
            <div className="space-y-3">
              <Input
                label="Known Drug Allergies (comma-separated)"
                value={formData.allergies}
                onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                placeholder="e.g. Penicillin, Sulfa drugs, Aspirin"
              />
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                  Medical History & Pre-existing Conditions
                </label>
                <textarea
                  value={formData.medicalHistory}
                  onChange={(e) => setFormData({ ...formData, medicalHistory: e.target.value })}
                  placeholder="Hypertension, Type 2 Diabetes, Past surgeries..."
                  rows={2}
                  className="w-full text-xs rounded-xl border border-[#E2E8F0] p-2.5 text-slate-900 focus:outline-none focus:border-[#2563EB]"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsRegisterOpen(false)}
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
              Save Patient Record
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
