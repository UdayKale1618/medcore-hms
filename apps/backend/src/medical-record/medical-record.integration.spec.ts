import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { MedicalRecordController } from './medical-record.controller';
import { MedicalRecordService } from './medical-record.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

describe('MedicalRecordModule Integration & RBAC Tests (Day 10)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let medicalRecordService: {
    createMedicalRecord: jest.Mock;
    getMedicalRecords: jest.Mock;
    getMedicalRecordById: jest.Mock;
    getMedicalRecordByAppointmentId: jest.Mock;
    updateMedicalRecord: jest.Mock;
  };

  const JWT_SECRET = 'test-jwt-secret-key-12345678901234567890';
  process.env.JWT_ACCESS_SECRET = JWT_SECRET;

  const validRecordId = 'c19c8d0e-1111-4c5e-855c-097587ef75dc';
  const validAppointmentId = 'b29c8d0e-4444-4c5e-855c-097587ef75dc';
  const validDoctorId = 'd39c8d0e-1111-4c5e-855c-097587ef75dc';
  const validPatientId = 'a49c8d0e-2222-4c5e-855c-097587ef75dc';
  const hospitalAId = 'hosp-aaa-111';
  const hospitalBId = 'hosp-bbb-222';

  const mockSafeRecord = {
    id: validRecordId,
    appointmentId: validAppointmentId,
    patientId: validPatientId,
    doctorId: validDoctorId,
    chiefComplaint: 'Headache and dizziness',
    symptoms: 'Throbbing frontal headache for 3 days',
    diagnosis: 'Tension Headache',
    treatmentPlan: 'Hydration, rest, paracetamol 500mg SOS',
    bloodPressure: '120/80',
    pulse: 74,
    temperature: 36.8,
    spo2: 99,
    height: 172,
    weight: 68,
    bmi: 22.99,
    notes: 'No signs of neurological deficits',
    doctor: {
      id: validDoctorId,
      specialization: 'General Medicine',
      user: {
        id: 'user-doc-1',
        name: 'Dr. Gregory House',
        email: 'house@apollo.com',
        phone: '+1 555-0199',
        hospitalId: hospitalAId,
      },
    },
    patient: {
      id: validPatientId,
      dateOfBirth: '1995-05-15T00:00:00.000Z',
      gender: 'FEMALE',
      bloodGroup: 'B+',
      user: {
        id: 'user-pat-1',
        name: 'Alice Smith',
        email: 'alice@example.com',
        phone: '+1 555-0100',
        hospitalId: hospitalAId,
      },
    },
    appointment: {
      id: validAppointmentId,
      appointmentDate: '2026-10-15T00:00:00.000Z',
      status: 'IN_PROGRESS',
    },
  };

  beforeAll(async () => {
    medicalRecordService = {
      createMedicalRecord: jest.fn(),
      getMedicalRecords: jest.fn(),
      getMedicalRecordById: jest.fn(),
      getMedicalRecordByAppointmentId: jest.fn(),
      updateMedicalRecord: jest.fn(),
    };

    jwtService = new JwtService({ secret: JWT_SECRET });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [MedicalRecordController],
      providers: [
        {
          provide: MedicalRecordService,
          useValue: medicalRecordService,
        },
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
        JwtAuthGuard,
        RolesGuard,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
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

  const generateToken = (user: {
    sub: string;
    email: string;
    role: string;
    hospitalId?: string | null;
  }) => {
    return jwtService.sign({
      sub: user.sub,
      email: user.email,
      role: user.role,
      roleId: 'role-1',
      hospitalId: user.hospitalId !== undefined ? user.hospitalId : hospitalAId,
    });
  };

  // =========================================================
  // AUTHENTICATION
  // =========================================================
  describe('Authentication Guard', () => {
    it('should reject unauthenticated requests with 401', async () => {
      const res = await request(app.getHttpServer()).get('/medical-records');
      expect(res.status).toBe(401);
    });
  });

  // =========================================================
  // CREATION & RBAC (POST /medical-records)
  // =========================================================
  describe('POST /medical-records', () => {
    it('1. should allow DOCTOR to create a medical record (201)', async () => {
      medicalRecordService.createMedicalRecord.mockResolvedValue(mockSafeRecord);

      const token = generateToken({
        sub: 'user-doc-1',
        email: 'doc@apollo.com',
        role: 'DOCTOR',
      });

      const res = await request(app.getHttpServer())
        .post('/medical-records')
        .set('Authorization', `Bearer ${token}`)
        .send({
          appointmentId: validAppointmentId,
          chiefComplaint: 'Headache',
          diagnosis: 'Tension Headache',
          height: 172,
          weight: 68,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(validRecordId);
    });

    it('8. should reject PATIENT, RECEPTIONIST, NURSE, ACCOUNTANT from creating medical records (403)', async () => {
      for (const role of ['PATIENT', 'RECEPTIONIST', 'NURSE', 'ACCOUNTANT']) {
        const token = generateToken({
          sub: 'user-1',
          email: 'user@apollo.com',
          role,
        });

        const res = await request(app.getHttpServer())
          .post('/medical-records')
          .set('Authorization', `Bearer ${token}`)
          .send({
            appointmentId: validAppointmentId,
            diagnosis: 'Test',
          });

        expect(res.status).toBe(403);
      }
    });

    it('should reject invalid UUID with 400 Bad Request', async () => {
      const token = generateToken({
        sub: 'user-doc-1',
        email: 'doc@apollo.com',
        role: 'DOCTOR',
      });

      const res = await request(app.getHttpServer())
        .post('/medical-records')
        .set('Authorization', `Bearer ${token}`)
        .send({
          appointmentId: 'not-a-uuid',
          diagnosis: 'Test',
        });

      expect(res.status).toBe(400);
    });

    it('should return 409 Conflict if record already exists for appointment', async () => {
      medicalRecordService.createMedicalRecord.mockRejectedValue(
        new ConflictException(
          'A medical record already exists for this appointment',
        ),
      );

      const token = generateToken({
        sub: 'user-doc-1',
        email: 'doc@apollo.com',
        role: 'DOCTOR',
      });

      const res = await request(app.getHttpServer())
        .post('/medical-records')
        .set('Authorization', `Bearer ${token}`)
        .send({
          appointmentId: validAppointmentId,
          diagnosis: 'Test',
        });

      expect(res.status).toBe(409);
    });
  });

  // =========================================================
  // RETRIEVAL & ISOLATION (GET /medical-records)
  // =========================================================
  describe('GET /medical-records & /medical-records/:id', () => {
    it('9. should retrieve a record by ID for DOCTOR', async () => {
      medicalRecordService.getMedicalRecordById.mockResolvedValue(
        mockSafeRecord,
      );

      const token = generateToken({
        sub: 'user-doc-1',
        email: 'doc@apollo.com',
        role: 'DOCTOR',
      });

      const res = await request(app.getHttpServer())
        .get(`/medical-records/${validRecordId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(validRecordId);
    });

    it('10. should allow NURSE to view records in their hospital', async () => {
      medicalRecordService.getMedicalRecords.mockResolvedValue([
        mockSafeRecord,
      ]);

      const token = generateToken({
        sub: 'nurse-1',
        email: 'nurse@apollo.com',
        role: 'NURSE',
      });

      const res = await request(app.getHttpServer())
        .get('/medical-records')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('11. should allow PATIENT to view their own record', async () => {
      medicalRecordService.getMedicalRecordById.mockResolvedValue(
        mockSafeRecord,
      );

      const token = generateToken({
        sub: 'user-pat-1',
        email: 'alice@example.com',
        role: 'PATIENT',
      });

      const res = await request(app.getHttpServer())
        .get(`/medical-records/${validRecordId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(validRecordId);
    });

    it('22. Patient Isolation: Patient cannot view another patient record (403)', async () => {
      medicalRecordService.getMedicalRecordById.mockRejectedValue(
        new ForbiddenException(
          'Access denied: You can only access your own medical records',
        ),
      );

      const tokenOtherPatient = generateToken({
        sub: 'other-pat-user',
        email: 'other@example.com',
        role: 'PATIENT',
      });

      const res = await request(app.getHttpServer())
        .get(`/medical-records/${validRecordId}`)
        .set('Authorization', `Bearer ${tokenOtherPatient}`);

      expect(res.status).toBe(403);
    });

    it('13 & 21. Hospital Isolation: Hospital A user cannot view Hospital B record (403)', async () => {
      medicalRecordService.getMedicalRecordById.mockRejectedValue(
        new ForbiddenException(
          'Access denied: Medical record belongs to another hospital',
        ),
      );

      const tokenHospitalB = generateToken({
        sub: 'doc-b',
        email: 'doc@hospital-b.com',
        role: 'DOCTOR',
        hospitalId: hospitalBId,
      });

      const res = await request(app.getHttpServer())
        .get(`/medical-records/${validRecordId}`)
        .set('Authorization', `Bearer ${tokenHospitalB}`);

      expect(res.status).toBe(403);
    });

    it('should reject RECEPTIONIST and ACCOUNTANT from viewing medical records (403)', async () => {
      for (const role of ['RECEPTIONIST', 'ACCOUNTANT']) {
        const token = generateToken({
          sub: 'staff-1',
          email: 'staff@apollo.com',
          role,
        });

        const res = await request(app.getHttpServer())
          .get('/medical-records')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(403);
      }
    });
  });

  // =========================================================
  // UPDATE (PATCH /medical-records/:id)
  // =========================================================
  describe('PATCH /medical-records/:id', () => {
    it('15. should allow treating DOCTOR to update medical record', async () => {
      medicalRecordService.updateMedicalRecord.mockResolvedValue({
        ...mockSafeRecord,
        notes: 'Updated progress notes',
      });

      const token = generateToken({
        sub: 'user-doc-1',
        email: 'doc@apollo.com',
        role: 'DOCTOR',
      });

      const res = await request(app.getHttpServer())
        .patch(`/medical-records/${validRecordId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ notes: 'Updated progress notes' });

      expect(res.status).toBe(200);
      expect(res.body.data.notes).toBe('Updated progress notes');
    });

    it('17. should reject PATIENT from updating medical record (403)', async () => {
      const token = generateToken({
        sub: 'user-pat-1',
        email: 'alice@example.com',
        role: 'PATIENT',
      });

      const res = await request(app.getHttpServer())
        .patch(`/medical-records/${validRecordId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ notes: 'Patient modification' });

      expect(res.status).toBe(403);
    });
  });

  // =========================================================
  // 18-19. DELETION POLICY (NO PERMANENT DELETE)
  // =========================================================
  describe('Deletion Protection', () => {
    it('18 & 19. verify DELETE /medical-records/:id does not exist (returns 404)', async () => {
      const tokenAdmin = generateToken({
        sub: 'admin-1',
        email: 'admin@apollo.com',
        role: 'HOSPITAL_ADMIN',
      });

      const res = await request(app.getHttpServer())
        .delete(`/medical-records/${validRecordId}`)
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(404);
    });
  });

  // =========================================================
  // 20. SENSITIVE DATA EXPOSURE
  // =========================================================
  describe('Response Safety', () => {
    it('20. should not expose password, passwordHash, or tokens in medical record response', async () => {
      medicalRecordService.getMedicalRecordById.mockResolvedValue(
        mockSafeRecord,
      );

      const token = generateToken({
        sub: 'user-doc-1',
        email: 'doc@apollo.com',
        role: 'DOCTOR',
      });

      const res = await request(app.getHttpServer())
        .get(`/medical-records/${validRecordId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.doctor.user.password).toBeUndefined();
      expect(res.body.data.doctor.user.passwordHash).toBeUndefined();
      expect(res.body.data.patient.user.password).toBeUndefined();
      expect(res.body.data.patient.user.passwordHash).toBeUndefined();
    });
  });
});
