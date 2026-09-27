import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

describe('InvoiceModule Integration & RBAC Tests (Day 13)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let invoiceService: {
    createInvoice: jest.Mock;
    getInvoices: jest.Mock;
    getInvoiceById: jest.Mock;
    getInvoicesByPatientId: jest.Mock;
    getInvoiceByAppointmentId: jest.Mock;
    updateInvoice: jest.Mock;
    updateInvoiceStatus: jest.Mock;
  };

  const JWT_SECRET = 'test-jwt-secret-key-12345678901234567890';
  process.env.JWT_ACCESS_SECRET = JWT_SECRET;

  const validPatientId = 'a19c8d0e-1111-4c5e-855c-097587ef75dc';
  const validInvoiceId = 'b29c8d0e-2222-4c5e-855c-097587ef75dc';
  const hospitalAId = 'hosp-aaa-111';
  const hospitalBId = 'hosp-bbb-222';

  const mockInvoice = {
    id: validInvoiceId,
    invoiceNumber: 'INV-20260926-0001',
    patientId: validPatientId,
    subtotal: 500,
    tax: 50,
    discount: 25,
    total: 525,
    status: 'DRAFT',
    patient: {
      id: validPatientId,
      hospitalId: hospitalAId,
      user: {
        id: 'user-pat-1',
        name: 'Jane Doe',
        email: 'pat@apollo.com',
        hospitalId: hospitalAId,
      },
    },
    items: [
      {
        id: 'item-1',
        description: 'Procedure Fee',
        category: 'PROCEDURE',
        quantity: 1,
        unitPrice: 500,
        total: 500,
      },
    ],
  };

  beforeAll(async () => {
    jwtService = new JwtService({ secret: JWT_SECRET });

    invoiceService = {
      createInvoice: jest.fn(),
      getInvoices: jest.fn(),
      getInvoiceById: jest.fn(),
      getInvoicesByPatientId: jest.fn(),
      getInvoiceByAppointmentId: jest.fn(),
      updateInvoice: jest.fn(),
      updateInvoiceStatus: jest.fn(),
    };

    const prismaMock = {
      user: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          return Promise.resolve({
            id: where.id,
            isActive: true,
          });
        }),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [InvoiceController],
      providers: [
        { provide: InvoiceService, useValue: invoiceService },
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtService },
        JwtAuthGuard,
        RolesGuard,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const generateToken = (payload: {
    userId: string;
    email: string;
    roleId: string;
    role: string;
    hospitalId?: string;
  }) => {
    return jwtService.sign(payload, { secret: JWT_SECRET });
  };

  describe('POST /invoices - Creation & RBAC', () => {
    it('allows ACCOUNTANT to create invoice', async () => {
      invoiceService.createInvoice.mockResolvedValue(mockInvoice);
      const token = generateToken({
        userId: 'u-acc',
        email: 'acc@apollo.com',
        roleId: 'r-acc',
        role: 'ACCOUNTANT',
        hospitalId: hospitalAId,
      });

      const res = await request(app.getHttpServer())
        .post('/invoices')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId: validPatientId,
          tax: 50,
          discount: 25,
          items: [
            {
              description: 'Procedure Fee',
              category: 'PROCEDURE',
              quantity: 1,
              unitPrice: 500,
            },
          ],
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBe(525);
    });

    it('blocks DOCTOR from creating invoice (403)', async () => {
      const token = generateToken({
        userId: 'u-doc',
        email: 'doc@apollo.com',
        roleId: 'r-doc',
        role: 'DOCTOR',
        hospitalId: hospitalAId,
      });

      await request(app.getHttpServer())
        .post('/invoices')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId: validPatientId,
          items: [{ description: 'Fee', category: 'FEE', quantity: 1, unitPrice: 100 }],
        })
        .expect(403);
    });

    it('blocks PATIENT from creating invoice (403)', async () => {
      const token = generateToken({
        userId: 'u-pat',
        email: 'pat@apollo.com',
        roleId: 'r-pat',
        role: 'PATIENT',
        hospitalId: hospitalAId,
      });

      await request(app.getHttpServer())
        .post('/invoices')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId: validPatientId,
          items: [{ description: 'Fee', category: 'FEE', quantity: 1, unitPrice: 100 }],
        })
        .expect(403);
    });

    it('rejects invoice item with zero quantity (400)', async () => {
      const token = generateToken({
        userId: 'u-acc',
        email: 'acc@apollo.com',
        roleId: 'r-acc',
        role: 'ACCOUNTANT',
        hospitalId: hospitalAId,
      });

      await request(app.getHttpServer())
        .post('/invoices')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId: validPatientId,
          items: [{ description: 'Fee', category: 'FEE', quantity: 0, unitPrice: 100 }],
        })
        .expect(400);
    });

    it('rejects invoice item with negative unit price (400)', async () => {
      const token = generateToken({
        userId: 'u-acc',
        email: 'acc@apollo.com',
        roleId: 'r-acc',
        role: 'ACCOUNTANT',
        hospitalId: hospitalAId,
      });

      await request(app.getHttpServer())
        .post('/invoices')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId: validPatientId,
          items: [{ description: 'Fee', category: 'FEE', quantity: 1, unitPrice: -50 }],
        })
        .expect(400);
    });
  });

  describe('GET /invoices - Tenancy & Patient Isolation', () => {
    it('allows PATIENT to view their own invoices', async () => {
      invoiceService.getInvoices.mockResolvedValue([mockInvoice]);
      const token = generateToken({
        userId: 'user-pat-1',
        email: 'pat@apollo.com',
        roleId: 'role-pat',
        role: 'PATIENT',
        hospitalId: hospitalAId,
      });

      const res = await request(app.getHttpServer())
        .get('/invoices')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    it('blocks patient from viewing another patient invoice by id (403)', async () => {
      invoiceService.getInvoiceById.mockRejectedValue(
        new ForbiddenException('Access denied: You can only view your own invoices'),
      );
      const token = generateToken({
        userId: 'user-pat-2',
        email: 'other@apollo.com',
        roleId: 'role-pat',
        role: 'PATIENT',
        hospitalId: hospitalAId,
      });

      await request(app.getHttpServer())
        .get(`/invoices/${validInvoiceId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('blocks cross-hospital access to invoices (403)', async () => {
      invoiceService.getInvoiceById.mockRejectedValue(
        new ForbiddenException('Access denied: Invoice belongs to another hospital'),
      );
      const token = generateToken({
        userId: 'u-acc-b',
        email: 'acc@fortis.com',
        roleId: 'r-acc',
        role: 'ACCOUNTANT',
        hospitalId: hospitalBId,
      });

      await request(app.getHttpServer())
        .get(`/invoices/${validInvoiceId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  describe('PATCH /invoices/:id/status - Status Workflow', () => {
    it('allows ACCOUNTANT to transition status to ISSUED and PAID', async () => {
      invoiceService.updateInvoiceStatus.mockResolvedValue({
        ...mockInvoice,
        status: 'PAID',
      });
      const token = generateToken({
        userId: 'u-acc',
        email: 'acc@apollo.com',
        roleId: 'r-acc',
        role: 'ACCOUNTANT',
        hospitalId: hospitalAId,
      });

      const res = await request(app.getHttpServer())
        .patch(`/invoices/${validInvoiceId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'PAID' })
        .expect(200);

      expect(res.body.data.status).toBe('PAID');
    });

    it('blocks PATIENT from changing invoice status (403)', async () => {
      const token = generateToken({
        userId: 'u-pat',
        email: 'pat@apollo.com',
        roleId: 'r-pat',
        role: 'PATIENT',
        hospitalId: hospitalAId,
      });

      await request(app.getHttpServer())
        .patch(`/invoices/${validInvoiceId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'PAID' })
        .expect(403);
    });
  });
});
