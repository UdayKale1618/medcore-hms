import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

describe('AvailabilityModule Integration & RBAC Tests', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let availabilityService: {
    createAvailability: jest.Mock;
    getDoctorAvailability: jest.Mock;
    getAvailabilityById: jest.Mock;
    updateAvailability: jest.Mock;
    deleteAvailability: jest.Mock;
  };

  const JWT_SECRET = 'test-jwt-secret-key-12345678901234567890';
  process.env.JWT_ACCESS_SECRET = JWT_SECRET;

  const mockAvailability = {
    id: 'avail-101',
    doctorId: 'doc-100',
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '13:00',
    slotMinutes: 30,
  };

  beforeAll(async () => {
    availabilityService = {
      createAvailability: jest.fn(),
      getDoctorAvailability: jest.fn(),
      getAvailabilityById: jest.fn(),
      updateAvailability: jest.fn(),
      deleteAvailability: jest.fn(),
    };

    jwtService = new JwtService({ secret: JWT_SECRET });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AvailabilityController],
      providers: [
        {
          provide: AvailabilityService,
          useValue: availabilityService,
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
  // POST /doctors/:doctorId/availability
  // =========================================================
  describe('POST /doctors/:doctorId/availability', () => {
    it('should allow DOCTOR or HOSPITAL_ADMIN to create availability slot (201)', async () => {
      availabilityService.createAvailability.mockResolvedValue(mockAvailability);

      const token = generateToken({
        sub: 'doc-user-1',
        email: 'doctor@apollo.com',
        role: 'DOCTOR',
      });

      const res = await request(app.getHttpServer())
        .post('/doctors/doc-100/availability')
        .set('Authorization', `Bearer ${token}`)
        .send({
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '13:00',
          slotMinutes: 30,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('avail-101');
    });

    it('should reject invalid time format (400 Bad Request)', async () => {
      const token = generateToken({
        sub: 'doc-user-1',
        email: 'doctor@apollo.com',
        role: 'DOCTOR',
      });

      const res = await request(app.getHttpServer())
        .post('/doctors/doc-100/availability')
        .set('Authorization', `Bearer ${token}`)
        .send({
          dayOfWeek: 1,
          startTime: '9:00', // Missing leading zero
          endTime: '13:00',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('startTime')]),
      );
    });

    it('should reject invalid dayOfWeek (> 6) (400 Bad Request)', async () => {
      const token = generateToken({
        sub: 'doc-user-1',
        email: 'doctor@apollo.com',
        role: 'DOCTOR',
      });

      const res = await request(app.getHttpServer())
        .post('/doctors/doc-100/availability')
        .set('Authorization', `Bearer ${token}`)
        .send({
          dayOfWeek: 7, // Invalid day of week
          startTime: '09:00',
          endTime: '13:00',
        });

      expect(res.status).toBe(400);
    });

    it('should reject when time range is inverted (startTime >= endTime)', async () => {
      availabilityService.createAvailability.mockRejectedValue(
        new BadRequestException('startTime must be strictly before endTime'),
      );

      const token = generateToken({
        sub: 'doc-user-1',
        email: 'doctor@apollo.com',
        role: 'DOCTOR',
      });

      const res = await request(app.getHttpServer())
        .post('/doctors/doc-100/availability')
        .set('Authorization', `Bearer ${token}`)
        .send({
          dayOfWeek: 1,
          startTime: '15:00',
          endTime: '09:00',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('strictly before');
    });

    it('should return 409 Conflict when slot overlaps with existing schedule', async () => {
      availabilityService.createAvailability.mockRejectedValue(
        new ConflictException(
          'Availability time range overlaps with an existing schedule for this day',
        ),
      );

      const token = generateToken({
        sub: 'doc-user-1',
        email: 'doctor@apollo.com',
        role: 'DOCTOR',
      });

      const res = await request(app.getHttpServer())
        .post('/doctors/doc-100/availability')
        .set('Authorization', `Bearer ${token}`)
        .send({
          dayOfWeek: 1,
          startTime: '10:00',
          endTime: '12:00',
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('overlaps');
    });
  });

  // =========================================================
  // GET /doctors/:doctorId/availability
  // =========================================================
  describe('GET /doctors/:doctorId/availability', () => {
    it('should return availability list for doctor', async () => {
      availabilityService.getDoctorAvailability.mockResolvedValue([
        mockAvailability,
      ]);

      const token = generateToken({
        sub: 'pat-1',
        email: 'pat@apollo.com',
        role: 'PATIENT',
      });

      const res = await request(app.getHttpServer())
        .get('/doctors/doc-100/availability')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return 403 if doctor belongs to another hospital (Tenant Isolation)', async () => {
      availabilityService.getDoctorAvailability.mockRejectedValue(
        new ForbiddenException(
          'Access denied: Doctor belongs to another hospital',
        ),
      );

      const token = generateToken({
        sub: 'pat-other',
        email: 'pat@other.com',
        role: 'PATIENT',
        hospitalId: 'hosp-200',
      });

      const res = await request(app.getHttpServer())
        .get('/doctors/doc-100/availability')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  // =========================================================
  // PATCH /availability/:id
  // =========================================================
  describe('PATCH /availability/:id', () => {
    it('should update availability slot', async () => {
      availabilityService.updateAvailability.mockResolvedValue({
        ...mockAvailability,
        endTime: '14:00',
      });

      const token = generateToken({
        sub: 'doc-user-1',
        email: 'doctor@apollo.com',
        role: 'DOCTOR',
      });

      const res = await request(app.getHttpServer())
        .patch('/availability/avail-101')
        .set('Authorization', `Bearer ${token}`)
        .send({ endTime: '14:00' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.endTime).toBe('14:00');
    });

    it('should return 409 Conflict if update results in schedule overlap', async () => {
      availabilityService.updateAvailability.mockRejectedValue(
        new ConflictException(
          'Updated time range overlaps with an existing schedule',
        ),
      );

      const token = generateToken({
        sub: 'doc-user-1',
        email: 'doctor@apollo.com',
        role: 'DOCTOR',
      });

      const res = await request(app.getHttpServer())
        .patch('/availability/avail-101')
        .set('Authorization', `Bearer ${token}`)
        .send({ endTime: '16:00' });

      expect(res.status).toBe(409);
    });
  });

  // =========================================================
  // DELETE /availability/:id
  // =========================================================
  describe('DELETE /availability/:id', () => {
    it('should delete availability slot', async () => {
      availabilityService.deleteAvailability.mockResolvedValue({
        message: 'Availability schedule deleted successfully',
      });

      const token = generateToken({
        sub: 'doc-user-1',
        email: 'doctor@apollo.com',
        role: 'DOCTOR',
      });

      const res = await request(app.getHttpServer())
        .delete('/availability/avail-101')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('deleted');
    });

    it('should return 403 if unauthorized user attempts delete', async () => {
      availabilityService.deleteAvailability.mockRejectedValue(
        new ForbiddenException(
          'You do not have permission to delete this availability schedule',
        ),
      );

      const token = generateToken({
        sub: 'pat-1',
        email: 'pat@apollo.com',
        role: 'PATIENT',
      });

      const res = await request(app.getHttpServer())
        .delete('/availability/avail-101')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });
});
