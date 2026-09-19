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
import { DoctorController } from './doctor.controller';
import { DoctorService } from './doctor.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

describe('DoctorModule Integration & RBAC Tests', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let doctorService: {
    createDoctor: jest.Mock;
    getDoctors: jest.Mock;
    getDoctorById: jest.Mock;
    updateDoctor: jest.Mock;
    deleteDoctor: jest.Mock;
  };

  const JWT_SECRET = 'test-jwt-secret-key-12345678901234567890';
  process.env.JWT_ACCESS_SECRET = JWT_SECRET;

  const validUserId = 'c28a8d0e-255e-4c5e-855c-097587ef75dc';
  const validDepartmentId = 'a19b8c0e-1234-4c5e-855c-097587ef75dd';
  const validDoctorId = 'd39c8d0e-5678-4c5e-855c-097587ef75de';

  const mockDoctor = {
    id: validDoctorId,
    userId: validUserId,
    departmentId: validDepartmentId,
    specialization: 'Neurology',
    licenseNumber: 'DOC-999',
    consultationFee: 750,
    user: {
      id: validUserId,
      name: 'Dr. Gregory House',
      email: 'house@apollo.com',
      phone: '+91 9999999999',
      hospitalId: 'hosp-100',
    },
    department: {
      id: validDepartmentId,
      name: 'Neurology Dept',
    },
  };

  beforeAll(async () => {
    doctorService = {
      createDoctor: jest.fn(),
      getDoctors: jest.fn(),
      getDoctorById: jest.fn(),
      updateDoctor: jest.fn(),
      deleteDoctor: jest.fn(),
    };

    jwtService = new JwtService({ secret: JWT_SECRET });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [DoctorController],
      providers: [
        {
          provide: DoctorService,
          useValue: doctorService,
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
      hospitalId: user.hospitalId !== undefined ? user.hospitalId : 'hosp-100',
    });
  };

  // =========================================================
  // POST /doctors
  // =========================================================
  describe('POST /doctors', () => {
    it('should allow HOSPITAL_ADMIN to create doctor profile (201)', async () => {
      doctorService.createDoctor.mockResolvedValue(mockDoctor);

      const token = generateToken({
        sub: 'admin-1',
        email: 'admin@apollo.com',
        role: 'HOSPITAL_ADMIN',
      });

      const res = await request(app.getHttpServer())
        .post('/doctors')
        .set('Authorization', `Bearer ${token}`)
        .send({
          userId: validUserId,
          departmentId: validDepartmentId,
          specialization: 'Neurology',
          licenseNumber: 'DOC-999',
          consultationFee: 750,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(validDoctorId);
    });

    it('should reject PATIENT role with 403 Forbidden', async () => {
      const token = generateToken({
        sub: 'pat-1',
        email: 'pat@apollo.com',
        role: 'PATIENT',
      });

      const res = await request(app.getHttpServer())
        .post('/doctors')
        .set('Authorization', `Bearer ${token}`)
        .send({
          userId: validUserId,
          departmentId: validDepartmentId,
        });

      expect(res.status).toBe(403);
    });

    it('should fail with 400 when userId is not a valid UUID', async () => {
      const token = generateToken({
        sub: 'admin-1',
        email: 'admin@apollo.com',
        role: 'HOSPITAL_ADMIN',
      });

      const res = await request(app.getHttpServer())
        .post('/doctors')
        .set('Authorization', `Bearer ${token}`)
        .send({
          userId: 'not-a-uuid',
          departmentId: validDepartmentId,
        });

      expect(res.status).toBe(400);
    });

    it('should handle 409 Conflict when user already has doctor profile', async () => {
      doctorService.createDoctor.mockRejectedValue(
        new ConflictException('Doctor profile already exists for this user'),
      );

      const token = generateToken({
        sub: 'admin-1',
        email: 'admin@apollo.com',
        role: 'HOSPITAL_ADMIN',
      });

      const res = await request(app.getHttpServer())
        .post('/doctors')
        .set('Authorization', `Bearer ${token}`)
        .send({
          userId: validUserId,
          departmentId: validDepartmentId,
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('already exists');
    });
  });

  // =========================================================
  // GET /doctors
  // =========================================================
  describe('GET /doctors', () => {
    it('should return doctors list for authenticated user', async () => {
      doctorService.getDoctors.mockResolvedValue([mockDoctor]);

      const token = generateToken({
        sub: 'doc-1',
        email: 'doc@apollo.com',
        role: 'DOCTOR',
      });

      const res = await request(app.getHttpServer())
        .get('/doctors?specialization=Neurology')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(doctorService.getDoctors).toHaveBeenCalledWith(
        expect.objectContaining({ specialization: 'Neurology' }),
        expect.any(Object),
      );
    });
  });

  // =========================================================
  // GET /doctors/:id
  // =========================================================
  describe('GET /doctors/:id', () => {
    it('should return doctor details by ID', async () => {
      doctorService.getDoctorById.mockResolvedValue(mockDoctor);

      const token = generateToken({
        sub: 'doc-1',
        email: 'doc@apollo.com',
        role: 'DOCTOR',
      });

      const res = await request(app.getHttpServer())
        .get(`/doctors/${validDoctorId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(validDoctorId);
    });

    it('should return 403 if doctor belongs to another hospital (Tenant Isolation)', async () => {
      doctorService.getDoctorById.mockRejectedValue(
        new ForbiddenException(
          'Access denied: Doctor belongs to another hospital',
        ),
      );

      const token = generateToken({
        sub: 'doc-other',
        email: 'doc@other.com',
        role: 'DOCTOR',
        hospitalId: 'hosp-200',
      });

      const res = await request(app.getHttpServer())
        .get(`/doctors/${validDoctorId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('should return 404 when doctor not found', async () => {
      doctorService.getDoctorById.mockRejectedValue(
        new NotFoundException('Doctor not found'),
      );

      const token = generateToken({
        sub: 'admin-1',
        email: 'admin@apollo.com',
        role: 'HOSPITAL_ADMIN',
      });

      const res = await request(app.getHttpServer())
        .get('/doctors/non-existent')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  // =========================================================
  // PATCH /doctors/:id
  // =========================================================
  describe('PATCH /doctors/:id', () => {
    it('should allow updating doctor profile', async () => {
      doctorService.updateDoctor.mockResolvedValue({
        ...mockDoctor,
        consultationFee: 800,
      });

      const token = generateToken({
        sub: 'admin-1',
        email: 'admin@apollo.com',
        role: 'HOSPITAL_ADMIN',
      });

      const res = await request(app.getHttpServer())
        .patch(`/doctors/${validDoctorId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ consultationFee: 800 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.consultationFee).toBe(800);
    });
  });

  // =========================================================
  // DELETE /doctors/:id
  // =========================================================
  describe('DELETE /doctors/:id', () => {
    it('should allow HOSPITAL_ADMIN to deactivate doctor', async () => {
      doctorService.deleteDoctor.mockResolvedValue({
        message: 'Doctor profile deactivated successfully',
      });

      const token = generateToken({
        sub: 'admin-1',
        email: 'admin@apollo.com',
        role: 'HOSPITAL_ADMIN',
      });

      const res = await request(app.getHttpServer())
        .delete(`/doctors/${validDoctorId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('deactivated');
    });

    it('should reject DOCTOR from deleting doctor profiles (403)', async () => {
      const token = generateToken({
        sub: 'doc-1',
        email: 'doc@apollo.com',
        role: 'DOCTOR',
      });

      const res = await request(app.getHttpServer())
        .delete(`/doctors/${validDoctorId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });
});
