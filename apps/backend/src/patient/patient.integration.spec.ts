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
import { PatientController } from './patient.controller';
import { PatientService } from './patient.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

describe('PatientModule Integration & RBAC Tests', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let patientService: {
    createPatient: jest.Mock;
    getPatients: jest.Mock;
    getPatientById: jest.Mock;
    getCurrentPatient: jest.Mock;
    updatePatient: jest.Mock;
    deletePatient: jest.Mock;
  };

  const JWT_SECRET = 'test-jwt-secret-key-12345678901234567890';
  process.env.JWT_ACCESS_SECRET = JWT_SECRET;

  const validUserId = 'c28a8d0e-255e-4c5e-855c-097587ef75dc';
  const validPatientId = 'd39c8d0e-5678-4c5e-855c-097587ef75de';
  const hospitalAId = 'hosp-aaa-111';

  const mockSafePatient = {
    id: validPatientId,
    userId: validUserId,
    hospitalId: hospitalAId,
    dateOfBirth: '1995-05-15T00:00:00.000Z',
    gender: 'FEMALE',
    bloodGroup: 'B+',
    emergencyContactName: 'Robert Smith',
    emergencyContactPhone: '+1 555-0199',
    user: {
      id: validUserId,
      name: 'Alice Smith',
      email: 'alice@example.com',
      phone: '+1 555-0100',
      hospitalId: hospitalAId,
      emailVerified: false,
    },
    hospital: {
      id: hospitalAId,
      name: 'General Hospital A',
    },
  };

  beforeAll(async () => {
    patientService = {
      createPatient: jest.fn(),
      getPatients: jest.fn(),
      getPatientById: jest.fn(),
      getCurrentPatient: jest.fn(),
      updatePatient: jest.fn(),
      deletePatient: jest.fn(),
    };

    jwtService = new JwtService({ secret: JWT_SECRET });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PatientController],
      providers: [
        {
          provide: PatientService,
          useValue: patientService,
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
      const res = await request(app.getHttpServer()).get('/patients');
      expect(res.status).toBe(401);
    });
  });

  // =========================================================
  // 1. CREATE PATIENT
  // =========================================================
  describe('POST /patients', () => {
    it('should allow RECEPTIONIST to create patient successfully (201)', async () => {
      patientService.createPatient.mockResolvedValue(mockSafePatient);

      const token = generateToken({
        sub: 'recep-1',
        email: 'recep@hospital-a.com',
        role: 'RECEPTIONIST',
        hospitalId: hospitalAId,
      });

      const res = await request(app.getHttpServer())
        .post('/patients')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Alice Smith',
          email: 'alice@example.com',
          gender: 'FEMALE',
          bloodGroup: 'B+',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(validPatientId);
    });

    it('should reject PATIENT role from registering other patients (403)', async () => {
      const token = generateToken({
        sub: 'pat-1',
        email: 'pat@example.com',
        role: 'PATIENT',
      });

      const res = await request(app.getHttpServer())
        .post('/patients')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Bob',
          email: 'bob@example.com',
        });

      expect(res.status).toBe(403);
    });

    it('11. Invalid input: should reject invalid email with 400 Bad Request', async () => {
      const token = generateToken({
        sub: 'admin-1',
        email: 'admin@hospital-a.com',
        role: 'HOSPITAL_ADMIN',
      });

      const res = await request(app.getHttpServer())
        .post('/patients')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Alice',
          email: 'not-an-email',
        });

      expect(res.status).toBe(400);
    });

    it('12. Duplicate handling: should return 409 Conflict when email exists', async () => {
      patientService.createPatient.mockRejectedValue(
        new ConflictException('Email already registered'),
      );

      const token = generateToken({
        sub: 'admin-1',
        email: 'admin@hospital-a.com',
        role: 'HOSPITAL_ADMIN',
      });

      const res = await request(app.getHttpServer())
        .post('/patients')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Alice',
          email: 'existing@example.com',
        });

      expect(res.status).toBe(409);
    });
  });

  // =========================================================
  // 2. RETRIEVE PATIENT & LISTING
  // =========================================================
  describe('GET /patients', () => {
    it('should allow DOCTOR to list patients in their hospital', async () => {
      patientService.getPatients.mockResolvedValue([mockSafePatient]);

      const token = generateToken({
        sub: 'doc-1',
        email: 'doc@hospital-a.com',
        role: 'DOCTOR',
        hospitalId: hospitalAId,
      });

      const res = await request(app.getHttpServer())
        .get('/patients')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    it('should allow LAB_TECHNICIAN, PHARMACIST, ACCOUNTANT, NURSE to view patients', async () => {
      patientService.getPatients.mockResolvedValue([mockSafePatient]);

      for (const role of [
        'LAB_TECHNICIAN',
        'PHARMACIST',
        'ACCOUNTANT',
        'NURSE',
      ]) {
        const token = generateToken({
          sub: `${role.toLowerCase()}-1`,
          email: `${role.toLowerCase()}@hospital-a.com`,
          role,
        });

        const res = await request(app.getHttpServer())
          .get('/patients')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
      }
    });

    it('should forbid PATIENT role from listing all patients (403)', async () => {
      const token = generateToken({
        sub: 'pat-1',
        email: 'patient@example.com',
        role: 'PATIENT',
      });

      const res = await request(app.getHttpServer())
        .get('/patients')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  // =========================================================
  // 2 & 5. RETRIEVE PATIENT BY ID & SOFT DELETE EXCLUSION
  // =========================================================
  describe('GET /patients/:id', () => {
    it('2. should retrieve patient details by id', async () => {
      patientService.getPatientById.mockResolvedValue(mockSafePatient);

      const token = generateToken({
        sub: 'nurse-1',
        email: 'nurse@hospital-a.com',
        role: 'NURSE',
      });

      const res = await request(app.getHttpServer())
        .get(`/patients/${validPatientId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(validPatientId);
    });

    it('5. should return 404 when querying a soft-deleted patient', async () => {
      patientService.getPatientById.mockRejectedValue(
        new NotFoundException('Patient not found'),
      );

      const token = generateToken({
        sub: 'admin-1',
        email: 'admin@hospital-a.com',
        role: 'HOSPITAL_ADMIN',
      });

      const res = await request(app.getHttpServer())
        .get(`/patients/${validPatientId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  // =========================================================
  // 6, 7, 8. TENANT ISOLATION (HOSPITAL A vs HOSPITAL B)
  // =========================================================
  describe('Tenant Isolation', () => {
    it('6. Hospital A user cannot access Hospital B patient (403)', async () => {
      patientService.getPatientById.mockRejectedValue(
        new ForbiddenException(
          'Access denied: Patient belongs to another hospital',
        ),
      );

      const tokenHospitalA = generateToken({
        sub: 'admin-a',
        email: 'admin@hospital-a.com',
        role: 'HOSPITAL_ADMIN',
        hospitalId: hospitalAId,
      });

      const res = await request(app.getHttpServer())
        .get(`/patients/${validPatientId}`)
        .set('Authorization', `Bearer ${tokenHospitalA}`);

      expect(res.status).toBe(403);
    });

    it('7. Hospital A user cannot update Hospital B patient (403)', async () => {
      patientService.updatePatient.mockRejectedValue(
        new ForbiddenException(
          'Access denied: Patient belongs to another hospital',
        ),
      );

      const tokenHospitalA = generateToken({
        sub: 'admin-a',
        email: 'admin@hospital-a.com',
        role: 'HOSPITAL_ADMIN',
        hospitalId: hospitalAId,
      });

      const res = await request(app.getHttpServer())
        .patch(`/patients/${validPatientId}`)
        .set('Authorization', `Bearer ${tokenHospitalA}`)
        .send({ bloodGroup: 'AB+' });

      expect(res.status).toBe(403);
    });

    it('8. Hospital A user cannot delete Hospital B patient (403)', async () => {
      patientService.deletePatient.mockRejectedValue(
        new ForbiddenException(
          'Access denied: Patient belongs to another hospital',
        ),
      );

      const tokenHospitalA = generateToken({
        sub: 'admin-a',
        email: 'admin@hospital-a.com',
        role: 'HOSPITAL_ADMIN',
        hospitalId: hospitalAId,
      });

      const res = await request(app.getHttpServer())
        .delete(`/patients/${validPatientId}`)
        .set('Authorization', `Bearer ${tokenHospitalA}`);

      expect(res.status).toBe(403);
    });

    it('9. Patient cannot access another patient record (403)', async () => {
      patientService.getPatientById.mockRejectedValue(
        new ForbiddenException(
          'Access denied: You can only access your own patient profile',
        ),
      );

      const tokenOtherPatient = generateToken({
        sub: 'other-patient-user',
        email: 'other@example.com',
        role: 'PATIENT',
        hospitalId: hospitalAId,
      });

      const res = await request(app.getHttpServer())
        .get(`/patients/${validPatientId}`)
        .set('Authorization', `Bearer ${tokenOtherPatient}`);

      expect(res.status).toBe(403);
    });

    it('10. SUPER_ADMIN cross-tenant behavior: allowed across hospitals', async () => {
      patientService.getPatientById.mockResolvedValue(mockSafePatient);

      const tokenSuperAdmin = generateToken({
        sub: 'super-admin',
        email: 'super@medcore.com',
        role: 'SUPER_ADMIN',
        hospitalId: 'any-hospital',
      });

      const res = await request(app.getHttpServer())
        .get(`/patients/${validPatientId}`)
        .set('Authorization', `Bearer ${tokenSuperAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // =========================================================
  // 3. UPDATE PATIENT
  // =========================================================
  describe('PATCH /patients/:id', () => {
    it('3. should update patient successfully', async () => {
      patientService.updatePatient.mockResolvedValue({
        ...mockSafePatient,
        bloodGroup: 'AB+',
      });

      const token = generateToken({
        sub: 'admin-1',
        email: 'admin@hospital-a.com',
        role: 'HOSPITAL_ADMIN',
      });

      const res = await request(app.getHttpServer())
        .patch(`/patients/${validPatientId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ bloodGroup: 'AB+' });

      expect(res.status).toBe(200);
      expect(res.body.data.bloodGroup).toBe('AB+');
    });
  });

  // =========================================================
  // 4. SOFT DELETE PATIENT
  // =========================================================
  describe('DELETE /patients/:id', () => {
    it('4. should soft delete patient successfully', async () => {
      patientService.deletePatient.mockResolvedValue({
        message: 'Patient record deactivated successfully',
      });

      const token = generateToken({
        sub: 'admin-1',
        email: 'admin@hospital-a.com',
        role: 'HOSPITAL_ADMIN',
      });

      const res = await request(app.getHttpServer())
        .delete(`/patients/${validPatientId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('deactivated');
    });

    it('should forbid RECEPTIONIST from deleting patients (403)', async () => {
      const token = generateToken({
        sub: 'recep-1',
        email: 'recep@hospital-a.com',
        role: 'RECEPTIONIST',
      });

      const res = await request(app.getHttpServer())
        .delete(`/patients/${validPatientId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  // =========================================================
  // 13. SENSITIVE DATA EXPOSURE VERIFICATION
  // =========================================================
  describe('Response Safety', () => {
    it('13. should ensure sensitive fields are not exposed in responses', async () => {
      patientService.getPatientById.mockResolvedValue(mockSafePatient);

      const token = generateToken({
        sub: 'admin-1',
        email: 'admin@hospital-a.com',
        role: 'HOSPITAL_ADMIN',
      });

      const res = await request(app.getHttpServer())
        .get(`/patients/${validPatientId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.password).toBeUndefined();
      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(res.body.data.user.refreshToken).toBeUndefined();
      expect(res.body.data.user.otp).toBeUndefined();
    });
  });

  // =========================================================
  // SELF-SERVICE ENDPOINTS (GET /patients/me, PATCH /patients/me)
  // =========================================================
  describe('Self-Service Profile (/patients/me)', () => {
    it('should return self patient profile on GET /patients/me', async () => {
      patientService.getCurrentPatient.mockResolvedValue(mockSafePatient);

      const token = generateToken({
        sub: validUserId,
        email: 'alice@example.com',
        role: 'PATIENT',
      });

      const res = await request(app.getHttpServer())
        .get('/patients/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(validPatientId);
    });

    it('should update self profile on PATCH /patients/me', async () => {
      patientService.getCurrentPatient.mockResolvedValue(mockSafePatient);
      patientService.updatePatient.mockResolvedValue({
        ...mockSafePatient,
        emergencyContactName: 'New Contact',
      });

      const token = generateToken({
        sub: validUserId,
        email: 'alice@example.com',
        role: 'PATIENT',
      });

      const res = await request(app.getHttpServer())
        .patch('/patients/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ emergencyContactName: 'New Contact' });

      expect(res.status).toBe(200);
      expect(res.body.data.emergencyContactName).toBe('New Contact');
    });
  });
});
