import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { MedicineController } from './medicine.controller';
import { MedicineService } from './medicine.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

describe('MedicineModule Integration & RBAC Tests (Day 11)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let medicineService: {
    createMedicine: jest.Mock;
    getMedicines: jest.Mock;
    getMedicineById: jest.Mock;
    updateMedicine: jest.Mock;
    createBatch: jest.Mock;
    getBatches: jest.Mock;
  };

  const JWT_SECRET = 'test-jwt-secret-key-12345678901234567890';
  process.env.JWT_ACCESS_SECRET = JWT_SECRET;

  const validMedId = '11111111-2222-3333-4444-555555555555';
  const hospitalAId = 'hosp-aaa-111';
  const hospitalBId = 'hosp-bbb-222';

  const mockMedicine = {
    id: validMedId,
    hospitalId: hospitalAId,
    name: 'Amoxicillin',
    form: 'CAPSULE',
    description: 'Antibiotic',
    reorderLevel: 15,
    totalStock: 500,
    hasValidStock: true,
    batches: [],
  };

  beforeAll(async () => {
    jwtService = new JwtService({ secret: JWT_SECRET });

    medicineService = {
      createMedicine: jest.fn(),
      getMedicines: jest.fn(),
      getMedicineById: jest.fn(),
      updateMedicine: jest.fn(),
      createBatch: jest.fn(),
      getBatches: jest.fn(),
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
      controllers: [MedicineController],
      providers: [
        { provide: MedicineService, useValue: medicineService },
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

  describe('POST /medicines - RBAC & Creation', () => {
    it('allows PHARMACIST to create medicine', async () => {
      medicineService.createMedicine.mockResolvedValue(mockMedicine);
      const token = generateToken({
        userId: 'u-pharm',
        email: 'pharm@apollo.com',
        roleId: 'r-pharm',
        role: 'PHARMACIST',
        hospitalId: hospitalAId,
      });

      const res = await request(app.getHttpServer())
        .post('/medicines')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Amoxicillin',
          form: 'CAPSULE',
          description: 'Antibiotic',
          reorderLevel: 15,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Amoxicillin');
    });

    it('allows HOSPITAL_ADMIN to create medicine', async () => {
      medicineService.createMedicine.mockResolvedValue(mockMedicine);
      const token = generateToken({
        userId: 'u-admin',
        email: 'admin@apollo.com',
        roleId: 'r-admin',
        role: 'HOSPITAL_ADMIN',
        hospitalId: hospitalAId,
      });

      await request(app.getHttpServer())
        .post('/medicines')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Amoxicillin',
          form: 'CAPSULE',
        })
        .expect(201);
    });

    it('blocks DOCTOR from creating medicine (403)', async () => {
      const token = generateToken({
        userId: 'u-doc',
        email: 'doc@apollo.com',
        roleId: 'r-doc',
        role: 'DOCTOR',
        hospitalId: hospitalAId,
      });

      await request(app.getHttpServer())
        .post('/medicines')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Amoxicillin',
          form: 'CAPSULE',
        })
        .expect(403);
    });

    it('blocks PATIENT from creating medicine (403)', async () => {
      const token = generateToken({
        userId: 'u-pat',
        email: 'pat@apollo.com',
        roleId: 'r-pat',
        role: 'PATIENT',
        hospitalId: hospitalAId,
      });

      await request(app.getHttpServer())
        .post('/medicines')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Amoxicillin',
          form: 'CAPSULE',
        })
        .expect(403);
    });

    it('blocks RECEPTIONIST from creating medicine (403)', async () => {
      const token = generateToken({
        userId: 'u-rec',
        email: 'rec@apollo.com',
        roleId: 'r-rec',
        role: 'RECEPTIONIST',
        hospitalId: hospitalAId,
      });

      await request(app.getHttpServer())
        .post('/medicines')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Amoxicillin',
          form: 'CAPSULE',
        })
        .expect(403);
    });

    it('rejects payload with missing name (400)', async () => {
      const token = generateToken({
        userId: 'u-pharm',
        email: 'pharm@apollo.com',
        roleId: 'r-pharm',
        role: 'PHARMACIST',
        hospitalId: hospitalAId,
      });

      await request(app.getHttpServer())
        .post('/medicines')
        .set('Authorization', `Bearer ${token}`)
        .send({
          form: 'CAPSULE',
        })
        .expect(400);
    });
  });

  describe('GET /medicines - Tenancy & Queries', () => {
    it('allows DOCTOR to view medicine list for prescribing', async () => {
      medicineService.getMedicines.mockResolvedValue([mockMedicine]);
      const token = generateToken({
        userId: 'u-doc',
        email: 'doc@apollo.com',
        roleId: 'r-doc',
        role: 'DOCTOR',
        hospitalId: hospitalAId,
      });

      const res = await request(app.getHttpServer())
        .get('/medicines')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    it('blocks PATIENT from viewing medicine catalog (403)', async () => {
      const token = generateToken({
        userId: 'u-pat',
        email: 'pat@apollo.com',
        roleId: 'r-pat',
        role: 'PATIENT',
        hospitalId: hospitalAId,
      });

      await request(app.getHttpServer())
        .get('/medicines')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  describe('GET /medicines/:id', () => {
    it('returns medicine by id for hospital staff', async () => {
      medicineService.getMedicineById.mockResolvedValue(mockMedicine);
      const token = generateToken({
        userId: 'u-pharm',
        email: 'pharm@apollo.com',
        roleId: 'r-pharm',
        role: 'PHARMACIST',
        hospitalId: hospitalAId,
      });

      const res = await request(app.getHttpServer())
        .get(`/medicines/${validMedId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.id).toBe(validMedId);
    });

    it('returns 403 when user belongs to different hospital', async () => {
      medicineService.getMedicineById.mockRejectedValue(
        new ForbiddenException('Access denied: Medicine belongs to another hospital'),
      );
      const token = generateToken({
        userId: 'u-pharm-b',
        email: 'pharm@fortis.com',
        roleId: 'r-pharm',
        role: 'PHARMACIST',
        hospitalId: hospitalBId,
      });

      await request(app.getHttpServer())
        .get(`/medicines/${validMedId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  describe('POST /medicines/:id/batches - Batch Management', () => {
    it('allows PHARMACIST to add medicine batch', async () => {
      medicineService.createBatch.mockResolvedValue({
        id: 'batch-1',
        batchNumber: 'B-001',
        quantity: 100,
      });
      const token = generateToken({
        userId: 'u-pharm',
        email: 'pharm@apollo.com',
        roleId: 'r-pharm',
        role: 'PHARMACIST',
        hospitalId: hospitalAId,
      });

      const res = await request(app.getHttpServer())
        .post(`/medicines/${validMedId}/batches`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          batchNumber: 'B-001',
          expiryDate: '2027-01-01T00:00:00.000Z',
          quantity: 100,
          unitCost: 1.5,
          mrp: 3.0,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.batchNumber).toBe('B-001');
    });

    it('blocks DOCTOR from adding batches (403)', async () => {
      const token = generateToken({
        userId: 'u-doc',
        email: 'doc@apollo.com',
        roleId: 'r-doc',
        role: 'DOCTOR',
        hospitalId: hospitalAId,
      });

      await request(app.getHttpServer())
        .post(`/medicines/${validMedId}/batches`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          batchNumber: 'B-001',
          expiryDate: '2027-01-01T00:00:00.000Z',
          quantity: 100,
          unitCost: 1.5,
          mrp: 3.0,
        })
        .expect(403);
    });
  });
});
