'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { api, ApiError } from '@/lib/api';
import { PharmacyInventoryItem, MedicineBatch, Prescription, Medicine } from '@/lib/types';
import {
  Pill,
  Search,
  Plus,
  AlertTriangle,
  AlertOctagon,
  CheckCircle,
  Package,
  Layers,
  ArrowRight,
  Clock,
  ShieldAlert,
  Calendar,
} from 'lucide-react';

interface DispenseItemForm {
  prescriptionItemId: string;
  medicineName: string;
  requiredQty: number;
  dispensedQty: number;
  batchId: string;
  quantityToDispense: number;
}

export default function PharmacyPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'inventory' | 'batches' | 'dispense'>('dispense');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Data states
  const [inventory, setInventory] = useState<PharmacyInventoryItem[]>([]);
  const [batches, setBatches] = useState<(MedicineBatch & { medicine?: Medicine })[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);

  // Dispensing modal state
  const [dispenseModalOpen, setDispenseModalOpen] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [dispenseItems, setDispenseItems] = useState<DispenseItemForm[]>([]);
  const [dispenseNotes, setDispenseNotes] = useState('');
  const [isDispensing, setIsDispensing] = useState(false);

  // Add Batch modal state
  const [addBatchModalOpen, setAddBatchModalOpen] = useState(false);
  const [allMedicines, setAllMedicines] = useState<Medicine[]>([]);
  const [selectedMedicineId, setSelectedMedicineId] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [batchQuantity, setBatchQuantity] = useState<number>(100);
  const [batchExpiry, setBatchExpiry] = useState('');
  const [batchSellingPrice, setBatchSellingPrice] = useState<number>(50);
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);

  const isStaff = user?.role === 'PHARMACIST' || user?.role === 'HOSPITAL_ADMIN' || user?.role === 'SUPER_ADMIN';

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refreshPharmacy = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  // Switch tabs & Load Data
  useEffect(() => {
    let ignore = false;

    async function loadData() {
      if (activeTab === 'dispense') {
        try {
          const res = await api.get<{
            success?: boolean;
            data?: { prescriptions: Prescription[] };
          }>('/pharmacy/prescriptions?status=PRESCRIBED');

          if (!ignore) {
            const rxList = res.data?.prescriptions || (res as unknown as { prescriptions: Prescription[] }).prescriptions || [];
            setPrescriptions(rxList);
          }
        } catch (err) {
          if (!ignore) {
            const error = err as ApiError;
            toast.error(error.message || 'Failed to load prescriptions for dispensing');
          }
        } finally {
          if (!ignore) {
            setLoading(false);
          }
        }
      } else if (activeTab === 'inventory') {
        try {
          const res = await api.get<{
            success?: boolean;
            data?: { items: PharmacyInventoryItem[]; total: number };
            items?: PharmacyInventoryItem[];
          }>('/pharmacy/inventory');

          if (!ignore) {
            const items = res.data?.items || (res as unknown as { items: PharmacyInventoryItem[] }).items || (Array.isArray(res) ? res : []);
            setInventory(items);
          }
        } catch (err) {
          if (!ignore) {
            const error = err as ApiError;
            toast.error(error.message || 'Failed to load pharmacy inventory');
          }
        } finally {
          if (!ignore) {
            setLoading(false);
          }
        }
      } else if (activeTab === 'batches') {
        try {
          const res = await api.get<{
            success?: boolean;
            data?: { batches: (MedicineBatch & { medicine?: Medicine })[] };
            batches?: (MedicineBatch & { medicine?: Medicine })[];
          }>('/pharmacy/batches');

          if (!ignore) {
            const bList = res.data?.batches || (res as unknown as { batches: (MedicineBatch & { medicine?: Medicine })[] }).batches || (Array.isArray(res) ? res : []);
            setBatches(bList);
          }
        } catch (err) {
          if (!ignore) {
            const error = err as ApiError;
            toast.error(error.message || 'Failed to load medicine batches');
          }
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
  }, [activeTab, toast, refreshTrigger]);

  // Open Dispense Modal
  const handleOpenDispenseModal = async (rx: Prescription) => {
    setSelectedPrescription(rx);
    setDispenseNotes('');

    // Pre-populate items
    try {
      // Also fetch batches for available medicines to pair them
      const res = await api.get<{ data?: { batches: (MedicineBatch & { medicine?: Medicine })[] } }>('/pharmacy/batches');
      const allBatches = res.data?.batches || (res as unknown as { batches: (MedicineBatch & { medicine?: Medicine })[] }).batches || [];

      const initialItems: DispenseItemForm[] = (rx.items || []).map((it) => {
        // Find valid non-expired batch for this medicine
        const validBatch = allBatches.find((b) => {
          if (b.medicineId !== it.medicineId) return false;
          const isExpired = new Date(b.expiryDate) < new Date();
          return !isExpired && b.quantity > 0;
        });

        const remainingToDispense = Math.max(0, (it.quantity || 1) - (it.dispensedQuantity || 0));

        return {
          prescriptionItemId: it.id,
          medicineName: it.medicine?.name || 'Medication',
          requiredQty: it.quantity || 1,
          dispensedQty: it.dispensedQuantity || 0,
          batchId: validBatch ? validBatch.id : '',
          quantityToDispense: remainingToDispense,
        };
      });

      setDispenseItems(initialItems);
      setBatches(allBatches);
      setDispenseModalOpen(true);
    } catch (err) {
      const error = err as ApiError;
      toast.error(error.message || 'Failed to prepare dispensing order');
    }
  };

  // Submit Dispensation
  const handleSubmitDispense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPrescription) return;

    // Validate that all items have a selected batch
    for (const it of dispenseItems) {
      if (it.quantityToDispense > 0) {
        if (!it.batchId) {
          toast.error(`Please select a valid non-expired batch for ${it.medicineName}`);
          return;
        }

        // Check if chosen batch is expired
        const batch = batches.find((b) => b.id === it.batchId);
        if (batch && new Date(batch.expiryDate) < new Date()) {
          toast.error(`CRITICAL SAFETY ERROR: Batch ${batch.batchNumber} has expired! Dispensing of expired pharmaceuticals is strictly blocked.`);
          return;
        }

        if (batch && batch.quantity < it.quantityToDispense) {
          toast.error(`Insufficient batch inventory for ${it.medicineName}. Available: ${batch.quantity}, Requested: ${it.quantityToDispense}`);
          return;
        }
      }
    }

    const itemsToDispense = dispenseItems
      .filter((it) => it.quantityToDispense > 0)
      .map((it) => ({
        prescriptionItemId: it.prescriptionItemId,
        batchId: it.batchId,
        quantity: Number(it.quantityToDispense),
      }));

    if (itemsToDispense.length === 0) {
      toast.error('No medications marked for dispensation');
      return;
    }

    try {
      setIsDispensing(true);
      await api.post('/pharmacy/dispense', {
        prescriptionId: selectedPrescription.id,
        items: itemsToDispense,
        notes: dispenseNotes.trim() || undefined,
      });

      toast.success('Medication successfully verified and dispensed to patient');
      setDispenseModalOpen(false);
      refreshPharmacy();
    } catch (err) {
      const error = err as ApiError;
      toast.error(error.message || 'Dispensing transaction failed');
    } finally {
      setIsDispensing(false);
    }
  };

  // Open Add Batch Modal
  const handleOpenAddBatch = async () => {
    try {
      const res = await api.get<{ data?: { medicines: Medicine[] }; medicines?: Medicine[] }>('/medicines?limit=100');
      const medList = res.data?.medicines || (res as unknown as { medicines: Medicine[] }).medicines || [];
      setAllMedicines(medList);
      if (medList.length > 0 && !selectedMedicineId) {
        setSelectedMedicineId(medList[0].id);
      }
      setBatchNumber(`B-${Math.floor(100000 + Math.random() * 900000)}`);
      // Default expiry 1 year ahead
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      setBatchExpiry(nextYear.toISOString().split('T')[0]);
      setAddBatchModalOpen(true);
    } catch {
      toast.error('Failed to load medicines catalogue');
    }
  };

  // Submit Add Batch
  const handleSubmitBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMedicineId || !batchNumber || !batchExpiry || batchQuantity <= 0) {
      toast.error('Please complete all batch fields correctly');
      return;
    }

    try {
      setIsSubmittingBatch(true);
      await api.post(`/medicines/${selectedMedicineId}/batches`, {
        batchNumber: batchNumber.trim(),
        expiryDate: new Date(batchExpiry).toISOString(),
        quantity: Number(batchQuantity),
        sellingPrice: Number(batchSellingPrice),
      });

      toast.success('New inventory batch registered successfully');
      setAddBatchModalOpen(false);
      refreshPharmacy();
    } catch (err) {
      const error = err as ApiError;
      toast.error(error.message || 'Failed to create medicine batch');
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  // Status checkers for batch
  const getBatchExpiryStatus = (expiryDateStr: string) => {
    const expiry = new Date(expiryDateStr);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 3600 * 24));

    if (daysUntilExpiry < 0) {
      return { label: 'EXPIRED', color: 'bg-red-100 text-red-800 border-red-200', expired: true };
    }
    if (daysUntilExpiry <= 60) {
      return {
        label: `Expiring Soon (${daysUntilExpiry}d)`,
        color: 'bg-amber-100 text-amber-800 border-amber-200',
        expired: false,
      };
    }
    return { label: 'Good Stock', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', expired: false };
  };

  return (
    <AppLayout requiredRole={['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PHARMACIST']}>
      <PageHeader
        title="Hospital Pharmacy & Dispensary"
        subtitle="Real-time pharmaceutical inventory, safety-verified dispensing, and batch tracking"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Pharmacy' },
        ]}
        actions={
          isStaff ? (
            <div className="flex gap-2">
              <Button onClick={handleOpenAddBatch}>
                <Plus className="w-4 h-4 mr-1.5" />
                Receive New Batch
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* Tabs Bar */}
      <div className="flex border-b border-slate-200 mb-6 bg-white rounded-t-lg px-2 pt-2">
        <button
          onClick={() => setActiveTab('dispense')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'dispense'
              ? 'border-teal-600 text-teal-900 bg-teal-50/50 rounded-t'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4 text-teal-600" />
          Pending Dispensation Queue ({prescriptions.length})
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'inventory'
              ? 'border-teal-600 text-teal-900 bg-teal-50/50 rounded-t'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Package className="w-4 h-4 text-teal-600" />
          Medication Stock Inventory
        </button>
        <button
          onClick={() => setActiveTab('batches')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'batches'
              ? 'border-teal-600 text-teal-900 bg-teal-50/50 rounded-t'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4 text-teal-600" />
          Batches & Expiry Safety Control
        </button>
      </div>

      {/* TAB 1: DISPENSING QUEUE */}
      {activeTab === 'dispense' && (
        <div>
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="relative w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="Search patient, doctor, or Rx..."
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="text-xs text-slate-500">
                  Select a prescription order below to verify and dispense medication.
                </div>
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : prescriptions.length === 0 ? (
            <EmptyState
              icon={CheckCircle}
              title="Dispensing Queue is Clear"
              description="All issued doctor prescriptions have been fulfilled. New clinical orders will appear here in real time."
            />
          ) : (
            <Card>
              <Table minWidth="880px">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Prescription</TableHead>
                    <TableHead className="w-48">Patient</TableHead>
                    <TableHead className="w-44">Doctor</TableHead>
                    <TableHead>Items Prescribed</TableHead>
                    <TableHead className="w-32">Date Ordered</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-28 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prescriptions.map((rx) => {
                    const patient = rx.medicalRecord?.patient;
                    const doctor = rx.medicalRecord?.doctor;
                    return (
                      <TableRow key={rx.id}>
                        <TableCell className="font-mono text-xs font-semibold text-slate-700">
                          {rx.id.slice(0, 8).toUpperCase()}
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-slate-900">
                            {patient?.user?.name || 'Registered Patient'}
                          </div>
                          <div className="text-xs text-slate-500">
                            {patient?.gender || 'N/A'} • Age: {patient?.bloodGroup || 'Blood: N/A'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-slate-800 font-medium">
                            Dr. {doctor?.user?.name || 'Physician'}
                          </div>
                          <div className="text-xs text-slate-500">
                            {doctor?.specialization || 'Clinical'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-teal-50 text-teal-800">
                            <Pill className="w-3.5 h-3.5 mr-1 text-teal-600" />
                            {rx.items?.length || 0} Medicine{rx.items?.length !== 1 ? 's' : ''}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {new Date(rx.createdAt || rx.issuedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={rx.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleOpenDispenseModal(rx)}
                            disabled={!isStaff}
                          >
                            <ArrowRight className="w-3.5 h-3.5 mr-1" />
                            Dispense
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      )}

      {/* TAB 2: INVENTORY STOCK */}
      {activeTab === 'inventory' && (
        <div>
          {loading ? (
            <TableSkeleton rows={6} cols={6} />
          ) : inventory.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No Medicine Inventory Found"
              description="No registered medicines currently exist in the hospital formulary."
              action={
                isStaff ? (
                  <Button onClick={handleOpenAddBatch}>
                    <Plus className="w-4 h-4 mr-1.5" />
                    Receive Medicine Batch
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Card>
              <Table minWidth="750px">
                <TableHeader>
                  <TableRow>
                    <TableHead>Formulary Drug Name</TableHead>
                    <TableHead className="w-36">Dosage Form</TableHead>
                    <TableHead className="w-36">Category</TableHead>
                    <TableHead className="w-32">Available Stock</TableHead>
                    <TableHead className="w-32">Min Safety Level</TableHead>
                    <TableHead className="w-32">Stock Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventory.map((item) => {
                    const isLow = (item.availableStock || 0) <= (item.minStockLevel || 10);
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-semibold text-slate-900">{item.name}</div>
                          <div className="text-xs text-slate-500">
                            {item.genericName ? `Generic: ${item.genericName}` : ''} {item.strength || ''}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-700 capitalize">
                          {item.form || 'Tablet'}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {item.category || 'General'}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm font-bold text-slate-900">
                            {item.availableStock ?? item.currentStock ?? 0}
                          </span>{' '}
                          <span className="text-xs text-slate-500">{item.unit || 'units'}</span>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-600">
                          {item.minStockLevel || 10} {item.unit || 'units'}
                        </TableCell>
                        <TableCell>
                          {isLow ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                              <AlertTriangle className="w-3.5 h-3.5 mr-1 text-red-600" />
                              Low Stock Warning
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                              Adequate Stock
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      )}

      {/* TAB 3: BATCHES & EXPIRY CONTROL */}
      {activeTab === 'batches' && (
        <div>
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <span>
                <strong>Clinical Expiry Protection Active:</strong> MedCore HMS automatically revokes dispensing rights for expired pharmaceutical batches to guarantee patient safety.
              </span>
            </div>
          </div>

          {loading ? (
            <TableSkeleton rows={6} cols={6} />
          ) : batches.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="No Batches Recorded"
              description="No inventory batches currently on file. Receive a new batch to get started."
              action={
                isStaff ? (
                  <Button onClick={handleOpenAddBatch}>
                    <Plus className="w-4 h-4 mr-1.5" />
                    Receive First Batch
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Card>
              <Table minWidth="900px">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-36">Batch Reference</TableHead>
                    <TableHead>Medicine Name</TableHead>
                    <TableHead className="w-32">Current Quantity</TableHead>
                    <TableHead className="w-36">Selling Price (INR)</TableHead>
                    <TableHead className="w-32">Expiry Date</TableHead>
                    <TableHead className="w-36">Expiry Safety Status</TableHead>
                    <TableHead className="w-36 text-right">Dispensing Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((batch) => {
                    const status = getBatchExpiryStatus(batch.expiryDate);
                    return (
                      <TableRow key={batch.id} className={status.expired ? 'bg-red-50/30' : ''}>
                        <TableCell className="font-mono text-xs font-bold text-slate-800">
                          {batch.batchNumber}
                        </TableCell>
                        <TableCell className="font-medium text-slate-900">
                          {batch.medicine?.name || 'Registered Drug'}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-slate-900">
                          {batch.quantity}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-700">
                          ₹{Number(batch.sellingPrice).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-xs text-slate-700">
                          {new Date(batch.expiryDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${status.color}`}
                          >
                            {status.expired ? (
                              <AlertOctagon className="w-3.5 h-3.5 mr-1" />
                            ) : (
                              <Calendar className="w-3.5 h-3.5 mr-1" />
                            )}
                            {status.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {status.expired ? (
                            <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-1 rounded inline-flex items-center">
                              <AlertOctagon className="w-3 h-3 mr-1" />
                              Dispense Blocked
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                              Authorized for Dispense
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      )}

      {/* DISPENSING CONFIRMATION MODAL */}
      <Modal
        isOpen={dispenseModalOpen}
        onClose={() => setDispenseModalOpen(false)}
        title="Medication Dispensation Verification"
        maxWidth="max-w-3xl"
      >
        {selectedPrescription && (
          <form onSubmit={handleSubmitDispense} className="space-y-4">
            {/* Patient Header */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center text-xs">
              <div>
                <p className="text-slate-500 font-medium">Patient</p>
                <p className="text-sm font-bold text-slate-900">
                  {selectedPrescription.medicalRecord?.patient?.user?.name || 'Patient'}
                </p>
                <p className="text-slate-600">
                  Prescribed by Dr.{' '}
                  {selectedPrescription.medicalRecord?.doctor?.user?.name || 'Physician'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-slate-500 font-medium">Prescription ID</p>
                <p className="font-mono text-xs font-bold text-slate-700">{selectedPrescription.id.slice(0, 8)}</p>
                <StatusBadge status={selectedPrescription.status} />
              </div>
            </div>

            {/* Medicines List to Dispense */}
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-800">
                Select Pharmaceutical Batches & Verification
              </label>

              {dispenseItems.map((item, idx) => (
                  <div
                    key={item.prescriptionItemId}
                    className="p-3 bg-white border border-slate-200 rounded-lg space-y-2 text-xs"
                  >
                    <div className="flex justify-between items-center font-semibold text-slate-900">
                      <span>
                        #{idx + 1} {item.medicineName}
                      </span>
                      <span className="text-slate-600 text-xs">
                        Requested: {item.requiredQty} | Already Dispensed: {item.dispensedQty}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                          Select Batch (Active & Non-Expired) *
                        </label>
                        <select
                          value={item.batchId}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDispenseItems((prev) => {
                              const copy = [...prev];
                              copy[idx].batchId = val;
                              return copy;
                            });
                          }}
                          className="w-full text-xs rounded border border-slate-300 p-2 bg-white focus:outline-none focus:ring-1 focus:ring-teal-600"
                          required
                        >
                          <option value="">-- Choose Batch --</option>
                          {batches.map((b) => {
                            const isExpired = new Date(b.expiryDate) < new Date();
                            return (
                              <option
                                key={b.id}
                                value={b.id}
                                disabled={isExpired || b.quantity <= 0}
                              >
                                Batch #{b.batchNumber} (Qty: {b.quantity}, Exp:{' '}
                                {new Date(b.expiryDate).toLocaleDateString()}){' '}
                                {isExpired ? '[EXPIRED - BLOCKED]' : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                          Quantity to Dispense Now *
                        </label>
                        <Input
                          type="number"
                          min="1"
                          max={item.requiredQty - item.dispensedQty}
                          value={item.quantityToDispense}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setDispenseItems((prev) => {
                              const copy = [...prev];
                              copy[idx].quantityToDispense = val;
                              return copy;
                            });
                          }}
                          required
                        />
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Dispensing Pharmacist Notes
              </label>
              <Input
                placeholder="Patient counselled on dosage and adverse effects"
                value={dispenseNotes}
                onChange={(e) => setDispenseNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <Button type="button" variant="outline" onClick={() => setDispenseModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isDispensing}>
                <CheckCircle className="w-4 h-4 mr-1.5" />
                Confirm & Dispense Medication
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* RECEIVE BATCH MODAL */}
      <Modal
        isOpen={addBatchModalOpen}
        onClose={() => setAddBatchModalOpen(false)}
        title="Receive New Pharmaceutical Batch"
      >
        <form onSubmit={handleSubmitBatch} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Medicine Formulary Item *
            </label>
            <select
              value={selectedMedicineId}
              onChange={(e) => setSelectedMedicineId(e.target.value)}
              className="w-full text-xs rounded-md border border-slate-300 p-2 bg-white focus:outline-none focus:ring-1 focus:ring-teal-600"
              required
            >
              {allMedicines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.form} {m.strength || ''})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Batch Number *</label>
              <Input
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                placeholder="e.g. B-99382"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Received Quantity *</label>
              <Input
                type="number"
                min="1"
                value={batchQuantity}
                onChange={(e) => setBatchQuantity(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Expiry Date *</label>
              <Input
                type="date"
                value={batchExpiry}
                onChange={(e) => setBatchExpiry(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Selling Price (INR) *</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={batchSellingPrice}
                onChange={(e) => setBatchSellingPrice(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={() => setAddBatchModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmittingBatch}>
              Save Batch
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
