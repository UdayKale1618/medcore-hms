import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { PrescriptionController } from './prescription.controller';
import { PrescriptionService } from './prescription.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

describe('PrescriptionModule Integration & RBAC Tests (Day 11)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let prescriptionService: {
    createPrescription: jest.Mock;
    getPrescriptions: jest.Mock;
    getPrescriptionById: jest.Mock;
    getPrescriptionsByMedicalRecordId: jest.Mock;
    getMyPrescriptions: jest.Mock;
    updatePrescription: jest.Mock;
  };

  const JWT_SECRET = 'test-jwt-secret-key-12345678901234567890';
  process.env.JWT_ACCESS_SECRET = JWT_SECRET;

  const validRecordId = 'c19c8d0e-1111-4c5e-855c-097587ef75dc';
  const validPrescriptionId = 'e29c8d0e-2222-4c5e-855c-097587ef75dc';
  const validMedicineId = 'f39c8d0e-3333-4c5e-855c-097587ef75dc';
  const hospitalAId = 'hosp-aaa-111';
  const hospitalBId = 'hosp-bbb-222';

  const mockPrescription = {
    id: validPrescriptionId,
    medicalRecordId: validRecordId,
    digitalSignature: 'SIG-DOC-HOUSE-2026',
    issuedAt: new Date().toISOString(),
    medicalRecord: {
      id: validRecordId,
      diagnosis: 'Bacterial Pharyngitis',
      patient: {
        id: 'pat-1',
        hospitalId: hospitalAId,
        user: {
          id: 'user-pat-1',
          name: 'Jane Doe',
          email: 'jane@patient.com',
          phone: '+1 555-0101',
          hospitalId: hospitalAId,
        },
      },
      doctor: {
        id: 'doc-1',
        specialization: 'Internal Medicine',
        user: {
          id: 'user-doc-1',
          name: 'Dr. Gregory House',
          email: 'house@apollo.com',
          phone: '+1 555-0199',
          hospitalId: hospitalAId,
        },
        department: {
          id: 'dept-1',
          name: 'Internal Medicine',
          hospitalId: hospitalAId,
        },
      },
    },
    items: [
      {
        id: 'item-1',
        prescriptionId: validPrescriptionId,
        medicineId: validMedicineId,
        dosage: '500mg',
        frequency: 'TID',
        durationDays: 7,
        specialInstructions: 'Take after meals',
        medicine: {
          id: validMedicineId,
          hospitalId: hospitalAId,
          name: 'Amoxicillin',
          form: 'CAPSULE',
        },
      },
    ],
  };

  beforeAll(async () => {
    jwtService = new JwtService({ secret: JWT_SECRET });

    prescriptionService = {
      createPrescription: jest.fn(),
      getPrescriptions: jest.fn(),
      getPrescriptionById: jest.fn(),
      getPrescriptionsByMedicalRecordId: jest.fn(),
      getMyPrescriptions: jest.fn(),
      updatePrescription: jest.fn(),
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
      controllers: [PrescriptionController],
      providers: [
        { provide: PrescriptionService, useValue: prescriptionService },
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

  describe('POST /prescriptions - RBAC & Creation', () => {
    it('allows DOCTOR to create prescription', async () => {
      prescriptionService.createPrescription.mockResolvedValue(mockPrescription);
      const token = generateToken({
        userId: 'user-doc-1',
        email: 'house@apollo.com',
        roleId: 'role-doc',
        role: 'DOCTOR',
        hospitalId: hospitalAId,
      });

      const res = await request(app.getHttpServer())
        .post('/prescriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          medicalRecordId: validRecordId,
          digitalSignature: 'SIG-DOC-HOUSE-2026',
          items: [
            {
              medicineId: validMedicineId,
              dosage: '500mg',
              frequency: 'TID',
              durationDays: 7,
              specialInstructions: 'Take after meals',
            },
          ],
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(validPrescriptionId);
      expect(res.body.data.items).toHaveLength(1);
    });

    it('blocks PATIENT from creating prescription (403)', async () => {
      const token = generateToken({
        userId: 'user-pat-1',
        email: 'pat@apollo.com',
        roleId: 'role-pat',
        role: 'PATIENT',
        hospitalId: hospitalAId,
      });

      await request(app.getHttpServer())
        .post('/prescriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          medicalRecordId: validRecordId,
          items: [
            {
              medicineId: validMedicineId,
              dosage: '500mg',
              frequency: 'TID',
              durationDays: 7,
            },
          ],
        })
        .expect(403);
    });

    it('blocks RECEPTIONIST from creating prescription (403)', async () => {
      const token = generateToken({
        userId: 'user-rec-1',
        email: 'rec@apollo.com',
        roleId: 'role-rec',
        role: 'RECEPTIONIST',
        hospitalId: hospitalAId,
      });

      await request(app.getHttpServer())
        .post('/prescriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          medicalRecordId: validRecordId,
          items: [
            {
              medicineId: validMedicineId,
              dosage: '500mg',
              frequency: 'TID',
              durationDays: 7,
            },
          ],
        })
        .expect(403);
    });

    it('blocks NURSE from creating prescription (403)', async () => {
      const token = generateToken({
        userId: 'user-nur-1',
        email: 'nurse@apollo.com',
        roleId: 'role-nur',
        role: 'NURSE',
        hospitalId: hospitalAId,
      });

      await request(app.getHttpServer())
        .post('/prescriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          medicalRecordId: validRecordId,
          items: [
            {
              medicineId: validMedicineId,
              dosage: '500mg',
              frequency: 'TID',
              durationDays: 7,
            },
          ],
        })
        .expect(403);
    });

    it('blocks PHARMACIST from creating prescription (403)', async () => {
      const token = generateToken({
        userId: 'user-ph-1',
        email: 'pharm@apollo.com',
        roleId: 'role-ph',
        role: 'PHARMACIST',
        hospitalId: hospitalAId,
      });

      await request(app.getHttpServer())
        .post('/prescriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          medicalRecordId: validRecordId,
          items: [
            {
              medicineId: validMedicineId,
              dosage: '500mg',
              frequency: 'TID',
              durationDays: 7,
            },
          ],
        })
        .expect(403);
    });

    it('rejects empty items array (400)', async () => {
      const token = generateToken({
        userId: 'user-doc-1',
        email: 'house@apollo.com',
        roleId: 'role-doc',
        role: 'DOCTOR',
        hospitalId: hospitalAId,
      });

      await request(app.getHttpServer())
        .post('/prescriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          medicalRecordId: validRecordId,
          items: [],
        })
        .expect(400);
    });

    it('rejects invalid UUID in items (400)', async () => {
      const token = generateToken({
        userId: 'user-doc-1',
        email: 'house@apollo.com',
        roleId: 'role-doc',
        role: 'DOCTOR',
        hospitalId: hospitalAId,
      });

      await request(app.getHttpServer())
        .post('/prescriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          medicalRecordId: validRecordId,
          items: [
            {
              medicineId: 'not-a-uuid',
              dosage: '500mg',
              frequency: 'TID',
              durationDays: 7,
            },
          ],
        })
        .expect(400);
    });

    it('rejects expired medicine batch with 400 Bad Request', async () => {
      prescriptionService.createPrescription.mockRejectedValue(
        new BadRequestException('Medicine "Amoxicillin" has no valid non-expired stock available'),
      );

      const token = generateToken({
        userId: 'user-doc-1',
        email: 'house@apollo.com',
        roleId: 'role-doc',
        role: 'DOCTOR',
        hospitalId: hospitalAId,
      });

      const res = await request(app.getHttpServer())
        .post('/prescriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          medicalRecordId: validRecordId,
          items: [
            {
              medicineId: validMedicineId,
              dosage: '500mg',
              frequency: 'TID',
              durationDays: 7,
            },
          ],
        })
        .expect(400);

      expect(res.body.message).toContain('no valid non-expired stock');
    });
  });

  describe('GET /prescriptions/me - Patient Direct Access', () => {
    it('allows PATIENT to view their own prescriptions', async () => {
      prescriptionService.getMyPrescriptions.mockResolvedValue([mockPrescription]);
      const token = generateToken({
        userId: 'user-pat-1',
        email: 'pat@apollo.com',
        roleId: 'role-pat',
        role: 'PATIENT',
        hospitalId: hospitalAId,
      });

      const res = await request(app.getHttpServer())
        .get('/prescriptions/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    it('blocks DOCTOR from calling /prescriptions/me (403)', async () => {
      const token = generateToken({
        userId: 'user-doc-1',
        email: 'doc@apollo.com',
        roleId: 'role-doc',
        role: 'DOCTOR',
        hospitalId: hospitalAId,
      });

      await request(app.getHttpServer())
        .get('/prescriptions/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  describe('GET /prescriptions/:id - Tenancy & Isolation', () => {
    it('allows doctor to get prescription by id', async () => {
      prescriptionService.getPrescriptionById.mockResolvedValue(mockPrescription);
      const token = generateToken({
        userId: 'user-doc-1',
        email: 'doc@apollo.com',
        roleId: 'role-doc',
        role: 'DOCTOR',
        hospitalId: hospitalAId,
      });

      const res = await request(app.getHttpServer())
        .get(`/prescriptions/${validPrescriptionId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.id).toBe(validPrescriptionId);
    });

    it('returns 403 when patient tries to view another patient prescription', async () => {
      prescriptionService.getPrescriptionById.mockRejectedValue(
        new ForbiddenException('Access denied: You can only view your own prescriptions'),
      );
      const token = generateToken({
        userId: 'user-pat-2',
        email: 'other@apollo.com',
        roleId: 'role-pat',
        role: 'PATIENT',
        hospitalId: hospitalAId,
      });

      await request(app.getHttpServer())
        .get(`/prescriptions/${validPrescriptionId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('returns 403 when caller is from a different hospital', async () => {
      prescriptionService.getPrescriptionById.mockRejectedValue(
        new ForbiddenException('Access denied: Prescription belongs to another hospital'),
      );
      const token = generateToken({
        userId: 'user-doc-2',
        email: 'doc@fortis.com',
        roleId: 'role-doc',
        role: 'DOCTOR',
        hospitalId: hospitalBId,
      });

      await request(app.getHttpServer())
        .get(`/prescriptions/${validPrescriptionId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  describe('PATCH /prescriptions/:id - Prescription Signing & Updates', () => {
    it('allows prescribing doctor to update digital signature', async () => {
      prescriptionService.updatePrescription.mockResolvedValue({
        ...mockPrescription,
        digitalSignature: 'SIG-NEW-DIGITAL-SIGNATURE',
      });
      const token = generateToken({
        userId: 'user-doc-1',
        email: 'house@apollo.com',
        roleId: 'role-doc',
        role: 'DOCTOR',
        hospitalId: hospitalAId,
      });

      const res = await request(app.getHttpServer())
        .patch(`/prescriptions/${validPrescriptionId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ digitalSignature: 'SIG-NEW-DIGITAL-SIGNATURE' })
        .expect(200);

      expect(res.body.data.digitalSignature).toBe('SIG-NEW-DIGITAL-SIGNATURE');
    });

    it('blocks PATIENT from updating prescription (403)', async () => {
      const token = generateToken({
        userId: 'user-pat-1',
        email: 'pat@apollo.com',
        roleId: 'role-pat',
        role: 'PATIENT',
        hospitalId: hospitalAId,
      });

      await request(app.getHttpServer())
        .patch(`/prescriptions/${validPrescriptionId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ digitalSignature: 'TAMPERED-SIGNATURE' })
        .expect(403);
    });

    it('returns 403 when non-prescribing doctor attempts to update', async () => {
      prescriptionService.updatePrescription.mockRejectedValue(
        new ForbiddenException('Only the prescribing doctor can update this prescription'),
      );
      const token = generateToken({
        userId: 'user-doc-unassigned',
        email: 'wilson@apollo.com',
        roleId: 'role-doc',
        role: 'DOCTOR',
        hospitalId: hospitalAId,
      });

      await request(app.getHttpServer())
        .patch(`/prescriptions/${validPrescriptionId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ digitalSignature: 'SIG-WILSON' })
        .expect(403);
    });
  });

  describe('Permanent Deletion Protection', () => {
    it('does NOT provide a DELETE endpoint for prescriptions (404/Method Not Allowed)', async () => {
      const token = generateToken({
        userId: 'user-doc-1',
        email: 'house@apollo.com',
        roleId: 'role-doc',
        role: 'DOCTOR',
        hospitalId: hospitalAId,
      });

      // No DELETE route should exist on prescriptions controller
      await request(app.getHttpServer())
        .delete(`/prescriptions/${validPrescriptionId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('Response Safety', () => {
    it('ensures no password or secret fields are leaked in responses', async () => {
      prescriptionService.getPrescriptionById.mockResolvedValue(mockPrescription);
      const token = generateToken({
        userId: 'user-doc-1',
        email: 'house@apollo.com',
        roleId: 'role-doc',
        role: 'DOCTOR',
        hospitalId: hospitalAId,
      });

      const res = await request(app.getHttpServer())
        .get(`/prescriptions/${validPrescriptionId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const jsonString = JSON.stringify(res.body);
      expect(jsonString).not.toContain('password');
      expect(jsonString).not.toContain('passwordHash');
      expect(jsonString).not.toContain('jwtSecret');
    });
  });
});
