import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { HospitalController } from '../hospital/hospital.controller';
import { HospitalService } from '../hospital/hospital.service';
import { PatientPortalController } from '../patient-portal/patient-portal.controller';
import { PatientPortalService } from '../patient-portal/patient-portal.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import * as bcrypt from 'bcrypt';

describe('MedCore HMS Onboarding & Auth Flow Integration Tests', () => {
  let app: INestApplication;
  let prisma: any;
  let redisService: any;
  let jwtService: JwtService;

  const JWT_SECRET = 'test-jwt-secret-key-onboarding-1234567890';
  process.env.JWT_ACCESS_SECRET = JWT_SECRET;
  process.env.JWT_REFRESH_SECRET = JWT_SECRET;

  const mockHospitalA = {
    id: 'hosp-aaa',
    name: 'Apollo Specialty Hospital',
    email: 'admin@apollo.com',
    phone: '+91 80 2630 4050',
  };

  const mockHospitalB = {
    id: 'hosp-bbb',
    name: 'Fortis Healthcare',
    email: 'admin@fortis.com',
    phone: '+91 80 2630 4051',
  };

  const mockRoles = [
    { id: 'role-patient', name: 'PATIENT', description: 'Hospital Patient' },
    { id: 'role-doctor', name: 'DOCTOR', description: 'Hospital Doctor' },
    { id: 'role-nurse', name: 'NURSE', description: 'Hospital Nurse' },
    { id: 'role-hosp-admin', name: 'HOSPITAL_ADMIN', description: 'Hospital Admin' },
    { id: 'role-super-admin', name: 'SUPER_ADMIN', description: 'Super Admin' },
  ];

  // In-memory mock storage for integration testing
  let usersStore: any[] = [];
  let patientsStore: any[] = [];
  let doctorsStore: any[] = [];
  let otpsStore: any[] = [];
  let redisRtStore: Record<string, string> = {};

  beforeAll(async () => {
    jwtService = new JwtService({ secret: JWT_SECRET });

    redisService = {
      set: jest.fn().mockImplementation(async (key, val) => {
        redisRtStore[key] = val;
      }),
      get: jest.fn().mockImplementation(async (key) => {
        return redisRtStore[key] || null;
      }),
      delete: jest.fn().mockImplementation(async (key) => {
        delete redisRtStore[key];
      }),
    };

    prisma = {
      hospital: {
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          if (where.id === mockHospitalA.id) return mockHospitalA;
          if (where.id === mockHospitalB.id) return mockHospitalB;
          return null;
        }),
        findMany: jest.fn().mockResolvedValue([mockHospitalA, mockHospitalB]),
      },
      role: {
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          if (where.id) return mockRoles.find((r) => r.id === where.id) || null;
          if (where.name) return mockRoles.find((r) => r.name === where.name) || null;
          return null;
        }),
      },
      user: {
        findUnique: jest.fn().mockImplementation(async ({ where, include }) => {
          const user = usersStore.find(
            (u) => (where.id && u.id === where.id) || (where.email && u.email === where.email),
          );
          if (!user) return null;
          const role = mockRoles.find((r) => r.id === user.roleId);
          const hospital = user.hospitalId === mockHospitalA.id ? mockHospitalA : mockHospitalB;
          return {
            ...user,
            role: include?.role ? role : undefined,
            hospital: include?.hospital ? hospital : undefined,
          };
        }),
        findMany: jest.fn().mockImplementation(async ({ where }) => {
          return usersStore
            .filter((u) => u.hospitalId === where.hospitalId)
            .map((u) => ({
              ...u,
              role: mockRoles.find((r) => r.id === u.roleId),
              doctor: doctorsStore.find((d) => d.userId === u.id) || null,
            }));
        }),
        create: jest.fn().mockImplementation(async ({ data, include }) => {
          const newUser = {
            id: `usr-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            name: data.name,
            email: data.email,
            phone: data.phone || null,
            passwordHash: data.passwordHash,
            hospitalId: data.hospitalId,
            roleId: data.roleId,
            emailVerified: data.emailVerified ?? false,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          usersStore.push(newUser);
          const role = mockRoles.find((r) => r.id === newUser.roleId);
          const hospital = newUser.hospitalId === mockHospitalA.id ? mockHospitalA : mockHospitalB;
          return {
            ...newUser,
            role: include?.role ? role : undefined,
            hospital: include?.hospital ? hospital : undefined,
          };
        }),
        update: jest.fn().mockImplementation(async ({ where, data }) => {
          const index = usersStore.findIndex((u) => u.id === where.id);
          if (index === -1) return null;
          usersStore[index] = { ...usersStore[index], ...data };
          return usersStore[index];
        }),
      },
      patient: {
        create: jest.fn().mockImplementation(async ({ data }) => {
          const newPatient = {
            id: `pat-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            userId: data.userId,
            hospitalId: data.hospitalId,
            deletedAt: null,
            createdAt: new Date(),
          };
          patientsStore.push(newPatient);
          return newPatient;
        }),
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          return patientsStore.find((p) => p.userId === where.userId && p.deletedAt === null) || null;
        }),
      },
      doctor: {
        create: jest.fn().mockImplementation(async ({ data }) => {
          const newDoctor = {
            id: `doc-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            ...data,
          };
          doctorsStore.push(newDoctor);
          return newDoctor;
        }),
      },
      department: {
        findFirst: jest.fn().mockImplementation(async ({ where }) => {
          if (where.id === 'dept-cardio' && where.hospitalId === mockHospitalA.id) {
            return { id: 'dept-cardio', name: 'Cardiology', hospitalId: mockHospitalA.id };
          }
          return null;
        }),
      },
      emailVerificationOtp: {
        create: jest.fn().mockImplementation(async ({ data }) => {
          const newOtp = {
            id: `otp-${Date.now()}`,
            userId: data.userId,
            otp: data.otp,
            expiresAt: data.expiresAt,
            createdAt: new Date(),
          };
          otpsStore.push(newOtp);
          return newOtp;
        }),
        findFirst: jest.fn().mockImplementation(async ({ where }) => {
          return otpsStore
            .filter((o) => o.userId === where.userId && o.otp === where.otp)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] || null;
        }),
        delete: jest.fn().mockImplementation(async ({ where }) => {
          otpsStore = otpsStore.filter((o) => o.id !== where.id);
        }),
        deleteMany: jest.fn().mockImplementation(async ({ where }) => {
          otpsStore = otpsStore.filter((o) => o.userId !== where.userId);
        }),
      },
      notification: {
        create: jest.fn(),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController, HospitalController],
      providers: [
        AuthService,
        HospitalService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redisService },
        { provide: JwtService, useValue: jwtService },
        JwtAuthGuard,
        RolesGuard,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    usersStore = [];
    patientsStore = [];
    doctorsStore = [];
    otpsStore = [];
    redisRtStore = {};
    jest.clearAllMocks();
  });

  describe('1. Public Patient Registration Flow', () => {
    it('successfully registers patient and auto-creates Patient entity and verification OTP', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Jane Patient',
          email: 'jane.patient@example.com',
          phone: '+91 9876543210',
          password: 'Password123!',
          hospitalId: mockHospitalA.id,
        })
        .expect(201);

      expect(res.body.message).toContain('Registration successful');
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('jane.patient@example.com');
      expect(res.body.user.role).toBe('PATIENT');
      expect(res.body.user.emailVerified).toBe(false);

      // Verify Patient record created
      const patient = patientsStore.find((p) => p.userId === res.body.user.id);
      expect(patient).toBeDefined();
      expect(patient.hospitalId).toBe(mockHospitalA.id);

      // Verify OTP generated
      const otp = otpsStore.find((o) => o.userId === res.body.user.id);
      expect(otp).toBeDefined();
      expect(otp.otp).toMatch(/^\d{6}$/);
    });

    it('rejects duplicate email with 409 Conflict', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Jane Patient',
          email: 'jane.patient@example.com',
          password: 'Password123!',
          hospitalId: mockHospitalA.id,
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Another Jane',
          email: 'jane.patient@example.com',
          password: 'Password123!',
          hospitalId: mockHospitalA.id,
        })
        .expect(409);

      expect(res.body.message).toBe('Email already registered');
    });

    it('rejects invalid hospital ID with 401 Unauthorized', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'John Doe',
          email: 'john.doe@example.com',
          password: 'Password123!',
          hospitalId: 'non-existent-hospital',
        })
        .expect(401);
    });
  });

  describe('2. Privilege Escalation Prevention', () => {
    it('blocks unauthorized role escalation: public user cannot self-register as SUPER_ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Attacker Admin',
          email: 'attacker@example.com',
          password: 'Password123!',
          hospitalId: mockHospitalA.id,
          roleId: 'role-super-admin',
        })
        .expect(403);

      expect(res.body.message).toContain('Public registration is only permitted for patients');
    });

    it('blocks unauthorized role escalation: public user cannot self-register as DOCTOR', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Fake Doctor',
          email: 'fakedoc@example.com',
          password: 'Password123!',
          hospitalId: mockHospitalA.id,
          roleId: 'role-doctor',
        })
        .expect(403);

      expect(res.body.message).toContain('Public registration is only permitted for patients');
    });
  });

  describe('3. Email Verification Flow (PRD: POST /auth/verify-email)', () => {
    it('verifies user email using 6-digit OTP and marks emailVerified to true', async () => {
      // 1. Register user
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Verify Test',
          email: 'verify@example.com',
          password: 'Password123!',
          hospitalId: mockHospitalA.id,
        })
        .expect(201);

      const generatedOtp = regRes.body.otp;

      // 2. Attempt with wrong OTP
      await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({
          email: 'verify@example.com',
          otp: '000000',
        })
        .expect(401);

      // 3. Verify with correct OTP
      const verifyRes = await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({
          email: 'verify@example.com',
          otp: generatedOtp,
        })
        .expect(201);

      expect(verifyRes.body.message).toBe('Email verified successfully');

      // 4. Verify user record is marked emailVerified
      const user = usersStore.find((u) => u.email === 'verify@example.com');
      expect(user.emailVerified).toBe(true);
    });

    it('supports legacy /auth/verify-otp route alias seamlessly', async () => {
      const regRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Legacy Route Test',
          email: 'legacy@example.com',
          password: 'Password123!',
          hospitalId: mockHospitalA.id,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/verify-otp')
        .send({
          email: 'legacy@example.com',
          otp: regRes.body.otp,
        })
        .expect(201);

      const user = usersStore.find((u) => u.email === 'legacy@example.com');
      expect(user.emailVerified).toBe(true);
    });
  });

  describe('4. Staff Provisioning & Tenant Isolation (PRD: POST /hospitals/:id/staff)', () => {
    let hospitalAdminAToken: string;
    let hospitalAdminBToken: string;

    beforeEach(async () => {
      hospitalAdminAToken = jwtService.sign({
        sub: 'user-hosp-admin-a',
        email: 'admin@apollo.com',
        roleId: 'role-hosp-admin',
        role: 'HOSPITAL_ADMIN',
        hospitalId: mockHospitalA.id,
      });

      hospitalAdminBToken = jwtService.sign({
        sub: 'user-hosp-admin-b',
        email: 'admin@fortis.com',
        roleId: 'role-hosp-admin',
        role: 'HOSPITAL_ADMIN',
        hospitalId: mockHospitalB.id,
      });
    });

    it('allows Hospital Admin to provision staff (Doctor) in their own hospital', async () => {
      const res = await request(app.getHttpServer())
        .post(`/hospitals/${mockHospitalA.id}/staff`)
        .set('Authorization', `Bearer ${hospitalAdminAToken}`)
        .send({
          name: 'Dr. New Doctor',
          email: 'doctor.new@apollo.com',
          password: 'Password123!',
          role: 'DOCTOR',
          departmentId: 'dept-cardio',
          specialization: 'Interventional Cardiology',
          licenseNumber: 'DOC-12345',
          consultationFee: 750,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('DOCTOR');
      expect(res.body.data.hospitalId).toBe(mockHospitalA.id);
      expect(res.body.data.doctor).toBeDefined();
    });

    it('enforces tenant isolation: Hospital Admin cannot provision staff in another hospital', async () => {
      const res = await request(app.getHttpServer())
        .post(`/hospitals/${mockHospitalB.id}/staff`)
        .set('Authorization', `Bearer ${hospitalAdminAToken}`)
        .send({
          name: 'Intruder Staff',
          email: 'intruder@fortis.com',
          password: 'Password123!',
          role: 'NURSE',
        })
        .expect(403);

      expect(res.body.message).toContain('Access denied');
    });

    it('prevents privilege escalation: Hospital Admin cannot provision another HOSPITAL_ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .post(`/hospitals/${mockHospitalA.id}/staff`)
        .set('Authorization', `Bearer ${hospitalAdminAToken}`)
        .send({
          name: 'Second Admin',
          email: 'admin2@apollo.com',
          password: 'Password123!',
          role: 'HOSPITAL_ADMIN',
        })
        .expect(403);

      expect(res.body.message).toContain('Only SUPER_ADMIN can provision hospital administrators');
    });

    it('rejects unauthenticated staff provisioning requests with 401', async () => {
      await request(app.getHttpServer())
        .post(`/hospitals/${mockHospitalA.id}/staff`)
        .send({
          name: 'Hacker Nurse',
          email: 'hacker@apollo.com',
          password: 'Password123!',
          role: 'NURSE',
        })
        .expect(401);
    });

    it('lists hospital staff scoped strictly to caller hospital', async () => {
      // Provision a nurse in Hospital A
      await request(app.getHttpServer())
        .post(`/hospitals/${mockHospitalA.id}/staff`)
        .set('Authorization', `Bearer ${hospitalAdminAToken}`)
        .send({
          name: 'Nurse Joy',
          email: 'joy@apollo.com',
          password: 'Password123!',
          role: 'NURSE',
        })
        .expect(201);

      // Hospital Admin A requests staff list
      const res = await request(app.getHttpServer())
        .get(`/hospitals/${mockHospitalA.id}/staff`)
        .set('Authorization', `Bearer ${hospitalAdminAToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.some((s: any) => s.email === 'joy@apollo.com')).toBe(true);
    });
  });

  describe('5. Public Hospital Discovery for Registration', () => {
    it('provides public list of active hospitals for registration dropdown via /auth/hospitals without auth', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/hospitals')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0]).toHaveProperty('id');
      expect(res.body[0]).toHaveProperty('name');
      expect(res.body[0]).toHaveProperty('email');
    });

    it('supports /api/auth/hospitals prefix cleanly for proxy compatibility', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/hospitals')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0]).toHaveProperty('id');
    });

    it('supports /auth/public-hospitals alias cleanly', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/public-hospitals')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });
});
