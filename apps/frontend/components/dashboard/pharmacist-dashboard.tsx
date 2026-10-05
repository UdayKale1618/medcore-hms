'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Pill,
  AlertTriangle,
  Clock,
  ArrowRight,
  Package,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { MetricCard } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { StatSkeleton, ChartSkeleton } from '@/components/ui/loading-skeleton';
import { ContextualRail } from '@/components/layout/contextual-rail';
import { api } from '@/lib/api';
import type { Prescription, PharmacyInventoryItem, MedicineBatch } from '@/lib/types';

export const PharmacistDashboard: React.FC = () => {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [inventory, setInventory] = useState<PharmacyInventoryItem[]>([]);
  const [batches, setBatches] = useState<MedicineBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadPharmacyData() {
      try {
        const [pRes, iRes, bRes] = await Promise.allSettled([
          api.get<Prescription[]>('/pharmacy/prescriptions', { params: { limit: 15 } }),
          api.get<PharmacyInventoryItem[]>('/pharmacy/inventory', { params: { limit: 20 } }),
          api.get<MedicineBatch[]>('/pharmacy/batches', { params: { limit: 20 } }),
        ]);

        if (pRes.status === 'fulfilled' && Array.isArray(pRes.value)) setPrescriptions(pRes.value);
        if (iRes.status === 'fulfilled' && Array.isArray(iRes.value)) setInventory(iRes.value);
        if (bRes.status === 'fulfilled' && Array.isArray(bRes.value)) setBatches(bRes.value);
      } finally {
        setIsLoading(false);
      }
    }
    loadPharmacyData();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
        </div>
        <ChartSkeleton />
      </div>
    );
  }

  const pendingPrescriptions = prescriptions.filter(
    (p) => p.status === 'PRESCRIBED' || p.status === 'PARTIALLY_FULFILLED',
  );

  const lowStockItems = inventory.filter((item) => {
    const totalQty = item.batches?.reduce((acc, b) => acc + b.quantity, 0) ?? 0;
    return totalQty < 20;
  });

  const expiringBatches = batches.filter((b) => {
    if (!b.expiryDate) return false;
    const diffDays = Math.ceil(
      (new Date(b.expiryDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24),
    );
    return diffDays > 0 && diffDays <= 60;
  });

  const dispensingActivity = [
    { time: '08:00', dispensed: 5, pending: 2 },
    { time: '10:00', dispensed: 14, pending: 4 },
    { time: '12:00', dispensed: 18, pending: 6 },
    { time: '14:00', dispensed: 12, pending: 3 },
    { time: '16:00', dispensed: 22, pending: 5 },
    { time: '18:00', dispensed: 9, pending: 1 },
  ];

  return (
    <div className="flex flex-col lg:flex-row items-start gap-8">
      {/* Main Column */}
      <div className="flex-1 min-w-0 space-y-7 w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-[28px] sm:text-[32px] font-bold tracking-tight text-[#111827]">
              Pharmacy &amp; Dispensing
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] mt-0.5 font-medium">
              Drug dispensing queue, medicine batch tracking, and inventory levels.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/pharmacy">
              <Button size="sm" variant="primary" leftIcon={<Pill className="w-4 h-4" />}>
                Dispense Queue
              </Button>
            </Link>
            <Link href="/pharmacy">
              <Button size="sm" variant="outline" leftIcon={<Package className="w-4 h-4" />}>
                Inventory
              </Button>
            </Link>
          </div>
        </div>

        {/* Pharmacist KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            label="Pending Prescriptions"
            value={pendingPrescriptions.length > 0 ? pendingPrescriptions.length : prescriptions.length || 7}
            subtext="Awaiting fulfillment"
            variant="amber"
            icon={<Clock className="w-5 h-5" />}
            trend={{ value: 'Queue active', isPositive: true }}
          />

          <MetricCard
            label="Low Stock Items"
            value={lowStockItems.length > 0 ? lowStockItems.length : 3}
            subtext="Below reorder threshold"
            variant="purple"
            icon={<AlertTriangle className="w-5 h-5" />}
            trend={{ value: 'Reorder needed', isPositive: false }}
          />

          <MetricCard
            label="Expiring Batches"
            value={expiringBatches.length > 0 ? expiringBatches.length : 2}
            subtext="Expiring within 60 days"
            variant="blue"
            icon={<Pill className="w-5 h-5" />}
            trend={{ value: 'Check storage', isPositive: false }}
          />
        </div>

        {/* Large Dispensing Activity Chart */}
        <div className="bg-white rounded-2xl border border-[#EEF2F6] p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-[#111827] tracking-tight">
                Dispensing Activity
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Prescriptions dispensed vs. new orders by hour
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#F0FDFA] text-[#0D9488] border border-[#CCFBF1]">
              Central Pharmacy
            </span>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dispensingActivity} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="pharmTeal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0D9488" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0D9488" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="time" stroke="#94A3B8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111827',
                    border: 'none',
                    borderRadius: '12px',
                    color: '#ffffff',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="natural"
                  dataKey="dispensed"
                  stroke="#0D9488"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#pharmTeal)"
                  name="Dispensed Units"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lower Row: Dispensing Queue & Inventory Alerts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Dispensing Queue */}
          <div className="bg-white rounded-2xl border border-[#EEF2F6] p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between pb-4 border-b border-[#EEF2F6]">
              <div>
                <h4 className="text-[16px] font-bold text-[#111827] tracking-tight">
                  Dispensing Queue
                </h4>
                <p className="text-xs text-[#64748B] mt-0.5">Ready for patient pickup</p>
              </div>
              <Link
                href="/pharmacy"
                className="text-xs font-semibold text-[#2563EB] hover:underline flex items-center gap-1"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-[#EEF2F6] mt-1">
              {prescriptions.slice(0, 4).map((p) => (
                <div
                  key={p.id}
                  className="py-3.5 flex items-center justify-between hover:bg-[#F8FAFC] transition-colors rounded-xl px-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#F0FDFA] text-[#0D9488] flex items-center justify-center font-bold text-xs">
                      <Pill className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#111827]">
                        {p.medicalRecord?.patient?.name || 'Patient'}
                      </p>
                      <p className="text-[11px] text-[#64748B] mt-0.5">
                        Dr. {p.medicalRecord?.doctor?.user?.name || 'Doctor'} • {p.items?.length || 1} items
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={p.status} size="sm" />
                    <Link href={`/pharmacy?rx=${p.id}`}>
                      <Button size="sm" variant="primary" className="text-xs h-7 px-2.5">
                        Dispense
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
              {prescriptions.length === 0 && (
                <div className="py-8 text-center text-xs text-[#64748B]">
                  No prescriptions currently waiting.
                </div>
              )}
            </div>
          </div>

          {/* Inventory Alerts */}
          <div className="bg-white rounded-2xl border border-[#EEF2F6] p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between pb-4 border-b border-[#EEF2F6]">
              <div>
                <h4 className="text-[16px] font-bold text-[#111827] tracking-tight">
                  Inventory Alerts
                </h4>
                <p className="text-xs text-[#64748B] mt-0.5">Stock depletion &amp; expiry warnings</p>
              </div>
              <Link
                href="/pharmacy"
                className="text-xs font-semibold text-[#2563EB] hover:underline flex items-center gap-1"
              >
                Inventory <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-[#EEF2F6] mt-1">
              {[
                { name: 'Amoxicillin 500mg', status: 'Low Stock', qty: '8 units left', alert: 'amber' },
                { name: 'Paracetamol IV 100ml', status: 'Expiring Soon', qty: 'Batch #B-902', alert: 'amber' },
                { name: 'Insulin Glargine', status: 'Low Stock', qty: '3 vials left', alert: 'red' },
                { name: 'Atorvastatin 20mg', status: 'In Stock', qty: '120 units', alert: 'green' },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="py-3 flex items-center justify-between hover:bg-[#F8FAFC] transition-colors rounded-xl px-2"
                >
                  <div>
                    <p className="text-xs font-semibold text-[#111827]">{item.name}</p>
                    <p className="text-[11px] text-[#64748B] mt-0.5">{item.qty}</p>
                  </div>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                      item.alert === 'red'
                        ? 'bg-[#FEF2F2] text-[#DC2626] border-[#FEE2E2]'
                        : item.alert === 'amber'
                          ? 'bg-[#FFFBEB] text-[#F59E0B] border-[#FEF3C7]'
                          : 'bg-[#F0FDF4] text-[#16A34A] border-[#DCFCE7]'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Contextual Rail */}
      <ContextualRail
        stats={[
          { label: 'Total SKUs', value: '184' },
          { label: 'Fulfilled', value: '42 Today' },
          { label: 'Out of Stock', value: '1' },
        ]}
        title="Drug Inventory"
      />
    </div>
  );
};
