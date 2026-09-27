import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import type { AuthUser } from './auth/auth-user.interface';
import { PrescriptionService } from './prescription/prescription.service';
import { MedicineService } from './medicine/medicine.service';
import { LabTestService } from './lab/lab-test.service';
import { LabOrderService } from './lab/lab-order.service';
import { InvoiceService } from './invoice/invoice.service';
import { PrismaService } from './prisma/prisma.service';

describe('Week 2 Complete Integration, Security & Tenant Isolation Audit (Day 14)', () => {
  let prisma: any;
  let prescriptionService: PrescriptionService;
  let medicineService: MedicineService;
  let labTestService: LabTestService;
  let labOrderService: LabOrderService;
  let invoiceService: InvoiceService;

  // Caller profiles across hospitals and roles
  const hospitalA = 'hosp-aaa-111';
  const hospitalB = 'hosp-bbb-222';

  const superAdminCaller: AuthUser = {
    userId: 'u-super',
    email: 'super@medcore.com',
    roleId: 'r-super',
    role: 'SUPER_ADMIN',
    hospitalId: 'hosp-super',
  };

  const doctorB: AuthUser = {
    userId: 'u-doc-b',
    email: 'doc@hosp-b.com',
    roleId: 'r-doc',
    role: 'DOCTOR',
    hospitalId: hospitalB,
  };

  const patientAOther: AuthUser = {
    userId: 'u-pat-a2',
    email: 'patientA2@hosp-a.com',
    roleId: 'r-pat',
    role: 'PATIENT',
    hospitalId: hospitalA,
  };

  const accountantA: AuthUser = {
    userId: 'u-acc-a',
    email: 'acc@hosp-a.com',
    roleId: 'r-acc',
    role: 'ACCOUNTANT',
    hospitalId: hospitalA,
  };

  const accountantB: AuthUser = {
    userId: 'u-acc-b',
    email: 'acc@hosp-b.com',
    roleId: 'r-acc',
    role: 'ACCOUNTANT',
    hospitalId: hospitalB,
  };

  const labTechA: AuthUser = {
    userId: 'u-tech-a',
    email: 'tech@hosp-a.com',
    roleId: 'r-tech',
    role: 'LAB_TECHNICIAN',
    hospitalId: hospitalA,
  };

  const labTechB: AuthUser = {
    userId: 'u-tech-b',
    email: 'tech@hosp-b.com',
    roleId: 'r-tech',
    role: 'LAB_TECHNICIAN',
    hospitalId: hospitalB,
  };

  beforeEach(async () => {
    prisma = {
      patient: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      doctor: { findUnique: jest.fn(), findMany: jest.fn() },
      appointment: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      medicalRecord: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      prescription: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      medicine: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      medicineBatch: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
      labTest: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      labOrder: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      invoice: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      hospital: { findUnique: jest.fn() },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrescriptionService,
        MedicineService,
        LabTestService,
        LabOrderService,
        InvoiceService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    prescriptionService = module.get<PrescriptionService>(PrescriptionService);
    medicineService = module.get<MedicineService>(MedicineService);
    labTestService = module.get<LabTestService>(LabTestService);
    labOrderService = module.get<LabOrderService>(LabOrderService);
    invoiceService = module.get<InvoiceService>(InvoiceService);
  });

  describe('Section A: Tenant Isolation Across All Resources', () => {
    it('Medicine: blocks cross-hospital access to medicines', async () => {
      prisma.medicine.findUnique.mockResolvedValue({
        id: 'med-1',
        hospitalId: hospitalA,
        batches: [],
      });

      await expect(
        medicineService.getMedicineById('med-1', doctorB),
      ).rejects.toThrow(ForbiddenException);
    });

    it('LabTest: blocks cross-hospital access to lab tests', async () => {
      prisma.labTest.findUnique.mockResolvedValue({
        id: 'test-1',
        hospitalId: hospitalA,
      });

      await expect(
        labTestService.getLabTestById('test-1', labTechB),
      ).rejects.toThrow(ForbiddenException);
    });

    it('LabOrder: blocks cross-hospital access to lab orders', async () => {
      prisma.labOrder.findUnique.mockResolvedValue({
        id: 'order-1',
        medicalRecord: {
          patient: { hospitalId: hospitalA, user: { id: 'u-pat-a' } },
        },
      });

      await expect(
        labOrderService.getLabOrderById('order-1', doctorB),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Invoice: blocks cross-hospital access to invoices', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        patient: { hospitalId: hospitalA, user: { id: 'u-pat-a' } },
      });

      await expect(
        invoiceService.getInvoiceById('inv-1', accountantB),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Prescription: blocks cross-hospital access to prescriptions', async () => {
      prisma.prescription.findUnique.mockResolvedValue({
        id: 'presc-1',
        medicalRecord: {
          patient: { hospitalId: hospitalA, user: { id: 'u-pat-a' } },
        },
      });

      await expect(
        prescriptionService.getPrescriptionById('presc-1', doctorB),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Super Admin: allowed cross-hospital access for all resources', async () => {
      prisma.medicine.findUnique.mockResolvedValue({
        id: 'med-1',
        hospitalId: hospitalA,
        batches: [],
      });
      prisma.labTest.findUnique.mockResolvedValue({
        id: 'test-1',
        hospitalId: hospitalA,
      });

      const med = await medicineService.getMedicineById('med-1', superAdminCaller);
      const test = await labTestService.getLabTestById('test-1', superAdminCaller);

      expect(med.id).toBe('med-1');
      expect(test.id).toBe('test-1');
    });
  });

  describe('Section B: Patient Isolation Audit', () => {
    it('Patient cannot view another patient prescription', async () => {
      prisma.prescription.findUnique.mockResolvedValue({
        id: 'presc-1',
        medicalRecord: {
          patient: { hospitalId: hospitalA, user: { id: 'u-pat-a' } },
        },
      });

      await expect(
        prescriptionService.getPrescriptionById('presc-1', patientAOther),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Patient cannot view another patient lab order', async () => {
      prisma.labOrder.findUnique.mockResolvedValue({
        id: 'order-1',
        medicalRecord: {
          patient: { hospitalId: hospitalA, user: { id: 'u-pat-a' } },
        },
      });

      await expect(
        labOrderService.getLabOrderById('order-1', patientAOther),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Patient cannot view another patient invoice', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        patient: { hospitalId: hospitalA, user: { id: 'u-pat-a' } },
      });

      await expect(
        invoiceService.getInvoiceById('inv-1', patientAOther),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Section C: Workflow Transitions & Business Rules', () => {
    it('LabOrder: terminal COMPLETED state cannot be transitioned backwards', async () => {
      prisma.labOrder.findUnique.mockResolvedValue({
        id: 'order-1',
        status: 'COMPLETED',
        medicalRecord: {
          patient: { hospitalId: hospitalA, user: { id: 'u-pat-a' } },
        },
      });

      await expect(
        labOrderService.updateLabOrderStatus(
          'order-1',
          { status: 'IN_PROGRESS' },
          labTechA,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('Invoice: terminal PAID state cannot be cancelled or updated', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: 'PAID',
        subtotal: 100,
        tax: 0,
        discount: 0,
        total: 100,
        patient: { hospitalId: hospitalA, user: { id: 'u-pat-a' } },
      });

      await expect(
        invoiceService.updateInvoiceStatus(
          'inv-1',
          { status: 'CANCELLED' },
          accountantA,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        invoiceService.updateInvoice(
          'inv-1',
          { discount: 10 },
          accountantA,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
