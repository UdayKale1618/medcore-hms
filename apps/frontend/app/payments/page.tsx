'use client';

import React, { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { useToast } from '@/lib/toast-context';
import { api, ApiError } from '@/lib/api';
import { Invoice, Payment } from '@/lib/types';
import {
  CreditCard,
  Search,
  CheckCircle,
  Clock,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';

export default function PaymentsPage() {
  const { toast } = useToast();

  const [payments, setPayments] = useState<(Payment & { invoice?: Invoice })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let ignore = false;
    async function loadPayments() {
      try {
        const res = await api.get<{
          success?: boolean;
          data?: { invoices: Invoice[] };
          invoices?: Invoice[];
        }>('/invoices?limit=100');

        const invList = res.data?.invoices || (res as unknown as { invoices: Invoice[] }).invoices || [];
        const extractedPayments: (Payment & { invoice?: Invoice })[] = [];

        invList.forEach((inv) => {
          if (inv.payments && inv.payments.length > 0) {
            inv.payments.forEach((p) => {
              extractedPayments.push({ ...p, invoice: inv });
            });
          } else if (inv.status === 'PAID') {
            extractedPayments.push({
              id: `pay_${inv.id.slice(0, 8)}`,
              invoiceId: inv.id,
              hospitalId: '',
              gateway: 'RAZORPAY',
              amount: inv.total,
              currency: 'INR',
              status: 'SUCCESS',
              method: 'Razorpay Online Checkout',
              createdAt: inv.paidAt || inv.updatedAt || inv.createdAt,
              updatedAt: inv.updatedAt || inv.createdAt,
              invoice: inv,
            });
          }
        });

        if (!ignore) {
          setPayments(extractedPayments);
        }
      } catch (err) {
        if (!ignore) {
          const error = err as ApiError;
          toast.error(error.message || 'Failed to load transaction history');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadPayments();
    return () => {
      ignore = true;
    };
  }, [toast, refreshTrigger]);

  const filteredPayments = payments.filter((p) => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (!search) return true;
    const term = search.toLowerCase();
    const invNum = p.invoice?.invoiceNumber?.toLowerCase() || '';
    const pName = p.invoice?.patient?.user?.name?.toLowerCase() || '';
    const payId = p.id.toLowerCase();
    const gwOrder = p.gatewayOrderId?.toLowerCase() || '';
    return invNum.includes(term) || pName.includes(term) || payId.includes(term) || gwOrder.includes(term);
  });

  const totalCollected = filteredPayments
    .filter((p) => p.status === 'SUCCESS')
    .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  return (
    <AppLayout requiredRole={['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'ACCOUNTANT', 'RECEPTIONIST', 'PATIENT']}>
      <PageHeader
        title="Payment Transactions & Gateway Audit"
        subtitle="End-to-end Razorpay transactions, captured digital receipts, and settlement logs"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Payments' },
        ]}
        actions={
          <Button variant="outline" onClick={() => setRefreshTrigger((prev) => prev + 1)}>
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Refresh Ledger
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Settled Collections</p>
              <p className="text-xl font-bold text-slate-900">₹{totalCollected.toLocaleString('en-IN')}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Captured Payments</p>
              <p className="text-xl font-bold text-blue-700">
                {payments.filter((p) => p.status === 'SUCCESS').length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Initiated / Pending</p>
              <p className="text-xl font-bold text-amber-700">
                {payments.filter((p) => p.status === 'CREATED' || p.status === 'PENDING').length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-50 text-slate-700 flex items-center justify-center font-bold">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Gateway Protocol</p>
              <p className="text-sm font-bold text-slate-800">Razorpay HMAC-256</p>
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
                placeholder="Search transaction ID, order ID, or patient..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: '', label: 'All Payment Statuses' },
                { value: 'SUCCESS', label: 'Success (Captured)' },
                { value: 'CREATED', label: 'Order Created' },
                { value: 'PENDING', label: 'Pending Verification' },
                { value: 'FAILED', label: 'Failed' },
              ]}
            />
            <div className="flex justify-end items-center">
              <span className="text-xs text-slate-500 font-medium">
                {filteredPayments.length} recorded payments
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      {loading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : filteredPayments.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No Payment Transactions Found"
          description="Transactions processed via Razorpay will be automatically audited and recorded here."
        />
      ) : (
        <Card>
          <Table minWidth="940px">
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">Transaction Reference</TableHead>
                <TableHead className="w-36">Invoice Number</TableHead>
                <TableHead className="w-48">Patient Name</TableHead>
                <TableHead className="w-52">Gateway & Order ID</TableHead>
                <TableHead className="w-32">Amount Paid</TableHead>
                <TableHead className="w-36">Timestamp</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-28 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.map((pay) => (
                <TableRow key={pay.id}>
                  <TableCell className="font-mono text-xs font-bold text-slate-800">
                    {pay.id.slice(0, 12)}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-medium text-slate-900">
                    {pay.invoice?.invoiceNumber || pay.invoiceId.slice(0, 8)}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-900">
                      {pay.invoice?.patient?.user?.name || 'Patient'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-xs text-slate-800">{pay.gateway || 'RAZORPAY'}</div>
                    <div className="font-mono text-[11px] text-slate-500 truncate max-w-[140px]">
                      {pay.gatewayOrderId || 'direct_checkout'}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm font-bold text-slate-900">
                    ₹{Number(pay.amount).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {new Date(pay.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={pay.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/billing`}>
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="w-3.5 h-3.5 mr-1" />
                        Invoice
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </AppLayout>
  );
}
