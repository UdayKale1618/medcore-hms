import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { PharmacyController } from './pharmacy.controller';
import { PharmacyService } from './pharmacy.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

describe('Pharmacy Module Integration & RBAC Tests', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let pharmacyService: {
    getInventory: jest.Mock;
    getMedicineInventory: jest.Mock;
    getBatches: jest.Mock;
    getBatchById: jest.Mock;
    getPrescriptions: jest.Mock;
    getPrescriptionById: jest.Mock;
    dispense: jest.Mock;
    updatePrescriptionStatus: jest.Mock;
  };

  const JWT_SECRET = 'test-jwt-secret-key-12345678901234567890';
  process.env.JWT_ACCESS_SECRET = JWT_SECRET;

  const hospitalAId = 'hosp-aaa-111';

  beforeAll(async () => {
    pharmacyService = {
      getInventory: jest.fn(),
      getMedicineInventory: jest.fn(),
      getBatches: jest.fn(),
      getBatchById: jest.fn(),
      getPrescriptions: jest.fn(),
      getPrescriptionById: jest.fn(),
      dispense: jest.fn(),
      updatePrescriptionStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PharmacyController],
      providers: [
        { provide: PharmacyService, useValue: pharmacyService },
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

  describe('GET /pharmacy/inventory', () => {
    it('allows Pharmacist and Hospital Admin to view inventory', async () => {
      pharmacyService.getInventory.mockResolvedValue([
        { id: 'med-1', name: 'Paracetamol', availableStock: 100 },
      ]);

      const token = createToken('PHARMACIST');
      const res = await request(app.getHttpServer())
        .get('/pharmacy/inventory')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Paracetamol');
    });

    it('denies Accountant from viewing pharmacy inventory', async () => {
      const token = createToken('ACCOUNTANT');
      await request(app.getHttpServer())
        .get('/pharmacy/inventory')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  describe('POST /pharmacy/dispense', () => {
    const validPrescriptionId = '8151240c-1111-4444-9999-000000000001';
    const validItemId = '8151240c-2222-4444-9999-000000000002';
    const validBatchId = '8151240c-3333-4444-9999-000000000003';

    it('allows Pharmacist to dispense medication', async () => {
      pharmacyService.dispense.mockResolvedValue({
        message: 'Medicines dispensed successfully',
        status: 'FULFILLED',
      });

      const token = createToken('PHARMACIST');
      const res = await request(app.getHttpServer())
        .post('/pharmacy/dispense')
        .set('Authorization', `Bearer ${token}`)
        .send({
          prescriptionId: validPrescriptionId,
          items: [
            {
              prescriptionItemId: validItemId,
              batchId: validBatchId,
              quantity: 10,
            },
          ],
        })
        .expect(201);

      expect(res.body.status).toBe('FULFILLED');
    });

    it('rejects dispensing by Doctors with 403 Forbidden', async () => {
      const token = createToken('DOCTOR');
      await request(app.getHttpServer())
        .post('/pharmacy/dispense')
        .set('Authorization', `Bearer ${token}`)
        .send({
          prescriptionId: validPrescriptionId,
          items: [
            {
              prescriptionItemId: validItemId,
              batchId: validBatchId,
              quantity: 10,
            },
          ],
        })
        .expect(403);
    });

    it('returns 400 Bad Request when dispensing an expired batch', async () => {
      pharmacyService.dispense.mockRejectedValue(
        new BadRequestException('An expired medicine cannot be dispensed'),
      );

      const token = createToken('PHARMACIST');
      const res = await request(app.getHttpServer())
        .post('/pharmacy/dispense')
        .set('Authorization', `Bearer ${token}`)
        .send({
          prescriptionId: validPrescriptionId,
          items: [
            {
              prescriptionItemId: validItemId,
              batchId: validBatchId,
              quantity: 10,
            },
          ],
        })
        .expect(400);

      expect(res.body.message).toContain('expired');
    });
  });
});
