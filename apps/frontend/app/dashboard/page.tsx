'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';
import { AppLayout } from '@/components/layout/app-layout';
import { AdminDashboard } from '@/components/dashboard/admin-dashboard';
import { DoctorDashboard } from '@/components/dashboard/doctor-dashboard';
import { NurseDashboard } from '@/components/dashboard/nurse-dashboard';
import { PharmacistDashboard } from '@/components/dashboard/pharmacist-dashboard';
import { PatientDashboard } from '@/components/dashboard/patient-dashboard';
import { ReceptionistDashboard } from '@/components/dashboard/receptionist-dashboard';
import { LabDashboard } from '@/components/dashboard/lab-dashboard';
import { AccountantDashboard } from '@/components/dashboard/accountant-dashboard';

export default function DashboardPage() {
  const { user } = useAuth();
  const role = user?.role || 'PATIENT';

  const renderDashboard = () => {
    switch (role) {
      case 'SUPER_ADMIN':
      case 'HOSPITAL_ADMIN':
        return <AdminDashboard />;
      case 'DOCTOR':
        return <DoctorDashboard />;
      case 'NURSE':
        return <NurseDashboard />;
      case 'PHARMACIST':
        return <PharmacistDashboard />;
      case 'RECEPTIONIST':
        return <ReceptionistDashboard />;
      case 'LAB_TECHNICIAN':
        return <LabDashboard />;
      case 'ACCOUNTANT':
        return <AccountantDashboard />;
      case 'PATIENT':
        return <PatientDashboard />;
      default:
        return <PatientDashboard />;
    }
  };

  return <AppLayout>{renderDashboard()}</AppLayout>;
}
