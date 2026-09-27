import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { LabTestController } from './lab-test.controller';
import { LabOrderController } from './lab-order.controller';
import { LabTestService } from './lab-test.service';
import { LabOrderService } from './lab-order.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

describe('LabModule Integration & RBAC Tests (Day 12)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let labTestService: {
    createLabTest: jest.Mock;
    getLabTests: jest.Mock;
    getLabTestById: jest.Mock;
    updateLabTest: jest.Mock;
  };
  let labOrderService: {
    createLabOrder: jest.Mock;
    getLabOrders: jest.Mock;
    getLabOrderById: jest.Mock;
    getLabOrdersByMedicalRecordId: jest.Mock;
    updateLabOrder: jest.Mock;
    updateLabOrderStatus: jest.Mock;
  };

  const JWT_SECRET = 'test-jwt-secret-key-12345678901234567890';
  process.env.JWT_ACCESS_SECRET = JWT_SECRET;

  const validRecordId = 'c19c8d0e-1111-4c5e-855c-097587ef75dc';
  const validTestId = 'd29c8d0e-2222-4c5e-855c-097587ef75dc';
  const validOrderId = 'e39c8d0e-3333-4c5e-855c-097587ef75dc';
  const hospitalAId = 'hosp-aaa-111';
  const hospitalBId = 'hosp-bbb-222';

  const mockLabTest = {
    id: validTestId,
    hospitalId: hospitalAId,
    name: 'Complete Blood Count',
    unit: 'cells/mcL',
    referenceMin: 4.5,
    referenceMax: 11.0,
  };

  const mockLabOrder = {
    id: validOrderId,
    medicalRecordId: validRecordId,
    labTestId: validTestId,
    status: 'ORDERED',
    result: null,
    resultValue: null,
    reportUrl: null,
    medicalRecord: {
      id: validRecordId,
      patient: {
        id: 'pat-1',
        hospitalId: hospitalAId,
        user: { id: 'u-pat', name: 'Jane Doe', email: 'pat@apollo.com', hospitalId: hospitalAId },
      },
      doctor: {
        id: 'doc-1',
        user: { id: 'u-doc', name: 'Dr. House', email: 'doc@apollo.com', hospitalId: hospitalAId },
      },
    },
    labTest: mockLabTest,
  };

  beforeAll(async () => {
    jwtService = new JwtService({ secret: JWT_SECRET });

    labTestService = {
      createLabTest: jest.fn(),
      getLabTests: jest.fn(),
      getLabTestById: jest.fn(),
      updateLabTest: jest.fn(),
    };

    labOrderService = {
      createLabOrder: jest.fn(),
      getLabOrders: jest.fn(),
      getLabOrderById: jest.fn(),
      getLabOrdersByMedicalRecordId: jest.fn(),
      updateLabOrder: jest.fn(),
      updateLabOrderStatus: jest.fn(),
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
      controllers: [LabTestController, LabOrderController],
      providers: [
        { provide: LabTestService, useValue: labTestService },
        { provide: LabOrderService, useValue: labOrderService },
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

  describe('LabTest Endpoints & RBAC', () => {
    it('allows LAB_TECHNICIAN to create lab test', async () => {
      labTestService.createLabTest.mockResolvedValue(mockLabTest);
      const token = generateToken({
        userId: 'u-tech',
        email: 'tech@apollo.com',
        roleId: 'r-tech',
        role: 'LAB_TECHNICIAN',
        hospitalId: hospitalAId,
      });

      const res = await request(app.getHttpServer())
        .post('/lab-tests')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Complete Blood Count',
          unit: 'cells/mcL',
          referenceMin: 4.5,
          referenceMax: 11.0,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Complete Blood Count');
    });

    it('blocks DOCTOR from creating lab tests (403)', async () => {
      const token = generateToken({
        userId: 'u-doc',
        email: 'doc@apollo.com',
        roleId: 'r-doc',
        role: 'DOCTOR',
        hospitalId: hospitalAId,
      });

      await request(app.getHttpServer())
        .post('/lab-tests')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Serum Creatinine' })
        .expect(403);
    });

    it('blocks PATIENT from creating lab tests (403)', async () => {
      const token = generateToken({
        userId: 'u-pat',
        email: 'pat@apollo.com',
        roleId: 'r-pat',
        role: 'PATIENT',
        hospitalId: hospitalAId,
      });

      await request(app.getHttpServer())
        .post('/lab-tests')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Serum Creatinine' })
        .expect(403);
    });

    it('returns 403 on cross-hospital lab test access', async () => {
      labTestService.getLabTestById.mockRejectedValue(
        new ForbiddenException('Access denied: Lab test belongs to another hospital'),
      );
      const token = generateToken({
        userId: 'u-tech-b',
        email: 'tech@fortis.com',
        roleId: 'r-tech',
        role: 'LAB_TECHNICIAN',
        hospitalId: hospitalBId,
      });

      await request(app.getHttpServer())
        .get(`/lab-tests/${validTestId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  describe('LabOrder Endpoints & RBAC', () => {
    it('allows treating DOCTOR to create lab order', async () => {
      labOrderService.createLabOrder.mockResolvedValue(mockLabOrder);
      const token = generateToken({
        userId: 'u-doc',
        email: 'doc@apollo.com',
        roleId: 'r-doc',
        role: 'DOCTOR',
        hospitalId: hospitalAId,
      });

      const res = await request(app.getHttpServer())
        .post('/lab-orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          medicalRecordId: validRecordId,
          labTestId: validTestId,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(validOrderId);
    });

    it('blocks PATIENT from creating lab orders (403)', async () => {
      const token = generateToken({
        userId: 'u-pat',
        email: 'pat@apollo.com',
        roleId: 'r-pat',
        role: 'PATIENT',
        hospitalId: hospitalAId,
      });

      await request(app.getHttpServer())
        .post('/lab-orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          medicalRecordId: validRecordId,
          labTestId: validTestId,
        })
        .expect(403);
    });

    it('allows PATIENT to view their own lab order', async () => {
      labOrderService.getLabOrderById.mockResolvedValue(mockLabOrder);
      const token = generateToken({
        userId: 'u-pat',
        email: 'pat@apollo.com',
        roleId: 'r-pat',
        role: 'PATIENT',
        hospitalId: hospitalAId,
      });

      const res = await request(app.getHttpServer())
        .get(`/lab-orders/${validOrderId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.id).toBe(validOrderId);
    });

    it('blocks PATIENT from viewing another patient lab order (403)', async () => {
      labOrderService.getLabOrderById.mockRejectedValue(
        new ForbiddenException('Access denied: You can only view your own lab orders'),
      );
      const token = generateToken({
        userId: 'u-pat-other',
        email: 'other@apollo.com',
        roleId: 'r-pat',
        role: 'PATIENT',
        hospitalId: hospitalAId,
      });

      await request(app.getHttpServer())
        .get(`/lab-orders/${validOrderId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('blocks cross-hospital access to lab orders (403)', async () => {
      labOrderService.getLabOrderById.mockRejectedValue(
        new ForbiddenException('Access denied: Lab order belongs to another hospital'),
      );
      const token = generateToken({
        userId: 'u-doc-b',
        email: 'doc@fortis.com',
        roleId: 'r-doc',
        role: 'DOCTOR',
        hospitalId: hospitalBId,
      });

      await request(app.getHttpServer())
        .get(`/lab-orders/${validOrderId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('allows LAB_TECHNICIAN to update order status to IN_PROGRESS and COMPLETED', async () => {
      labOrderService.updateLabOrderStatus.mockResolvedValue({
        ...mockLabOrder,
        status: 'COMPLETED',
        resultValue: 8.5,
        result: 'Normal values',
      });
      const token = generateToken({
        userId: 'u-tech',
        email: 'tech@apollo.com',
        roleId: 'r-tech',
        role: 'LAB_TECHNICIAN',
        hospitalId: hospitalAId,
      });

      const res = await request(app.getHttpServer())
        .patch(`/lab-orders/${validOrderId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          status: 'COMPLETED',
          resultValue: 8.5,
          result: 'Normal values',
        })
        .expect(200);

      expect(res.body.data.status).toBe('COMPLETED');
    });

    it('rejects invalid status values with 400 Bad Request', async () => {
      const token = generateToken({
        userId: 'u-tech',
        email: 'tech@apollo.com',
        roleId: 'r-tech',
        role: 'LAB_TECHNICIAN',
        hospitalId: hospitalAId,
      });

      await request(app.getHttpServer())
        .patch(`/lab-orders/${validOrderId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'INVALID_STATUS' })
        .expect(400);
    });
  });
});
