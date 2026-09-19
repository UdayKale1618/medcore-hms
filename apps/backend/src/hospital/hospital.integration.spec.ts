import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { HospitalController } from './hospital.controller';
import { HospitalService } from './hospital.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('HospitalModule Integration & RBAC Tests', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let hospitalService: {
    getHospitalById: jest.Mock;
    updateHospital: jest.Mock;
    getAllHospitals: jest.Mock;
    createHospital: jest.Mock;
  };

  const JWT_SECRET = 'test-jwt-secret-key-12345678901234567890';
  process.env.JWT_ACCESS_SECRET = JWT_SECRET;

  const mockHospital = {
    id: 'hosp-100',
    name: 'Apollo Health',
    email: 'apollo@health.com',
    phone: '+91 9999999999',
    addresses: [
      {
        id: 'addr-1',
        hospitalId: 'hosp-100',
        addressLine1: '100 Medical Road',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001',
        country: 'India',
      },
    ],
  };

  beforeAll(async () => {
    hospitalService = {
      getHospitalById: jest.fn(),
      updateHospital: jest.fn(),
      getAllHospitals: jest.fn(),
      createHospital: jest.fn(),
    };

    jwtService = new JwtService({ secret: JWT_SECRET });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HospitalController],
      providers: [
        {
          provide: HospitalService,
          useValue: hospitalService,
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

  // Helper to generate test tokens
  const generateToken = (user: {
    sub: string;
    email: string;
    role: string;
    roleId?: string;
    hospitalId?: string | null;
  }) => {
    return jwtService.sign({
      sub: user.sub,
      email: user.email,
      role: user.role,
      roleId: user.roleId || 'role-1',
      hospitalId: user.hospitalId !== undefined ? user.hospitalId : 'hosp-100',
    });
  };

  // =========================================================
  // AUTHENTICATION & UNAUTHORIZED ACCESS
  // =========================================================
  describe('Authentication Tests', () => {
    it('should reject request without Bearer token (401)', async () => {
      const res = await request(app.getHttpServer()).get('/hospitals/me');
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Access token not provided');
    });

    it('should reject request with invalid Bearer token (401)', async () => {
      const res = await request(app.getHttpServer())
        .get('/hospitals/me')
        .set('Authorization', 'Bearer invalid-token-xyz');
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid or expired access token');
    });
  });

  // =========================================================
  // GET /hospitals/me
  // =========================================================
  describe('GET /hospitals/me', () => {
    it('should return hospital for authenticated user with hospitalId', async () => {
      hospitalService.getHospitalById.mockResolvedValue(mockHospital);

      const token = generateToken({
        sub: 'user-1',
        email: 'doctor@apollo.com',
        role: 'DOCTOR',
        hospitalId: 'hosp-100',
      });

      const res = await request(app.getHttpServer())
        .get('/hospitals/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('hosp-100');
      expect(hospitalService.getHospitalById).toHaveBeenCalledWith('hosp-100');
    });

    it('should throw 400 BadRequest when token has no hospitalId', async () => {
      const token = generateToken({
        sub: 'user-2',
        email: 'super@medcore.com',
        role: 'SUPER_ADMIN',
        hospitalId: null,
      });

      const res = await request(app.getHttpServer())
        .get('/hospitals/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('No hospital associated');
    });
  });

  // =========================================================
  // PATCH /hospitals/me (RBAC + Tenant Isolation)
  // =========================================================
  describe('PATCH /hospitals/me', () => {
    it('should allow HOSPITAL_ADMIN to update hospital', async () => {
      const updated = { ...mockHospital, name: 'Apollo Advanced' };
      hospitalService.updateHospital.mockResolvedValue(updated);

      const token = generateToken({
        sub: 'admin-1',
        email: 'admin@apollo.com',
        role: 'HOSPITAL_ADMIN',
        hospitalId: 'hosp-100',
      });

      const res = await request(app.getHttpServer())
        .patch('/hospitals/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Apollo Advanced' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Apollo Advanced');
    });

    it('should reject non-admin roles (e.g. PATIENT) with 403 Forbidden', async () => {
      const token = generateToken({
        sub: 'patient-1',
        email: 'patient@apollo.com',
        role: 'PATIENT',
        hospitalId: 'hosp-100',
      });

      const res = await request(app.getHttpServer())
        .patch('/hospitals/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Hacked Apollo' });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('do not have permission');
    });

    it('should reject DOCTOR role with 403 Forbidden', async () => {
      const token = generateToken({
        sub: 'doc-1',
        email: 'doc@apollo.com',
        role: 'DOCTOR',
        hospitalId: 'hosp-100',
      });

      const res = await request(app.getHttpServer())
        .patch('/hospitals/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Doctor Update' });

      expect(res.status).toBe(403);
    });

    it('should reject invalid email format with 400 Bad Request', async () => {
      const token = generateToken({
        sub: 'admin-1',
        email: 'admin@apollo.com',
        role: 'HOSPITAL_ADMIN',
        hospitalId: 'hosp-100',
      });

      const res = await request(app.getHttpServer())
        .patch('/hospitals/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'not-a-valid-email' });

      expect(res.status).toBe(400);
      expect(res.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('email')]),
      );
    });
  });

  // =========================================================
  // GET /hospitals (SUPER_ADMIN only)
  // =========================================================
  describe('GET /hospitals', () => {
    it('should allow SUPER_ADMIN to list all hospitals', async () => {
      hospitalService.getAllHospitals.mockResolvedValue([mockHospital]);

      const token = generateToken({
        sub: 'super-1',
        email: 'super@medcore.com',
        role: 'SUPER_ADMIN',
      });

      const res = await request(app.getHttpServer())
        .get('/hospitals')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should reject HOSPITAL_ADMIN from listing all hospitals with 403 Forbidden', async () => {
      const token = generateToken({
        sub: 'admin-1',
        email: 'admin@apollo.com',
        role: 'HOSPITAL_ADMIN',
      });

      const res = await request(app.getHttpServer())
        .get('/hospitals')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  // =========================================================
  // POST /hospitals (SUPER_ADMIN onboarding + DTO validation)
  // =========================================================
  describe('POST /hospitals', () => {
    it('should allow SUPER_ADMIN to create hospital with address', async () => {
      hospitalService.createHospital.mockResolvedValue(mockHospital);

      const token = generateToken({
        sub: 'super-1',
        email: 'super@medcore.com',
        role: 'SUPER_ADMIN',
      });

      const res = await request(app.getHttpServer())
        .post('/hospitals')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Apollo Health',
          email: 'apollo@health.com',
          phone: '+91 9999999999',
          addressLine1: '100 Medical Road',
          city: 'Mumbai',
          state: 'Maharashtra',
          postalCode: '400001',
          country: 'India',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Apollo Health');
    });

    it('should fail with 400 when name is missing', async () => {
      const token = generateToken({
        sub: 'super-1',
        email: 'super@medcore.com',
        role: 'SUPER_ADMIN',
      });

      const res = await request(app.getHttpServer())
        .post('/hospitals')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'apollo@health.com',
        });

      expect(res.status).toBe(400);
    });

    it('should fail with 400 when email is invalid', async () => {
      const token = generateToken({
        sub: 'super-1',
        email: 'super@medcore.com',
        role: 'SUPER_ADMIN',
      });

      const res = await request(app.getHttpServer())
        .post('/hospitals')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Apollo Hospital',
          email: 'bad-email',
        });

      expect(res.status).toBe(400);
    });

    it('should return 409 Conflict when hospital email already exists', async () => {
      hospitalService.createHospital.mockRejectedValue(
        new ConflictException('Hospital with this email already exists'),
      );

      const token = generateToken({
        sub: 'super-1',
        email: 'super@medcore.com',
        role: 'SUPER_ADMIN',
      });

      const res = await request(app.getHttpServer())
        .post('/hospitals')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Duplicate Hospital',
          email: 'duplicate@hospital.com',
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe('Hospital with this email already exists');
    });

    it('should reject non-super-admin (e.g. HOSPITAL_ADMIN) with 403', async () => {
      const token = generateToken({
        sub: 'admin-1',
        email: 'admin@apollo.com',
        role: 'HOSPITAL_ADMIN',
      });

      const res = await request(app.getHttpServer())
        .post('/hospitals')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'New Hospital',
          email: 'new@hospital.com',
        });

      expect(res.status).toBe(403);
    });
  });

  // =========================================================
  // GET /hospitals/:id (Tenant Isolation)
  // =========================================================
  describe('GET /hospitals/:id', () => {
    it('should allow user to access their own hospital', async () => {
      hospitalService.getHospitalById.mockResolvedValue(mockHospital);

      const token = generateToken({
        sub: 'doc-1',
        email: 'doctor@apollo.com',
        role: 'DOCTOR',
        hospitalId: 'hosp-100',
      });

      const res = await request(app.getHttpServer())
        .get('/hospitals/hosp-100')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('hosp-100');
    });

    it('should forbid user from accessing another hospital (Tenant Isolation)', async () => {
      const token = generateToken({
        sub: 'doc-1',
        email: 'doctor@apollo.com',
        role: 'DOCTOR',
        hospitalId: 'hosp-100',
      });

      const res = await request(app.getHttpServer())
        .get('/hospitals/hosp-different-tenant')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Access denied');
    });

    it('should allow SUPER_ADMIN cross-tenant access to any hospital', async () => {
      hospitalService.getHospitalById.mockResolvedValue(mockHospital);

      const token = generateToken({
        sub: 'super-1',
        email: 'super@medcore.com',
        role: 'SUPER_ADMIN',
        hospitalId: 'hosp-other',
      });

      const res = await request(app.getHttpServer())
        .get('/hospitals/hosp-100')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('hosp-100');
    });

    it('should return 404 when hospital does not exist', async () => {
      hospitalService.getHospitalById.mockRejectedValue(
        new NotFoundException('Hospital not found'),
      );

      const token = generateToken({
        sub: 'super-1',
        email: 'super@medcore.com',
        role: 'SUPER_ADMIN',
      });

      const res = await request(app.getHttpServer())
        .get('/hospitals/hosp-non-existent')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Hospital not found');
    });
  });

  // =========================================================
  // PATCH /hospitals/:id (Tenant Isolation + RBAC)
  // =========================================================
  describe('PATCH /hospitals/:id', () => {
    it('should allow HOSPITAL_ADMIN to update their own hospital', async () => {
      hospitalService.updateHospital.mockResolvedValue(mockHospital);

      const token = generateToken({
        sub: 'admin-1',
        email: 'admin@apollo.com',
        role: 'HOSPITAL_ADMIN',
        hospitalId: 'hosp-100',
      });

      const res = await request(app.getHttpServer())
        .patch('/hospitals/hosp-100')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Apollo Health Center' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should forbid HOSPITAL_ADMIN from updating another hospital', async () => {
      const token = generateToken({
        sub: 'admin-1',
        email: 'admin@apollo.com',
        role: 'HOSPITAL_ADMIN',
        hospitalId: 'hosp-100',
      });

      const res = await request(app.getHttpServer())
        .patch('/hospitals/hosp-other-hospital')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Hacked Other Hospital' });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Access denied');
    });

    it('should allow SUPER_ADMIN cross-tenant update on any hospital', async () => {
      hospitalService.updateHospital.mockResolvedValue(mockHospital);

      const token = generateToken({
        sub: 'super-1',
        email: 'super@medcore.com',
        role: 'SUPER_ADMIN',
        hospitalId: 'hosp-super-home',
      });

      const res = await request(app.getHttpServer())
        .patch('/hospitals/hosp-100')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Super Admin Override' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 when hospital to update does not exist', async () => {
      hospitalService.updateHospital.mockRejectedValue(
        new NotFoundException('Hospital not found'),
      );

      const token = generateToken({
        sub: 'super-1',
        email: 'super@medcore.com',
        role: 'SUPER_ADMIN',
      });

      const res = await request(app.getHttpServer())
        .patch('/hospitals/hosp-non-existent')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Non-existent' });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Hospital not found');
    });

    it('should return 409 Conflict when update email is already used', async () => {
      hospitalService.updateHospital.mockRejectedValue(
        new ConflictException(
          'Email is already registered to another hospital',
        ),
      );

      const token = generateToken({
        sub: 'admin-1',
        email: 'admin@apollo.com',
        role: 'HOSPITAL_ADMIN',
        hospitalId: 'hosp-100',
      });

      const res = await request(app.getHttpServer())
        .patch('/hospitals/hosp-100')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'taken@hospital.com' });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe(
        'Email is already registered to another hospital',
      );
    });
  });
});
