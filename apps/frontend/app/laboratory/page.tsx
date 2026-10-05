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
import { MedicalRecord } from '@/lib/types';
import {
  FlaskConical,
  Search,
  Plus,
  FileCheck,
  Clock,
  CheckCircle,
  AlertTriangle,
  FileText,
  Activity,
  Edit,
  TestTube,
} from 'lucide-react';

interface BackendLabTest {
  id: string;
  name: string;
  description?: string | null;
  unit?: string | null;
  referenceMin?: number | null;
  referenceMax?: number | null;
}

interface BackendLabOrder {
  id: string;
  status: 'PENDING' | 'SAMPLE_COLLECTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  result?: string | null;
  resultValue?: number | null;
  reportUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  labTest?: BackendLabTest;
  medicalRecord?: {
    id: string;
    diagnosis: string;
    patient?: {
      id: string;
      gender?: string;
      bloodGroup?: string;
      user?: { name: string; phone?: string; email?: string };
    };
    doctor?: {
      id: string;
      specialization?: string;
      user?: { name: string };
    };
  };
}

export default function LaboratoryPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'orders' | 'catalog'>('orders');
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<BackendLabOrder[]>([]);
  const [tests, setTests] = useState<BackendLabTest[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [createOrderModalOpen, setCreateOrderModalOpen] = useState(false);
  const [createTestModalOpen, setCreateTestModalOpen] = useState(false);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<BackendLabOrder | null>(null);

  // Create Order Form State
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState('');
  const [selectedTestId, setSelectedTestId] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // Result Entry Form State
  const [resultText, setResultText] = useState('');
  const [resultValue, setResultValue] = useState<string>('');
  const [newStatus, setNewStatus] = useState<string>('COMPLETED');
  const [isSubmittingResult, setIsSubmittingResult] = useState(false);

  // Create Test Form State
  const [newTestName, setNewTestName] = useState('');
  const [newTestDesc, setNewTestDesc] = useState('');
  const [newTestUnit, setNewTestUnit] = useState('mg/dL');
  const [newTestMin, setNewTestMin] = useState<string>('70');
  const [newTestMax, setNewTestMax] = useState<string>('100');
  const [isSubmittingTest, setIsSubmittingTest] = useState(false);

  const isLabTech = user?.role === 'LAB_TECHNICIAN' || user?.role === 'HOSPITAL_ADMIN' || user?.role === 'SUPER_ADMIN';
  const isDoctor = user?.role === 'DOCTOR' || user?.role === 'SUPER_ADMIN';

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refreshLab = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      if (activeTab === 'orders') {
        try {
          const params: Record<string, string | number> = { page, limit };
          if (statusFilter) params.status = statusFilter;

          const res = await api.get<{
            success?: boolean;
            data?: { orders: BackendLabOrder[]; total: number };
            orders?: BackendLabOrder[];
          }>('/lab-orders', { params });

          if (!ignore) {
            const data = res.data?.orders ? res.data : (res as unknown as { orders: BackendLabOrder[]; total: number });
            setOrders(data.orders || (Array.isArray(res) ? res : []));
            setTotal(data.total || (Array.isArray(res) ? res.length : 0));
          }
        } catch (err) {
          if (!ignore) {
            const error = err as ApiError;
            toast.error(error.message || 'Failed to load laboratory orders');
          }
        } finally {
          if (!ignore) {
            setLoading(false);
          }
        }
      } else {
        try {
          const res = await api.get<{
            success?: boolean;
            data?: { tests: BackendLabTest[] };
            tests?: BackendLabTest[];
          }>('/lab-tests?limit=100');

          if (!ignore) {
            const tList = res.data?.tests || (res as unknown as { tests: BackendLabTest[] }).tests || (Array.isArray(res) ? res : []);
            setTests(tList);
            if (tList.length > 0 && !selectedTestId) {
              setSelectedTestId(tList[0].id);
            }
          }
        } catch {
          // Ignored
        } finally {
          if (!ignore) {
            setLoading(false);
          }
        }
      }
    }

    loadData();
    return () => {
      ignore = true;
    };
  }, [activeTab, page, limit, statusFilter, toast, refreshTrigger, selectedTestId]);

  // Open Create Order Modal
  const handleOpenCreateOrder = async () => {
    try {
      const testRes = await api.get<{ data?: { tests: BackendLabTest[] }; tests?: BackendLabTest[] }>('/lab-tests?limit=100');
      const tList = testRes.data?.tests || testRes.tests || (Array.isArray(testRes) ? testRes : []);
      setTests(tList);
      const recRes = await api.get<{ success?: boolean; data?: { records: MedicalRecord[] } }>('/medical-records?limit=50');
      const recs = recRes.data?.records || (recRes as unknown as { records: MedicalRecord[] }).records || [];
      setMedicalRecords(recs);
      if (recs.length > 0) setSelectedRecordId(recs[0].id);
      setCreateOrderModalOpen(true);
    } catch {
      toast.error('Failed to load clinical records for lab order');
    }
  };

  // Submit Create Lab Order
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecordId || !selectedTestId) {
      toast.error('Please select both a medical encounter and a laboratory test');
      return;
    }

    try {
      setIsSubmittingOrder(true);
      await api.post('/lab-orders', {
        medicalRecordId: selectedRecordId,
        labTestId: selectedTestId,
      });

      toast.success('Diagnostic laboratory order requested successfully');
      setCreateOrderModalOpen(false);
      refreshLab();
    } catch (err) {
      const error = err as ApiError;
      toast.error(error.message || 'Failed to request lab order');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Open Result Entry Modal
  const handleOpenResultModal = (order: BackendLabOrder) => {
    setSelectedOrder(order);
    setResultText(order.result || '');
    setResultValue(order.resultValue !== null && order.resultValue !== undefined ? String(order.resultValue) : '');
    setNewStatus(order.status === 'COMPLETED' ? 'COMPLETED' : 'COMPLETED');
    setResultModalOpen(true);
  };

  // Submit Result Entry
  const handleSubmitResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    try {
      setIsSubmittingResult(true);
      // 1. Update status
      if (newStatus !== selectedOrder.status) {
        await api.patch(`/lab-orders/${selectedOrder.id}/status`, { status: newStatus });
      }

      // 2. Update findings and value
      await api.patch(`/lab-orders/${selectedOrder.id}`, {
        result: resultText.trim() || undefined,
        resultValue: resultValue ? Number(resultValue) : undefined,
      });

      toast.success('Laboratory findings recorded and finalized');
      setResultModalOpen(false);
      refreshLab();
    } catch (err) {
      const error = err as ApiError;
      toast.error(error.message || 'Failed to update laboratory findings');
    } finally {
      setIsSubmittingResult(false);
    }
  };

  // Create Lab Test Specimen Catalog
  const handleCreateTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTestName) {
      toast.error('Test name is required');
      return;
    }

    try {
      setIsSubmittingTest(true);
      await api.post('/lab-tests', {
        name: newTestName.trim(),
        description: newTestDesc.trim() || undefined,
        unit: newTestUnit.trim() || undefined,
        referenceMin: newTestMin ? Number(newTestMin) : undefined,
        referenceMax: newTestMax ? Number(newTestMax) : undefined,
      });

      toast.success('New diagnostic test definition added to formulary');
      setCreateTestModalOpen(false);
      refreshLab();
    } catch (err) {
      const error = err as ApiError;
      toast.error(error.message || 'Failed to create test definition');
    } finally {
      setIsSubmittingTest(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (!search) return true;
    const term = search.toLowerCase();
    const pName = o.medicalRecord?.patient?.user?.name?.toLowerCase() || '';
    const tName = o.labTest?.name?.toLowerCase() || '';
    const dName = o.medicalRecord?.doctor?.user?.name?.toLowerCase() || '';
    return pName.includes(term) || tName.includes(term) || dName.includes(term);
  });

  return (
    <AppLayout requiredRole={['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'LAB_TECHNICIAN', 'DOCTOR', 'NURSE', 'PATIENT']}>
      <PageHeader
        title="Laboratory & Diagnostics"
        subtitle="Pathology specimens, diagnostic order pipeline, and verified clinical findings"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Laboratory' },
        ]}
        actions={
          <div className="flex gap-2">
            {isDoctor && (
              <Button onClick={handleOpenCreateOrder}>
                <Plus className="w-4 h-4 mr-1.5" />
                Order Lab Test
              </Button>
            )}
            {isLabTech && (
              <Button variant="outline" onClick={() => setCreateTestModalOpen(true)}>
                <TestTube className="w-4 h-4 mr-1.5" />
                Define Test
              </Button>
            )}
          </div>
        }
      />

      {/* KPI Banners */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Total Orders</p>
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
              <p className="text-xs text-slate-500 font-medium">Pending / Collection</p>
              <p className="text-xl font-bold text-amber-700">
                {orders.filter((o) => o.status === 'PENDING' || o.status === 'SAMPLE_COLLECTED').length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">In Analysis</p>
              <p className="text-xl font-bold text-teal-700">
                {orders.filter((o) => o.status === 'IN_PROGRESS').length}
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
              <p className="text-xs text-slate-500 font-medium">Completed Reports</p>
              <p className="text-xl font-bold text-emerald-700">
                {orders.filter((o) => o.status === 'COMPLETED').length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-6 bg-white rounded-t-lg px-2 pt-2">
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'orders'
              ? 'border-teal-600 text-teal-900 bg-teal-50/50 rounded-t'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FlaskConical className="w-4 h-4 text-teal-600" />
          Diagnostic Orders Queue
        </button>
        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'catalog'
              ? 'border-teal-600 text-teal-900 bg-teal-50/50 rounded-t'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <TestTube className="w-4 h-4 text-teal-600" />
          Test Assays Directory ({tests.length})
        </button>
      </div>

      {/* TAB 1: ORDERS */}
      {activeTab === 'orders' && (
        <div>
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="Search by Patient, Test, or Doctor..."
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
                    { value: 'PENDING', label: 'Pending Collection' },
                    { value: 'SAMPLE_COLLECTED', label: 'Sample Collected' },
                    { value: 'IN_PROGRESS', label: 'In Analysis' },
                    { value: 'COMPLETED', label: 'Completed' },
                    { value: 'CANCELLED', label: 'Cancelled' },
                  ]}
                />
                <div className="flex justify-end items-center">
                  <span className="text-xs text-slate-500 font-medium">
                    Showing {filteredOrders.length} records
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <TableSkeleton rows={6} cols={6} />
          ) : filteredOrders.length === 0 ? (
            <EmptyState
              icon={FlaskConical}
              title="No Diagnostic Orders"
              description="No laboratory diagnostic orders have been submitted under current filters."
              action={
                isDoctor ? (
                  <Button onClick={handleOpenCreateOrder}>
                    <Plus className="w-4 h-4 mr-1.5" />
                    Order First Diagnostic Test
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Card>
              <Table minWidth="920px">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">Order ID</TableHead>
                    <TableHead className="w-56">Test Assay</TableHead>
                    <TableHead className="w-48">Patient</TableHead>
                    <TableHead className="w-44">Ordered By</TableHead>
                    <TableHead className="min-w-[220px]">Findings / Result</TableHead>
                    <TableHead className="w-32">Status</TableHead>
                    <TableHead className="w-28 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => {
                    const patient = order.medicalRecord?.patient;
                    const doctor = order.medicalRecord?.doctor;
                    const test = order.labTest;

                    let isAbnormal = false;
                    if (
                      order.resultValue !== null &&
                      order.resultValue !== undefined &&
                      test?.referenceMin !== null &&
                      test?.referenceMax !== null &&
                      test?.referenceMin !== undefined &&
                      test?.referenceMax !== undefined
                    ) {
                      isAbnormal =
                        order.resultValue < test.referenceMin ||
                        order.resultValue > test.referenceMax;
                    }

                    return (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono text-xs font-semibold text-slate-700">
                          {order.id.slice(0, 8).toUpperCase()}
                        </TableCell>
                        <TableCell>
                          <div className="font-bold text-slate-900">{test?.name || 'Diagnostic Test'}</div>
                          {test?.unit && (
                            <div className="text-xs text-slate-500">
                              Norm: {test.referenceMin} - {test.referenceMax} {test.unit}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-900">{patient?.user?.name || 'Patient'}</div>
                          <div className="text-xs text-slate-500">
                            {patient?.gender || 'N/A'} • {patient?.bloodGroup || 'Blood: N/A'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-slate-800 text-xs font-medium">
                            Dr. {doctor?.user?.name || 'Physician'}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {doctor?.specialization || 'Clinical'}
                          </div>
                        </TableCell>
                        <TableCell>
                          {order.result ? (
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 text-xs">
                                  {order.resultValue !== null && order.resultValue !== undefined
                                    ? `${order.resultValue} ${test?.unit || ''}`
                                    : order.result}
                                </span>
                                {isAbnormal && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">
                                    <AlertTriangle className="w-3 h-3 mr-0.5" />
                                    Abnormal
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 line-clamp-1">{order.result}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Awaiting Findings</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={order.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          {isLabTech ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenResultModal(order)}
                            >
                              <Edit className="w-3.5 h-3.5 mr-1" />
                              {order.result ? 'Update Result' : 'Enter Result'}
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenResultModal(order)}
                            >
                              <FileText className="w-3.5 h-3.5 mr-1" />
                              View
                            </Button>
                          )}
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
        </div>
      )}

      {/* TAB 2: TEST CATALOG */}
      {activeTab === 'catalog' && (
        <div>
          {tests.length === 0 ? (
            <EmptyState
              icon={TestTube}
              title="No Test Assays Defined"
              description="Configure standard pathology test assays and reference ranges for this hospital."
              action={
                isLabTech ? (
                  <Button onClick={() => setCreateTestModalOpen(true)}>
                    <Plus className="w-4 h-4 mr-1.5" />
                    Define Assay
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Card>
              <Table minWidth="750px">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-64">Test Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-40">Measurement Unit</TableHead>
                    <TableHead className="w-56">Normal Reference Range</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tests.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-bold text-slate-900">{t.name}</TableCell>
                      <TableCell className="text-xs text-slate-600">{t.description || 'Clinical Assay'}</TableCell>
                      <TableCell className="font-mono text-xs text-slate-700">{t.unit || 'unit'}</TableCell>
                      <TableCell className="text-xs text-slate-800">
                        {t.referenceMin !== null && t.referenceMax !== null
                          ? `${t.referenceMin} – ${t.referenceMax} ${t.unit || ''}`
                          : 'Not specified'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      )}

      {/* ENTER / UPDATE RESULT MODAL */}
      <Modal
        isOpen={resultModalOpen}
        onClose={() => setResultModalOpen(false)}
        title="Diagnostic Report Entry"
        maxWidth="max-w-2xl"
      >
        {selectedOrder && (
          <form onSubmit={handleSubmitResult} className="space-y-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-900 text-sm">{selectedOrder.labTest?.name}</span>
                <StatusBadge status={selectedOrder.status} />
              </div>
              <p className="text-slate-600">
                Patient: <strong>{selectedOrder.medicalRecord?.patient?.user?.name}</strong> • Ordered by: Dr.{' '}
                {selectedOrder.medicalRecord?.doctor?.user?.name}
              </p>
              {selectedOrder.labTest?.referenceMin !== null && (
                <p className="text-slate-500 font-mono text-[11px]">
                  Clinical Reference Range: {selectedOrder.labTest?.referenceMin} – {selectedOrder.labTest?.referenceMax}{' '}
                  {selectedOrder.labTest?.unit}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Workflow Status *</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full text-xs rounded border border-slate-300 p-2 bg-white focus:outline-none focus:ring-1 focus:ring-teal-600"
                  disabled={!isLabTech}
                >
                  <option value="PENDING">Pending Collection</option>
                  <option value="SAMPLE_COLLECTED">Sample Collected</option>
                  <option value="IN_PROGRESS">In Analysis</option>
                  <option value="COMPLETED">Completed (Verified)</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Numeric Value ({selectedOrder.labTest?.unit || 'Value'})
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={resultValue}
                  onChange={(e) => setResultValue(e.target.value)}
                  placeholder="e.g. 94.5"
                  disabled={!isLabTech}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Findings, Morphology & Clinical Interpretation *
              </label>
              <textarea
                value={resultText}
                onChange={(e) => setResultText(e.target.value)}
                placeholder="Document pathological observation, specimen quality, and diagnostic summary..."
                className="w-full text-xs rounded border border-slate-300 p-2.5 h-24 focus:outline-none focus:ring-1 focus:ring-teal-600"
                required
                disabled={!isLabTech}
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <Button type="button" variant="outline" onClick={() => setResultModalOpen(false)}>
                Close
              </Button>
              {isLabTech && (
                <Button type="submit" isLoading={isSubmittingResult}>
                  <FileCheck className="w-4 h-4 mr-1.5" />
                  Finalize & Sign Report
                </Button>
              )}
            </div>
          </form>
        )}
      </Modal>

      {/* CREATE LAB ORDER MODAL */}
      <Modal
        isOpen={createOrderModalOpen}
        onClose={() => setCreateOrderModalOpen(false)}
        title="Order Laboratory Investigation"
      >
        <form onSubmit={handleCreateOrder} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Patient Medical Encounter *
            </label>
            <select
              value={selectedRecordId}
              onChange={(e) => setSelectedRecordId(e.target.value)}
              className="w-full text-xs rounded border border-slate-300 p-2 bg-white focus:outline-none focus:ring-1 focus:ring-teal-600"
              required
            >
              {medicalRecords.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.patient?.user?.name || 'Patient'} — Complaint: &quot;{r.chiefComplaint}&quot; (
                  {new Date(r.createdAt).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Diagnostic Assay / Test *
            </label>
            <select
              value={selectedTestId}
              onChange={(e) => setSelectedTestId(e.target.value)}
              className="w-full text-xs rounded border border-slate-300 p-2 bg-white focus:outline-none focus:ring-1 focus:ring-teal-600"
              required
            >
              {tests.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.unit ? `Norm: ${t.referenceMin}-${t.referenceMax} ${t.unit}` : 'Standard assay'})
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={() => setCreateOrderModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmittingOrder}>
              Transmit Order to Lab
            </Button>
          </div>
        </form>
      </Modal>

      {/* DEFINE TEST MODAL */}
      <Modal
        isOpen={createTestModalOpen}
        onClose={() => setCreateTestModalOpen(false)}
        title="Define New Diagnostic Test Assay"
      >
        <form onSubmit={handleCreateTest} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Test Name *</label>
            <Input
              value={newTestName}
              onChange={(e) => setNewTestName(e.target.value)}
              placeholder="e.g. Complete Blood Count (CBC) or Serum Creatinine"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <Input
              value={newTestDesc}
              onChange={(e) => setNewTestDesc(e.target.value)}
              placeholder="e.g. Renal function biomarker evaluation"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Unit</label>
              <Input
                value={newTestUnit}
                onChange={(e) => setNewTestUnit(e.target.value)}
                placeholder="mg/dL"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Ref Min</label>
              <Input
                type="number"
                step="0.01"
                value={newTestMin}
                onChange={(e) => setNewTestMin(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Ref Max</label>
              <Input
                type="number"
                step="0.01"
                value={newTestMax}
                onChange={(e) => setNewTestMax(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={() => setCreateTestModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmittingTest}>
              Save Test Assay
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
