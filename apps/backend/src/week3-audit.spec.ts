import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import type { AuthUser } from './auth/auth-user.interface';
import { PharmacyService } from './pharmacy/pharmacy.service';
import { PaymentService } from './payment/payment.service';
import { NotificationService } from './notification/notification.service';
import { NotificationGateway } from './notification/notification.gateway';
import { EmailService } from './notification/email.service';
import { SmsService } from './notification/sms.service';
import { PatientPortalService } from './patient-portal/patient-portal.service';
import { PrismaService } from './prisma/prisma.service';

describe('Week 3 Complete Integration, Security & Tenant Isolation Audit', () => {
  let prisma: any;
  let pharmacyService: PharmacyService;
  let paymentService: PaymentService;
  let notificationService: NotificationService;
  let patientPortalService: PatientPortalService;

  const hospitalA = 'hosp-aaa-111';
  const hospitalB = 'hosp-bbb-222';

  const pharmacistA: AuthUser = {
    userId: 'u-pharm-a',
    email: 'pharm@hosp-a.com',
    roleId: 'r-pharm',
    role: 'PHARMACIST',
    hospitalId: hospitalA,
  };

  const pharmacistB: AuthUser = {
    userId: 'u-pharm-b',
    email: 'pharm@hosp-b.com',
    roleId: 'r-pharm',
    role: 'PHARMACIST',
    hospitalId: hospitalB,
  };

  const doctorA: AuthUser = {
    userId: 'u-doc-a',
    email: 'doc@hosp-a.com',
    roleId: 'r-doc',
    role: 'DOCTOR',
    hospitalId: hospitalA,
  };

  const patientA: AuthUser = {
    userId: 'u-pat-a',
    email: 'patientA@hosp-a.com',
    roleId: 'r-pat',
    role: 'PATIENT',
    hospitalId: hospitalA,
  };

  const patientB: AuthUser = {
    userId: 'u-pat-b',
    email: 'patientB@hosp-b.com',
    roleId: 'r-pat',
    role: 'PATIENT',
    hospitalId: hospitalB,
  };

  const accountantA: AuthUser = {
    userId: 'u-acc-a',
    email: 'acc@hosp-a.com',
    roleId: 'r-acc',
    role: 'ACCOUNTANT',
    hospitalId: hospitalA,
  };

  const futureDate = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000);
  const pastDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

  beforeEach(async () => {
    prisma = {
      medicine: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      medicineBatch: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      prescription: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      prescriptionItem: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      invoice: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      payment: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      notification: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
      patient: {
        findUnique: jest.fn(),
      },
      appointment: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      medicalRecord: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      labOrder: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    const mockGateway = {
      emitToUser: jest.fn(),
      emitToHospital: jest.fn(),
    };

    const mockEmailService = {
      sendEmail: jest.fn().mockResolvedValue({ success: true, id: 'email-1' }),
    };

    const mockSmsService = {
      sendSms: jest.fn().mockResolvedValue({ success: true, sid: 'sms-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PharmacyService,
        PaymentService,
        NotificationService,
        PatientPortalService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationGateway, useValue: mockGateway },
        { provide: EmailService, useValue: mockEmailService },
        { provide: SmsService, useValue: mockSmsService },
      ],
    }).compile();

    pharmacyService = module.get<PharmacyService>(PharmacyService);
    paymentService = module.get<PaymentService>(PaymentService);
    notificationService = module.get<NotificationService>(NotificationService);
    patientPortalService = module.get<PatientPortalService>(PatientPortalService);
  });

  describe('Part 1: Pharmacy Management Audit', () => {
    const mockPrescription = {
      id: 'presc-audit-1',
      status: 'PRESCRIBED',
      medicalRecord: {
        patient: {
          id: 'patient-rec-a',
          hospitalId: hospitalA,
          userId: 'u-pat-a',
        },
      },
      items: [
        {
          id: 'item-1',
          medicineId: 'med-1',
          dispensedQuantity: 0,
          medicine: {
            id: 'med-1',
            name: 'Metformin',
            hospitalId: hospitalA,
            isActive: true,
          },
        },
      ],
    };

    it('enforces tenant isolation: Pharmacist B cannot access Hospital A prescription', async () => {
      prisma.prescription.findUnique.mockResolvedValue(mockPrescription);

      await expect(
        pharmacyService.getPrescriptionById('presc-audit-1', pharmacistB),
      ).rejects.toThrow(ForbiddenException);
    });

    it('enforces RBAC: Doctor cannot dispense medication', async () => {
      await expect(
        pharmacyService.dispense(
          {
            prescriptionId: 'presc-audit-1',
            items: [{ prescriptionItemId: 'item-1', batchId: 'batch-1', quantity: 10 }],
          },
          doctorA,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('enforces RBAC: Accountant cannot dispense medication', async () => {
      await expect(
        pharmacyService.dispense(
          {
            prescriptionId: 'presc-audit-1',
            items: [{ prescriptionItemId: 'item-1', batchId: 'batch-1', quantity: 10 }],
          },
          accountantA,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('CRITICAL PRD CHECK: Expired medicine batch cannot be dispensed and throws validation error', async () => {
      prisma.prescription.findUnique.mockResolvedValue(mockPrescription);
      prisma.medicineBatch.findUnique.mockResolvedValue({
        id: 'batch-expired',
        medicineId: 'med-1',
        batchNumber: 'MET-EXP-01',
        expiryDate: pastDate,
        quantity: 100,
        medicine: {
          id: 'med-1',
          name: 'Metformin',
          hospitalId: hospitalA,
          isActive: true,
        },
      });

      await expect(
        pharmacyService.dispense(
          {
            prescriptionId: 'presc-audit-1',
            items: [{ prescriptionItemId: 'item-1', batchId: 'batch-expired', quantity: 10 }],
          },
          pharmacistA,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects dispensing inactive medicine', async () => {
      prisma.prescription.findUnique.mockResolvedValue(mockPrescription);
      prisma.medicineBatch.findUnique.mockResolvedValue({
        id: 'batch-inactive-med',
        medicineId: 'med-1',
        batchNumber: 'MET-02',
        expiryDate: futureDate,
        quantity: 100,
        medicine: {
          id: 'med-1',
          name: 'Metformin',
          hospitalId: hospitalA,
          isActive: false, // Inactive
        },
      });

      await expect(
        pharmacyService.dispense(
          {
            prescriptionId: 'presc-audit-1',
            items: [{ prescriptionItemId: 'item-1', batchId: 'batch-inactive-med', quantity: 10 }],
          },
          pharmacistA,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects dispensing with insufficient stock', async () => {
      prisma.prescription.findUnique.mockResolvedValue(mockPrescription);
      prisma.medicineBatch.findUnique.mockResolvedValue({
        id: 'batch-low',
        medicineId: 'med-1',
        batchNumber: 'MET-03',
        expiryDate: futureDate,
        quantity: 5, // only 5 available
        medicine: {
          id: 'med-1',
          name: 'Metformin',
          hospitalId: hospitalA,
          isActive: true,
        },
      });

      await expect(
        pharmacyService.dispense(
          {
            prescriptionId: 'presc-audit-1',
            items: [{ prescriptionItemId: 'item-1', batchId: 'batch-low', quantity: 20 }],
          },
          pharmacistA,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('dispenses valid stock atomically and updates status to FULFILLED', async () => {
      prisma.prescription.findUnique.mockResolvedValue(mockPrescription);
      prisma.medicineBatch.findUnique.mockResolvedValue({
        id: 'batch-good',
        medicineId: 'med-1',
        batchNumber: 'MET-GOOD',
        expiryDate: futureDate,
        quantity: 100,
        medicine: {
          id: 'med-1',
          name: 'Metformin',
          hospitalId: hospitalA,
          isActive: true,
        },
      });

      prisma.prescriptionItem.findMany.mockResolvedValue([
        { id: 'item-1', prescriptionId: 'presc-audit-1', dispensedQuantity: 10 },
      ]);

      prisma.prescription.update.mockResolvedValue({
        id: 'presc-audit-1',
        status: 'FULFILLED',
      });

      const res = await pharmacyService.dispense(
        {
          prescriptionId: 'presc-audit-1',
          items: [{ prescriptionItemId: 'item-1', batchId: 'batch-good', quantity: 10 }],
        },
        pharmacistA,
      );

      expect(res.status).toBe('FULFILLED');
      expect(prisma.medicineBatch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'batch-good' },
          data: { quantity: { decrement: 10 } },
        }),
      );
    });
  });

  describe('Part 2: Payment Gateway Audit', () => {
    const mockInvoice = {
      id: 'inv-audit-1',
      invoiceNumber: 'INV-AUDIT-100',
      total: 3500,
      status: 'DRAFT',
      patientId: 'patient-rec-a',
      patient: {
        id: 'patient-rec-a',
        hospitalId: hospitalA,
        userId: 'u-pat-a',
        user: { name: 'Patient A', email: 'patA@test.com' },
      },
    };

    it('calculates order amount from server-side invoice total and prevents amount tampering', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      prisma.patient.findUnique.mockResolvedValue({ id: 'patient-rec-a', userId: 'u-pat-a' });
      prisma.payment.create.mockResolvedValue({
        id: 'pay-1',
        amount: 3500,
        gatewayOrderId: 'order_123',
        status: 'CREATED',
      });

      const order = await paymentService.createOrder({ invoiceId: 'inv-audit-1' }, patientA);
      expect(order.amount).toBe(3500);
      expect(order.amountInPaise).toBe(350000);
    });

    it('rejects order creation if invoice is already paid', async () => {
      prisma.invoice.findUnique.mockResolvedValue({ ...mockInvoice, status: 'PAID' });
      prisma.patient.findUnique.mockResolvedValue({ id: 'patient-rec-a', userId: 'u-pat-a' });

      await expect(
        paymentService.createOrder({ invoiceId: 'inv-audit-1' }, patientA),
      ).rejects.toThrow(BadRequestException);
    });

    it('IDEMPOTENCY: webhook processing does not duplicate payment or invoice status if already captured', async () => {
      prisma.payment.findFirst.mockResolvedValue({
        id: 'pay-captured-1',
        invoiceId: 'inv-audit-1',
        gatewayOrderId: 'order_captured_1',
        status: 'SUCCESS', // Already processed
      });

      const secret = 'rzp_webhook_placeholder_secret';
      const payload = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: { id: 'pay_id_1', order_id: 'order_captured_1', amount: 350000 },
          },
        },
      });

      const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

      const res = await paymentService.handleWebhook(payload, signature);
      expect(res.status).toBe('already_processed');
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });
  });

  describe('Part 3: Patient Portal Isolation Audit', () => {
    it('Patient A cannot cancel Patient B appointment', async () => {
      prisma.patient.findUnique.mockResolvedValue({
        id: 'patient-rec-a',
        userId: 'u-pat-a',
        deletedAt: null,
      });

      // Appointment belongs to Patient B
      prisma.appointment.findFirst.mockResolvedValue(null);

      await expect(
        patientPortalService.cancelAppointment('apt-b', 'Reason', patientA),
      ).rejects.toThrow(NotFoundException);
    });

    it('Patient A cannot view Patient B invoice', async () => {
      prisma.patient.findUnique.mockResolvedValue({
        id: 'patient-rec-a',
        userId: 'u-pat-a',
        deletedAt: null,
      });

      prisma.invoice.findFirst.mockResolvedValue(null);

      await expect(
        patientPortalService.getInvoiceById('inv-b', patientA),
      ).rejects.toThrow(NotFoundException);
    });

    it('Patient B cannot view Patient A prescriptions', async () => {
      prisma.patient.findUnique.mockResolvedValue({
        id: 'patient-rec-b',
        userId: 'u-pat-b',
        deletedAt: null,
      });

      prisma.prescription.findFirst.mockResolvedValue(null);

      await expect(
        patientPortalService.getPrescriptionById('presc-a', patientB),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Part 4: Notification Non-Blocking Safety Audit', () => {
    it('dispatches notification without throwing even if database operation encounters error', async () => {
      prisma.notification.create.mockRejectedValue(new Error('Network error'));

      const result = await notificationService.dispatch({
        userId: 'u-pat-a',
        type: 'test.alert',
        title: 'Alert',
        message: 'Important alert',
      });

      expect(result).toBeNull(); // Does not crash or bubble up
    });
  });
});
