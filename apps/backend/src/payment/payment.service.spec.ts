import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PaymentService } from './payment.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import type { AuthUser } from '../auth/auth-user.interface';

describe('PaymentService (Razorpay Integration)', () => {
  let service: PaymentService;
  let prisma: any;
  let notificationService: any;

  const hospitalA = 'hosp-aaa-111';
  const hospitalB = 'hosp-bbb-222';

  const patientCaller: AuthUser = {
    userId: 'u-pat-1',
    email: 'pat1@apollo.com',
    roleId: 'role-pat',
    role: 'PATIENT',
    hospitalId: hospitalA,
  };

  const otherPatientCaller: AuthUser = {
    userId: 'u-pat-2',
    email: 'pat2@apollo.com',
    roleId: 'role-pat',
    role: 'PATIENT',
    hospitalId: hospitalA,
  };

  const accountantCaller: AuthUser = {
    userId: 'u-acc-1',
    email: 'acc@apollo.com',
    roleId: 'role-acc',
    role: 'ACCOUNTANT',
    hospitalId: hospitalA,
  };

  const otherHospitalCaller: AuthUser = {
    userId: 'u-acc-2',
    email: 'acc2@fortis.com',
    roleId: 'role-acc',
    role: 'ACCOUNTANT',
    hospitalId: hospitalB,
  };

  const mockInvoice = {
    id: 'inv-1',
    invoiceNumber: 'INV-2026-0001',
    status: 'DRAFT',
    total: 2500,
    patientId: 'patient-record-1',
    patient: {
      id: 'patient-record-1',
      hospitalId: hospitalA,
      userId: 'u-pat-1',
      user: {
        id: 'u-pat-1',
        name: 'Rahul Sharma',
        email: 'pat1@apollo.com',
        phone: '+91 9876543210',
      },
    },
  };

  const secret = 'rzp_test_placeholder_secret';
  const webhookSecret = 'rzp_webhook_placeholder_secret';

  beforeEach(async () => {
    prisma = {
      invoice: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      payment: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      patient: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    notificationService = {
      dispatch: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationService, useValue: notificationService },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  describe('createOrder', () => {
    it('creates Razorpay order using server-side invoice total and stores Payment entity', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      prisma.patient.findUnique.mockResolvedValue({ id: 'patient-record-1', userId: 'u-pat-1' });
      prisma.payment.create.mockResolvedValue({
        id: 'pay-1',
        invoiceId: 'inv-1',
        amount: 2500,
        gatewayOrderId: 'order_123',
        status: 'CREATED',
      });

      const result = await service.createOrder({ invoiceId: 'inv-1' }, patientCaller);

      expect(result.amount).toBe(2500);
      expect(result.amountInPaise).toBe(250000);
      expect(result.currency).toBe('INR');
      expect(result.invoiceNumber).toBe('INV-2026-0001');
      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            invoiceId: 'inv-1',
            hospitalId: hospitalA,
            gateway: 'RAZORPAY',
            status: 'CREATED',
          }),
        }),
      );
    });

    it('rejects order creation for already-paid invoice', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        ...mockInvoice,
        status: 'PAID',
      });

      await expect(
        service.createOrder({ invoiceId: 'inv-1' }, accountantCaller),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects order creation for cancelled invoice', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        ...mockInvoice,
        status: 'CANCELLED',
      });

      await expect(
        service.createOrder({ invoiceId: 'inv-1' }, accountantCaller),
      ).rejects.toThrow(BadRequestException);
    });

    it('enforces patient isolation: prevents patient from paying another patient invoice', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      prisma.patient.findUnique.mockResolvedValue({ id: 'patient-record-2', userId: 'u-pat-2' });

      await expect(
        service.createOrder({ invoiceId: 'inv-1' }, otherPatientCaller),
      ).rejects.toThrow(ForbiddenException);
    });

    it('enforces tenant isolation: prevents staff from another hospital from creating order', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      await expect(
        service.createOrder({ invoiceId: 'inv-1' }, otherHospitalCaller),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('verifyPayment', () => {
    const orderId = 'order_test_12345';
    const paymentId = 'pay_test_67890';
    const validSignature = crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    it('validates signature and transitions payment to SUCCESS and invoice to PAID atomically', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      prisma.payment.findFirst.mockResolvedValue({
        id: 'pay-db-1',
        invoiceId: 'inv-1',
        gatewayOrderId: orderId,
        status: 'CREATED',
      });
      prisma.patient.findUnique.mockResolvedValue({ id: 'patient-record-1', userId: 'u-pat-1' });

      prisma.payment.update.mockResolvedValue({
        id: 'pay-db-1',
        status: 'SUCCESS',
        gatewayPaymentId: paymentId,
      });
      prisma.invoice.update.mockResolvedValue({
        id: 'inv-1',
        status: 'PAID',
      });

      const result = await service.verifyPayment(
        {
          invoiceId: 'inv-1',
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: validSignature,
        },
        patientCaller,
      );

      expect(result.message).toContain('Payment verified');
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-db-1' },
          data: expect.objectContaining({ status: 'SUCCESS' }),
        }),
      );
      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          data: expect.objectContaining({ status: 'PAID' }),
        }),
      );
      expect(notificationService.dispatch).toHaveBeenCalled();
    });

    it('rejects invalid signature and marks payment as FAILED', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      prisma.payment.findFirst.mockResolvedValue({
        id: 'pay-db-1',
        invoiceId: 'inv-1',
        gatewayOrderId: orderId,
        status: 'CREATED',
      });
      prisma.patient.findUnique.mockResolvedValue({ id: 'patient-record-1', userId: 'u-pat-1' });

      await expect(
        service.verifyPayment(
          {
            invoiceId: 'inv-1',
            razorpayOrderId: orderId,
            razorpayPaymentId: paymentId,
            razorpaySignature: 'invalid-tampered-signature-00000000000000000000000000000000000000000000',
          },
          patientCaller,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-db-1' },
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
    });
  });

  describe('handleWebhook (Idempotency & Signature Verification)', () => {
    const webhookPayload = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_capture_123',
            order_id: 'order_webhook_456',
            amount: 250000,
            method: 'upi',
          },
        },
      },
    });

    const validWebhookSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(webhookPayload)
      .digest('hex');

    it('processes payment.captured event and transitions invoice to PAID', async () => {
      prisma.payment.findFirst.mockResolvedValue({
        id: 'pay-db-webhook',
        invoiceId: 'inv-1',
        gatewayOrderId: 'order_webhook_456',
        status: 'CREATED',
      });

      prisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      const res = await service.handleWebhook(webhookPayload, validWebhookSig);
      expect(res.status).toBe('processed');
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-db-webhook' },
          data: expect.objectContaining({ status: 'SUCCESS' }),
        }),
      );
      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          data: expect.objectContaining({ status: 'PAID' }),
        }),
      );
    });

    it('IDEMPOTENCY: safely ignores duplicate webhook event when payment is already SUCCESS', async () => {
      prisma.payment.findFirst.mockResolvedValue({
        id: 'pay-db-webhook',
        invoiceId: 'inv-1',
        gatewayOrderId: 'order_webhook_456',
        status: 'SUCCESS', // Already processed
      });

      const res = await service.handleWebhook(webhookPayload, validWebhookSig);
      expect(res.status).toBe('already_processed');
      // Should NOT update payment or invoice again
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });

    it('rejects webhook with invalid signature', async () => {
      await expect(
        service.handleWebhook(webhookPayload, 'invalid-signature-12345'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
