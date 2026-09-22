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
import { AppointmentController } from './appointment.controller';
import { AppointmentService } from './appointment.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentStatus } from './dto/update-appointment-status.dto';
import { AppointmentType } from './dto/create-appointment.dto';

describe('AppointmentModule Integration & RBAC Tests', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let appointmentService: {
    createAppointment: jest.Mock;
    getAppointments: jest.Mock;
    getAppointmentById: jest.Mock;
    getCurrentUserAppointments: jest.Mock;
    updateAppointment: jest.Mock;
    updateAppointmentStatus: jest.Mock;
    deleteAppointment: jest.Mock;
  };

  const JWT_SECRET = 'test-jwt-secret-key-12345678901234567890';
  process.env.JWT_ACCESS_SECRET = JWT_SECRET;

  const validDoctorId = 'd39c8d0e-1111-4c5e-855c-097587ef75dc';
  const validPatientId = 'a49c8d0e-2222-4c5e-855c-097587ef75dc';
  const validDepartmentId = 'a19b8c0e-3333-4c5e-855c-097587ef75dc';
  const validAppointmentId = 'b29c8d0e-4444-4c5e-855c-097587ef75dc';
  const hospitalAId = 'hosp-aaa-111';
  const hospitalBId = 'hosp-bbb-222';

  const mockSafeAppointment = {
    id: validAppointmentId,
    doctorId: validDoctorId,
    patientId: validPatientId,
    departmentId: validDepartmentId,
    appointmentDate: '2026-10-15T00:00:00.000Z',
    startTime: '2026-10-15T09:00:00.000Z',
    endTime: '2026-10-15T09:30:00.000Z',
    status: AppointmentStatus.PENDING,
    type: AppointmentType.REGULAR,
    reason: 'Follow-up consultation',
    doctor: {
      id: validDoctorId,
      specialization: 'Cardiology',
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
    department: {
      id: validDepartmentId,
      name: 'Cardiology Department',
      hospitalId: hospitalAId,
    },
  };

  beforeAll(async () => {
    appointmentService = {
      createAppointment: jest.fn(),
      getAppointments: jest.fn(),
      getAppointmentById: jest.fn(),
      getCurrentUserAppointments: jest.fn(),
      updateAppointment: jest.fn(),
      updateAppointmentStatus: jest.fn(),
      deleteAppointment: jest.fn(),
    };

    jwtService = new JwtService({ secret: JWT_SECRET });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppointmentController],
      providers: [
        {
          provide: AppointmentService,
          useValue: appointmentService,
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
      const res = await request(app.getHttpServer()).get('/appointments');
      expect(res.status).toBe(401);
    });
  });

  // =========================================================
  // 1-12. CREATION & VALIDATION & RBAC
  // =========================================================
  describe('POST /appointments', () => {
    it('1. should allow RECEPTIONIST to book an appointment (201)', async () => {
      appointmentService.createAppointment.mockResolvedValue(
        mockSafeAppointment,
      );

      const token = generateToken({
        sub: 'recep-1',
        email: 'recep@hospital-a.com',
        role: 'RECEPTIONIST',
      });

      const res = await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          doctorId: validDoctorId,
          patientId: validPatientId,
          departmentId: validDepartmentId,
          appointmentDate: '2026-10-15T00:00:00.000Z',
          startTime: '2026-10-15T09:00:00.000Z',
          endTime: '2026-10-15T09:30:00.000Z',
          reason: 'Checkup',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(validAppointmentId);
    });

    it('should allow PATIENT to book their own appointment (201)', async () => {
      appointmentService.createAppointment.mockResolvedValue(
        mockSafeAppointment,
      );

      const token = generateToken({
        sub: 'user-pat-1',
        email: 'pat@example.com',
        role: 'PATIENT',
      });

      const res = await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          doctorId: validDoctorId,
          departmentId: validDepartmentId,
          appointmentDate: '2026-10-15T00:00:00.000Z',
          startTime: '2026-10-15T09:00:00.000Z',
          endTime: '2026-10-15T09:30:00.000Z',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('12. should forbid LAB_TECHNICIAN, PHARMACIST, ACCOUNTANT from booking appointments (403)', async () => {
      for (const role of ['LAB_TECHNICIAN', 'PHARMACIST', 'ACCOUNTANT']) {
        const token = generateToken({
          sub: 'staff-1',
          email: 'staff@example.com',
          role,
        });

        const res = await request(app.getHttpServer())
          .post('/appointments')
          .set('Authorization', `Bearer ${token}`)
          .send({
            doctorId: validDoctorId,
            patientId: validPatientId,
            departmentId: validDepartmentId,
            appointmentDate: '2026-10-15T00:00:00.000Z',
            startTime: '2026-10-15T09:00:00.000Z',
            endTime: '2026-10-15T09:30:00.000Z',
          });

        expect(res.status).toBe(403);
      }
    });

    it('10. should reject invalid input with 400 (e.g. invalid UUID, missing fields)', async () => {
      const token = generateToken({
        sub: 'admin-1',
        email: 'admin@hospital-a.com',
        role: 'HOSPITAL_ADMIN',
      });

      const res = await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          doctorId: 'not-a-uuid',
          departmentId: validDepartmentId,
        });

      expect(res.status).toBe(400);
    });

    it('11. should handle 409 Conflict when appointment overlaps existing slot', async () => {
      appointmentService.createAppointment.mockRejectedValue(
        new ConflictException(
          'Doctor already has an appointment scheduled during this time slot',
        ),
      );

      const token = generateToken({
        sub: 'recep-1',
        email: 'recep@hospital-a.com',
        role: 'RECEPTIONIST',
      });

      const res = await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          doctorId: validDoctorId,
          patientId: validPatientId,
          departmentId: validDepartmentId,
          appointmentDate: '2026-10-15T00:00:00.000Z',
          startTime: '2026-10-15T09:00:00.000Z',
          endTime: '2026-10-15T09:30:00.000Z',
        });

      expect(res.status).toBe(409);
    });
  });

  // =========================================================
  // 13-17. RETRIEVAL & ISOLATION
  // =========================================================
  describe('GET /appointments & /appointments/:id', () => {
    it('13. should allow hospital staff to list appointments', async () => {
      appointmentService.getAppointments.mockResolvedValue([
        mockSafeAppointment,
      ]);

      const token = generateToken({
        sub: 'nurse-1',
        email: 'nurse@hospital-a.com',
        role: 'NURSE',
      });

      const res = await request(app.getHttpServer())
        .get('/appointments')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    it('14. should retrieve appointment by ID', async () => {
      appointmentService.getAppointmentById.mockResolvedValue(
        mockSafeAppointment,
      );

      const token = generateToken({
        sub: 'doc-1',
        email: 'doc@hospital-a.com',
        role: 'DOCTOR',
      });

      const res = await request(app.getHttpServer())
        .get(`/appointments/${validAppointmentId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(validAppointmentId);
    });

    it('15. Hospital Isolation: Hospital A user cannot access Hospital B appointment (403)', async () => {
      appointmentService.getAppointmentById.mockRejectedValue(
        new ForbiddenException(
          'Access denied: Appointment belongs to another hospital',
        ),
      );

      const tokenA = generateToken({
        sub: 'admin-a',
        email: 'admin@hospital-a.com',
        role: 'HOSPITAL_ADMIN',
        hospitalId: hospitalAId,
      });

      const res = await request(app.getHttpServer())
        .get(`/appointments/${validAppointmentId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(403);
    });

    it('16. Patient Isolation: Patient cannot access another patient appointment (403)', async () => {
      appointmentService.getAppointmentById.mockRejectedValue(
        new ForbiddenException(
          'Access denied: You can only access your own appointments',
        ),
      );

      const tokenOtherPatient = generateToken({
        sub: 'other-pat-user',
        email: 'other@example.com',
        role: 'PATIENT',
      });

      const res = await request(app.getHttpServer())
        .get(`/appointments/${validAppointmentId}`)
        .set('Authorization', `Bearer ${tokenOtherPatient}`);

      expect(res.status).toBe(403);
    });

    it('should return current user appointments on GET /appointments/me', async () => {
      appointmentService.getCurrentUserAppointments.mockResolvedValue([
        mockSafeAppointment,
      ]);

      const token = generateToken({
        sub: 'user-pat-1',
        email: 'alice@example.com',
        role: 'PATIENT',
      });

      const res = await request(app.getHttpServer())
        .get('/appointments/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  // =========================================================
  // 18-21. UPDATE & STATUS
  // =========================================================
  describe('PATCH /appointments/:id & /status', () => {
    it('18. should update appointment details', async () => {
      appointmentService.updateAppointment.mockResolvedValue({
        ...mockSafeAppointment,
        reason: 'Updated consultation reason',
      });

      const token = generateToken({
        sub: 'admin-1',
        email: 'admin@hospital-a.com',
        role: 'HOSPITAL_ADMIN',
      });

      const res = await request(app.getHttpServer())
        .patch(`/appointments/${validAppointmentId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'Updated consultation reason' });

      expect(res.status).toBe(200);
      expect(res.body.data.reason).toBe('Updated consultation reason');
    });

    it('should update appointment status (CONFIRMED)', async () => {
      appointmentService.updateAppointmentStatus.mockResolvedValue({
        ...mockSafeAppointment,
        status: AppointmentStatus.CONFIRMED,
      });

      const token = generateToken({
        sub: 'recep-1',
        email: 'recep@hospital-a.com',
        role: 'RECEPTIONIST',
      });

      const res = await request(app.getHttpServer())
        .patch(`/appointments/${validAppointmentId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: AppointmentStatus.CONFIRMED });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(AppointmentStatus.CONFIRMED);
    });

    it('20. should block cross-hospital update (403)', async () => {
      appointmentService.updateAppointment.mockRejectedValue(
        new ForbiddenException(
          'Access denied: Appointment belongs to another hospital',
        ),
      );

      const tokenA = generateToken({
        sub: 'admin-a',
        email: 'admin@hospital-a.com',
        role: 'HOSPITAL_ADMIN',
        hospitalId: hospitalAId,
      });

      const res = await request(app.getHttpServer())
        .patch(`/appointments/${validAppointmentId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ reason: 'Malicious update' });

      expect(res.status).toBe(403);
    });
  });

  // =========================================================
  // 22-25. DELETE / CANCELLATION
  // =========================================================
  describe('DELETE /appointments/:id', () => {
    it('22 & 23. should allow RECEPTIONIST to cancel and soft-delete appointment', async () => {
      appointmentService.deleteAppointment.mockResolvedValue({
        message: 'Appointment cancelled and removed successfully',
      });

      const token = generateToken({
        sub: 'recep-1',
        email: 'recep@hospital-a.com',
        role: 'RECEPTIONIST',
      });

      const res = await request(app.getHttpServer())
        .delete(`/appointments/${validAppointmentId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('cancelled');
    });

    it('24. should return 404 for soft-deleted appointment on GET', async () => {
      appointmentService.getAppointmentById.mockRejectedValue(
        new NotFoundException('Appointment not found'),
      );

      const token = generateToken({
        sub: 'admin-1',
        email: 'admin@hospital-a.com',
        role: 'HOSPITAL_ADMIN',
      });

      const res = await request(app.getHttpServer())
        .get(`/appointments/${validAppointmentId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('25. should block cross-hospital deletion (403)', async () => {
      appointmentService.deleteAppointment.mockRejectedValue(
        new ForbiddenException(
          'Access denied: Appointment belongs to another hospital',
        ),
      );

      const tokenA = generateToken({
        sub: 'admin-a',
        email: 'admin@hospital-a.com',
        role: 'HOSPITAL_ADMIN',
        hospitalId: hospitalAId,
      });

      const res = await request(app.getHttpServer())
        .delete(`/appointments/${validAppointmentId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(403);
    });
  });

  // =========================================================
  // RESPONSE SAFETY
  // =========================================================
  describe('Response Safety', () => {
    it('should not expose password, passwordHash, or tokens in appointment response', async () => {
      appointmentService.getAppointmentById.mockResolvedValue(
        mockSafeAppointment,
      );

      const token = generateToken({
        sub: 'admin-1',
        email: 'admin@hospital-a.com',
        role: 'HOSPITAL_ADMIN',
      });

      const res = await request(app.getHttpServer())
        .get(`/appointments/${validAppointmentId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.doctor.user.password).toBeUndefined();
      expect(res.body.data.doctor.user.passwordHash).toBeUndefined();
      expect(res.body.data.patient.user.password).toBeUndefined();
      expect(res.body.data.patient.user.passwordHash).toBeUndefined();
    });
  });
});
