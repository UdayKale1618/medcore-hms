'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, MetricCard } from '@/components/ui/card';
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
import { Invoice, Patient, Appointment } from '@/lib/types';
import {
  CreditCard,
  Search,
  Plus,
  Eye,
  Trash2,
  Printer,
  CheckCircle,
  Clock,
  Receipt,
} from 'lucide-react';

interface InvoiceLineItemInput {
  description: string;
  category: string;
  quantity: number;
  unitPrice: number;
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme?: {
    color: string;
  };
  handler: (response: RazorpayResponse) => void;
  modal?: {
    ondismiss?: () => void;
  };
}

export default function BillingPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State for Create Invoice
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedAppointmentId, setSelectedAppointmentId] = useState('');
  const [tax, setTax] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [lineItems, setLineItems] = useState<InvoiceLineItemInput[]>([
    { description: 'Consultation & Clinical Assessment', category: 'CONSULTATION', quantity: 1, unitPrice: 800 },
  ]);

  const canCreateInvoice =
    user?.role === 'ACCOUNTANT' ||
    user?.role === 'RECEPTIONIST' ||
    user?.role === 'HOSPITAL_ADMIN' ||
    user?.role === 'SUPER_ADMIN';

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refreshInvoices = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  // Load auxiliary data
  const loadPrerequisites = async () => {
    try {
      const [ptsRes, apptRes] = await Promise.all([
        api.get<Patient[]>('/patients?limit=50'),
        api.get<Appointment[]>('/appointments?limit=50'),
      ]);
      const pList: Patient[] = Array.isArray(ptsRes) ? ptsRes : (Array.isArray((ptsRes as Record<string, unknown>)?.data) ? ((ptsRes as Record<string, unknown>).data as Patient[]) : []);
      const aList: Appointment[] = Array.isArray(apptRes) ? apptRes : (Array.isArray((apptRes as Record<string, unknown>)?.data) ? ((apptRes as Record<string, unknown>).data as Appointment[]) : []);
      setPatients(pList);
      setAppointments(aList);
      if (pList.length > 0 && !selectedPatientId) {
        setSelectedPatientId(pList[0].id);
      }
    } catch {
      // Handled
    }
  };

  useEffect(() => {
    let ignore = false;
    async function loadInvoices() {
      try {
        const params: Record<string, string | number> = { page, limit };
        if (statusFilter) params.status = statusFilter;

        const res = await api.get<{
          success?: boolean;
          data?: { invoices: Invoice[]; total: number };
          invoices?: Invoice[];
        }>('/invoices', { params });

        if (!ignore) {
          const invoiceList = Array.isArray(res) ? res : (res.data?.invoices || (Array.isArray(res.data) ? res.data : []));
          setInvoices(invoiceList);
          setTotal(invoiceList.length);
        }
      } catch (err) {
        if (!ignore) {
          const error = err as ApiError;
          toast.error(error.message || 'Failed to load invoices');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadInvoices();
    return () => {
      ignore = true;
    };
  }, [page, limit, statusFilter, toast, refreshTrigger]);

  const handleOpenCreateModal = () => {
    loadPrerequisites();
    setCreateModalOpen(true);
  };

  const handleAddLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { description: 'Hospital Service / Medication', category: 'SERVICE', quantity: 1, unitPrice: 500 },
    ]);
  };

  const handleRemoveLineItem = (index: number) => {
    if (lineItems.length <= 1) {
      toast.error('Invoice must contain at least one line item');
      return;
    }
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLineItemChange = (index: number, field: keyof InvoiceLineItemInput, value: string | number) => {
    setLineItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) {
      toast.error('Please select a patient');
      return;
    }

    const invalid = lineItems.some((it) => !it.description || it.quantity <= 0 || it.unitPrice < 0);
    if (invalid) {
      toast.error('Please complete all line item descriptions, quantities, and prices');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post('/invoices', {
        patientId: selectedPatientId,
        appointmentId: selectedAppointmentId || undefined,
        tax: Number(tax) || 0,
        discount: Number(discount) || 0,
        items: lineItems.map((it) => ({
          description: it.description,
          category: it.category,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
        })),
      });

      toast.success('Hospital invoice generated and issued');
      setCreateModalOpen(false);
      refreshInvoices();
    } catch (err) {
      const error = err as ApiError;
      toast.error(error.message || 'Failed to create invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

  // STEP 15: RAZORPAY INTEGRATION
  const handlePayNow = async (invoice: Invoice) => {
    try {
      setIsPaying(true);
      // 1. Call backend create-order
      const orderRes = await api.post<{
        paymentId: string;
        orderId: string;
        amount: number;
        amountInPaise: number;
        currency: string;
        keyId: string;
        invoiceNumber: string;
        patientName?: string;
        patientEmail?: string;
      }>('/payments/create-order', {
        invoiceId: invoice.id,
      });

      // 2. Check if Razorpay SDK is available
      const RazorpayConstructor = (window as unknown as { Razorpay: new (options: RazorpayOptions) => { open: () => void } }).Razorpay;
      if (!RazorpayConstructor) {
        toast.error('Payment gateway SDK is still loading. Please try again in a few seconds.');
        setIsPaying(false);
        return;
      }

      // 3. Configure Razorpay Checkout options
      const options: RazorpayOptions = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || orderRes.keyId || 'rzp_test_placeholder',
        amount: orderRes.amountInPaise,
        currency: orderRes.currency || 'INR',
        name: 'MedCore Hospital Healthcare',
        description: `Payment for Invoice #${invoice.invoiceNumber}`,
        order_id: orderRes.orderId,
        prefill: {
          name: orderRes.patientName || invoice.patient?.user?.name || '',
          email: orderRes.patientEmail || invoice.patient?.user?.email || '',
          contact: invoice.patient?.user?.phone || '',
        },
        theme: {
          color: '#2563EB',
        },
        handler: async (response: RazorpayResponse) => {
          try {
            // 4. Verify payment on backend
            await api.post('/payments/verify', {
              invoiceId: invoice.id,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });

            toast.success('Payment successfully processed and verified! Invoice marked as PAID.');
            setSelectedInvoice(null);
            refreshInvoices();
          } catch (verifyErr) {
            const err = verifyErr as ApiError;
            toast.error(err.message || 'Payment signature verification failed. Please contact billing staff.');
          } finally {
            setIsPaying(false);
          }
        },
        modal: {
          ondismiss: () => {
            setIsPaying(false);
            toast.info('Payment was cancelled by the user.');
          },
        },
      };

      const rzpInstance = new RazorpayConstructor(options);
      rzpInstance.open();
    } catch (err) {
      const error = err as ApiError;
      toast.error(error.message || 'Failed to initialize payment gateway order');
      setIsPaying(false);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    if (!search) return true;
    const term = search.toLowerCase();
    const pName = inv.patient?.user?.name?.toLowerCase() || '';
    const invNum = inv.invoiceNumber?.toLowerCase() || '';
    const id = inv.id.toLowerCase();
    return pName.includes(term) || invNum.includes(term) || id.includes(term);
  });

  return (
    <AppLayout requiredRole={['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'ACCOUNTANT', 'RECEPTIONIST', 'PATIENT']}>
      <PageHeader
        title="Billing & Invoices"
        subtitle="Hospital fee ledger, itemized patient billing, and Razorpay digital collections"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Billing' },
        ]}
        actions={
          canCreateInvoice ? (
            <Button onClick={handleOpenCreateModal}>
              <Plus className="w-4 h-4 mr-1.5" />
              Generate Invoice
            </Button>
          ) : undefined
        }
      />

      {/* Financial KPI Cards matching Section 18 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Total Invoices"
          value={total}
          subtext="Patient billing records"
          variant="blue"
          icon={<Receipt className="w-5 h-5" />}
        />
        <MetricCard
          label="Paid Invoices"
          value={invoices.filter((i) => i.status === 'PAID').length}
          subtext="Cleared and settled"
          variant="teal"
          icon={<CheckCircle className="w-5 h-5" />}
          trend={{ value: 'Settled', isPositive: true }}
        />
        <MetricCard
          label="Outstanding"
          value={invoices.filter((i) => i.status === 'ISSUED' || i.status === 'DRAFT').length}
          subtext="Pending payment claims"
          variant="amber"
          icon={<Clock className="w-5 h-5" />}
          trend={{ value: 'Pending', isPositive: false }}
        />
        <MetricCard
          label="Collection Total"
          value={`₹${invoices
            .filter((i) => i.status === 'PAID')
            .reduce((sum, i) => sum + Number(i.total || 0), 0)
            .toLocaleString('en-IN')}`}
          subtext="Razorpay HMAC-256"
          variant="purple"
          icon={<CreditCard className="w-5 h-5" />}
          trend={{ value: 'Verified', isPositive: true }}
        />
      </div>

      {/* Filter Bar */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search by Patient name or Invoice #..."
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
                { value: 'ISSUED', label: 'Issued (Pending Payment)' },
                { value: 'PAID', label: 'Paid' },
                { value: 'DRAFT', label: 'Draft' },
                { value: 'CANCELLED', label: 'Cancelled' },
              ]}
            />
            <div className="flex justify-end items-center">
              <span className="text-xs text-slate-500 font-medium">
                Showing {filteredInvoices.length} of {total} records
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      {loading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : filteredInvoices.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No Invoices Found"
          description={
            search || statusFilter
              ? 'No billing records match your search or status criteria.'
              : 'No patient invoices have been created yet.'
          }
          action={
            canCreateInvoice ? (
              <Button onClick={handleOpenCreateModal}>
                <Plus className="w-4 h-4 mr-1.5" />
                Generate First Invoice
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card>
          <Table minWidth="880px">
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">Invoice Number</TableHead>
                <TableHead className="w-48">Patient Name</TableHead>
                <TableHead className="w-40">Appointment Ref</TableHead>
                <TableHead className="w-32">Total Amount</TableHead>
                <TableHead className="w-32">Date Issued</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-36 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-xs font-bold text-slate-900">
                    {inv.invoiceNumber || inv.id.slice(0, 8).toUpperCase()}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-900">{inv.patient?.user?.name || 'Patient'}</div>
                    <div className="text-xs text-slate-500">
                      {inv.patient?.user?.phone || 'Contact: N/A'}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-600">
                    {inv.appointmentId ? inv.appointmentId.slice(0, 8).toUpperCase() : 'Outpatient / General'}
                  </TableCell>
                  <TableCell className="font-mono text-sm font-bold text-slate-900">
                    ₹{Number(inv.total).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {new Date(inv.issuedAt || inv.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={inv.status} />
                  </TableCell>
                  <TableCell className="text-right space-x-1.5">
                    <Button variant="outline" size="sm" onClick={() => setSelectedInvoice(inv)}>
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      View Bill
                    </Button>
                    {inv.status === 'ISSUED' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handlePayNow(inv)}
                        isLoading={isPaying}
                      >
                        <CreditCard className="w-3.5 h-3.5 mr-1" />
                        Pay Now
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
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

      {/* VIEW INVOICE MODAL */}
      <Modal
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        title="Hospital Tax Invoice & Receipt"
        maxWidth="max-w-3xl"
        footer={
          <div className="flex justify-between w-full">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-1.5" />
              Print Receipt
            </Button>
            <div className="flex gap-2">
              {selectedInvoice?.status === 'ISSUED' && (
                <Button
                  variant="primary"
                  onClick={() => selectedInvoice && handlePayNow(selectedInvoice)}
                  isLoading={isPaying}
                >
                  <CreditCard className="w-4 h-4 mr-1.5" />
                  Pay with Razorpay
                </Button>
              )}
              <Button variant="secondary" onClick={() => setSelectedInvoice(null)}>
                Close
              </Button>
            </div>
          </div>
        }
      >
        {selectedInvoice && (
          <div className="space-y-6">
            {/* Hospital & Bill Header */}
            <div className="flex justify-between items-start border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded bg-blue-900 text-white flex items-center justify-center font-bold text-xs">
                    M+
                  </div>
                  <h3 className="text-base font-bold text-slate-900">MedCore Hospital & Healthcare</h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Central Billing & Patient Financial Services</p>
                <p className="text-[11px] text-slate-400 font-mono">GSTIN: 27AABCM8821N1ZM</p>
              </div>
              <div className="text-right">
                <StatusBadge status={selectedInvoice.status} />
                <p className="text-xs font-mono font-bold text-slate-800 mt-1">
                  INV: {selectedInvoice.invoiceNumber || selectedInvoice.id.slice(0, 8)}
                </p>
                <p className="text-xs text-slate-500">
                  Date:{' '}
                  {new Date(selectedInvoice.issuedAt || selectedInvoice.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>

            {/* Patient & Encounter Details */}
            <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
              <div>
                <p className="text-slate-500 font-medium uppercase tracking-wider text-[10px]">Billed To</p>
                <p className="font-bold text-slate-900 text-sm mt-0.5">
                  {selectedInvoice.patient?.user?.name || 'Registered Patient'}
                </p>
                <p className="text-slate-600 mt-0.5">
                  Age/Gender: {selectedInvoice.patient?.gender || 'N/A'} • Blood: {selectedInvoice.patient?.bloodGroup || 'N/A'}
                </p>
                <p className="text-slate-600">Contact: {selectedInvoice.patient?.user?.phone || 'N/A'}</p>
                <p className="text-slate-600">Email: {selectedInvoice.patient?.user?.email || 'N/A'}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium uppercase tracking-wider text-[10px]">Payment Details</p>
                <p className="text-slate-700 mt-0.5">
                  Status: <strong>{selectedInvoice.status}</strong>
                </p>
                {selectedInvoice.paidAt && (
                  <p className="text-emerald-700">
                    Paid On: {new Date(selectedInvoice.paidAt).toLocaleDateString()}
                  </p>
                )}
                {selectedInvoice.appointmentId && (
                  <p className="text-slate-600 font-mono text-[11px]">
                    Appointment Ref: #{selectedInvoice.appointmentId.slice(0, 8)}
                  </p>
                )}
              </div>
            </div>

            {/* Itemized Line Items Table */}
            <div>
              <Table padding="compact" minWidth="550px">
                <TableHeader>
                  <TableRow>
                    <TableHead>Line Item Description</TableHead>
                    <TableHead className="w-44">Department / Category</TableHead>
                    <TableHead className="w-20 text-right">Qty</TableHead>
                    <TableHead className="w-28 text-right">Unit Price</TableHead>
                    <TableHead className="w-32 text-right">Total (INR)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedInvoice.items?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium text-slate-900">{item.description}</TableCell>
                      <TableCell className="text-xs text-slate-500 capitalize">{item.category}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{item.quantity}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        ₹{Number(item.unitPrice).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold text-slate-900">
                        ₹{Number(item.total).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Calculations Breakdown (Authoritative values directly from backend) */}
            <div className="flex justify-end pt-2">
              <div className="w-64 space-y-1.5 text-xs text-slate-700">
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Subtotal:</span>
                  <span className="font-mono font-medium">₹{Number(selectedInvoice.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Tax / GST:</span>
                  <span className="font-mono font-medium">+₹{Number(selectedInvoice.tax).toFixed(2)}</span>
                </div>
                {Number(selectedInvoice.discount) > 0 && (
                  <div className="flex justify-between py-1 border-b border-slate-200 text-teal-700">
                    <span>Discount / Scheme:</span>
                    <span className="font-mono font-medium">-₹{Number(selectedInvoice.discount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-t-2 border-slate-900 text-sm font-bold text-slate-900">
                  <span>Grand Total:</span>
                  <span className="font-mono text-blue-900">₹{Number(selectedInvoice.total).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* CREATE INVOICE MODAL */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Generate New Hospital Invoice"
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleCreateInvoice} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Select Patient *</label>
              <select
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="w-full text-xs rounded border border-slate-300 p-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                required
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.user?.name || 'Patient'} ({p.gender || 'N/A'}, Blood: {p.bloodGroup || 'N/A'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Link Appointment Encounter (Optional)
              </label>
              <select
                value={selectedAppointmentId}
                onChange={(e) => setSelectedAppointmentId(e.target.value)}
                className="w-full text-xs rounded border border-slate-300 p-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                <option value="">-- No specific appointment link --</option>
                {appointments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {new Date(a.appointmentDate || a.createdAt).toLocaleDateString()} — Dr. {a.doctor?.user?.name || 'Physician'} (
                    {a.status})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Itemized Line Items ({lineItems.length})
              </label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddLineItem}>
                <Plus className="w-3.5 h-3.5 mr-1 text-teal-600" />
                Add Item
              </Button>
            </div>

            <div className="space-y-3">
              {lineItems.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-700">#{idx + 1} Item</span>
                    {lineItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveLineItem(idx)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                        Description *
                      </label>
                      <Input
                        value={item.description}
                        placeholder="e.g. Inpatient Bed Charge, Laboratory CBC"
                        onChange={(e) => handleLineItemChange(idx, 'description', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Category *</label>
                      <select
                        value={item.category}
                        onChange={(e) => handleLineItemChange(idx, 'category', e.target.value)}
                        className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                        required
                      >
                        <option value="CONSULTATION">Consultation</option>
                        <option value="LABORATORY">Laboratory</option>
                        <option value="PHARMACY">Pharmacy</option>
                        <option value="PROCEDURE">Procedure / Surgery</option>
                        <option value="ROOM">Room / Bed</option>
                        <option value="SERVICE">Other Service</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Quantity *</label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleLineItemChange(idx, 'quantity', Number(e.target.value))}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                        Unit Price (INR) *
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => handleLineItemChange(idx, 'unitPrice', Number(e.target.value))}
                        required
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Applicable Tax (INR)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={tax}
                onChange={(e) => setTax(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Concession / Discount (INR)
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Generate & Issue Invoice
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
