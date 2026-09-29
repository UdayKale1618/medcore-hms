import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

describe('Payment Module Integration & RBAC Tests', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let paymentService: {
    createOrder: jest.Mock;
    verifyPayment: jest.Mock;
    handleWebhook: jest.Mock;
    getInvoicePayments: jest.Mock;
  };

  const JWT_SECRET = 'test-jwt-secret-key-12345678901234567890';
  process.env.JWT_ACCESS_SECRET = JWT_SECRET;

  const hospitalAId = 'hosp-aaa-111';
  const validInvoiceId = '9151240c-1111-4444-9999-000000000001';

  beforeAll(async () => {
    paymentService = {
      createOrder: jest.fn(),
      verifyPayment: jest.fn(),
      handleWebhook: jest.fn(),
      getInvoicePayments: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        { provide: PaymentService, useValue: paymentService },
        { provide: PrismaService, useValue: {} },
        JwtService,
        JwtAuthGuard,
        RolesGuard,
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    jwtService = module.get<JwtService>(JwtService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  function createToken(role: string, hospitalId = hospitalAId, userId = 'user-1') {
    return jwtService.sign(
      {
        userId,
        email: `${role.toLowerCase()}@apollo.com`,
        roleId: `role-${role.toLowerCase()}`,
        role,
        hospitalId,
      },
      { secret: JWT_SECRET },
    );
  }

  describe('POST /payments/create-order', () => {
    it('allows Patient to create a payment order for their invoice', async () => {
      paymentService.createOrder.mockResolvedValue({
        paymentId: 'pay-1',
        orderId: 'order_123',
        amount: 2500,
        amountInPaise: 250000,
        currency: 'INR',
        invoiceNumber: 'INV-001',
      });

      const token = createToken('PATIENT');
      const res = await request(app.getHttpServer())
        .post('/payments/create-order')
        .set('Authorization', `Bearer ${token}`)
        .send({ invoiceId: validInvoiceId })
        .expect(201);

      expect(res.body.orderId).toBe('order_123');
      expect(res.body.amount).toBe(2500);
    });

    it('denies Pharmacist from creating payment orders', async () => {
      const token = createToken('PHARMACIST');
      await request(app.getHttpServer())
        .post('/payments/create-order')
        .set('Authorization', `Bearer ${token}`)
        .send({ invoiceId: validInvoiceId })
        .expect(403);
    });
  });

  describe('POST /payments/verify', () => {
    it('allows Patient to verify payment signature', async () => {
      paymentService.verifyPayment.mockResolvedValue({
        message: 'Payment verified and captured successfully',
        payment: { status: 'SUCCESS' },
        invoice: { status: 'PAID' },
      });

      const token = createToken('PATIENT');
      const res = await request(app.getHttpServer())
        .post('/payments/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({
          invoiceId: validInvoiceId,
          razorpayOrderId: 'order_123',
          razorpayPaymentId: 'pay_456',
          razorpaySignature: 'valid_sig_abc',
        })
        .expect(201);

      expect(res.body.payment.status).toBe('SUCCESS');
      expect(res.body.invoice.status).toBe('PAID');
    });
  });

  describe('POST /payments/webhook/razorpay', () => {
    it('processes webhook with valid signature', async () => {
      paymentService.handleWebhook.mockResolvedValue({
        received: true,
        status: 'processed',
      });

      const res = await request(app.getHttpServer())
        .post('/payments/webhook/razorpay')
        .set('x-razorpay-signature', 'valid_sig')
        .send({ event: 'payment.captured' })
        .expect(201);

      expect(res.body.status).toBe('processed');
    });
  });
});
