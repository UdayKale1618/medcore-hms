import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppointmentController } from './appointment.controller';
import { AppointmentService } from './appointment.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentStatus } from './dto/update-appointment-status.dto';
import { AppointmentType } from './dto/create-appointment.dto';

describe('Appointment Concurrency & Double-Booking Protection (Day 9)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const JWT_SECRET = 'test-jwt-secret-key-12345678901234567890';
  process.env.JWT_ACCESS_SECRET = JWT_SECRET;

  const hospitalAId = 'hosp-aaa-111';
  const hospitalBId = 'hosp-bbb-222';
  const dept1Id = 'a19b8c0e-3333-4c5e-855c-097587ef75dc';

  const doctor1 = {
    id: 'd39c8d0e-1111-4c5e-855c-097587ef75dc',
    userId: 'user-doc-1',
    departmentId: dept1Id,
    specialization: 'Cardiology',
    licenseNumber: 'DOC-111',
    consultationFee: 500,
    deletedAt: null,
    user: {
      id: 'user-doc-1',
      name: 'Dr. Gregory House',
      email: 'house@apollo.com',
      phone: '+1 555-0111',
      hospitalId: hospitalAId,
    },
    department: {
      id: dept1Id,
      name: 'Cardiology',
      hospitalId: hospitalAId,
    },
  };

  const doctor2 = {
    id: 'd39c8d0e-2222-4c5e-855c-097587ef75dc',
    userId: 'user-doc-2',
    departmentId: dept1Id,
    specialization: 'Cardiology',
    licenseNumber: 'DOC-222',
    consultationFee: 600,
    deletedAt: null,
    user: {
      id: 'user-doc-2',
      name: 'Dr. James Wilson',
      email: 'wilson@apollo.com',
      phone: '+1 555-0222',
      hospitalId: hospitalAId,
    },
    department: {
      id: dept1Id,
      name: 'Cardiology',
      hospitalId: hospitalAId,
    },
  };

  const patient1 = {
    id: 'a49c8d0e-1111-4c5e-855c-097587ef75dc',
    userId: 'user-pat-1',
    hospitalId: hospitalAId,
    dateOfBirth: new Date('1990-01-01'),
    gender: 'MALE',
    bloodGroup: 'O+',
    deletedAt: null,
    user: {
      id: 'user-pat-1',
      name: 'Patient One',
      email: 'p1@example.com',
      phone: '+1 555-0101',
      hospitalId: hospitalAId,
    },
  };

  const patient2 = {
    id: 'a49c8d0e-2222-4c5e-855c-097587ef75dc',
    userId: 'user-pat-2',
    hospitalId: hospitalAId,
    dateOfBirth: new Date('1992-02-02'),
    gender: 'FEMALE',
    bloodGroup: 'A+',
    deletedAt: null,
    user: {
      id: 'user-pat-2',
      name: 'Patient Two',
      email: 'p2@example.com',
      phone: '+1 555-0202',
      hospitalId: hospitalAId,
    },
  };

  const department = {
    id: dept1Id,
    name: 'Cardiology Department',
    hospitalId: hospitalAId,
  };

  // Thursday 09:00 - 17:00 availability for both doctors
  const availabilityDoc1 = {
    id: 'avail-1',
    doctorId: doctor1.id,
    dayOfWeek: 4, // Thursday
    startTime: '09:00',
    endTime: '17:00',
    slotMinutes: 30,
  };

  const availabilityDoc2 = {
    id: 'avail-2',
    doctorId: doctor2.id,
    dayOfWeek: 4, // Thursday
    startTime: '09:00',
    endTime: '17:00',
    slotMinutes: 30,
  };

  // Thursday 2026-10-15
  const validDate = '2026-10-15T00:00:00.000Z';
  const slot1Start = '2026-10-15T10:00:00.000Z';
  const slot1End = '2026-10-15T10:30:00.000Z';
  const slot2Start = '2026-10-15T11:00:00.000Z';
  const slot2End = '2026-10-15T11:30:00.000Z';

  // In-memory data store with realistic row-level locking simulation for testing
  let appointmentsStore: any[] = [];
  const activeLocks = new Map<string, Promise<void>>();
  const lockResolvers = new Map<string, () => void>();

  async function acquireLock(resourceId: string): Promise<() => void> {
    while (activeLocks.has(resourceId)) {
      await activeLocks.get(resourceId);
    }

    let resolver: () => void = () => {};
    const lockPromise = new Promise<void>((resolve) => {
      resolver = resolve;
    });

    activeLocks.set(resourceId, lockPromise);
    lockResolvers.set(resourceId, resolver);

    return () => {
      activeLocks.delete(resourceId);
      lockResolvers.delete(resourceId);
      resolver();
    };
  }

  const mockPrisma = {
    doctor: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.id === doctor1.id) return Promise.resolve(doctor1);
        if (where.id === doctor2.id) return Promise.resolve(doctor2);
        return Promise.resolve(null);
      }),
    },
    patient: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.id === patient1.id || where.userId === patient1.userId) {
          return Promise.resolve(patient1);
        }
        if (where.id === patient2.id || where.userId === patient2.userId) {
          return Promise.resolve(patient2);
        }
        return Promise.resolve(null);
      }),
    },
    department: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.id === dept1Id) return Promise.resolve(department);
        return Promise.resolve(null);
      }),
    },
    doctorAvailability: {
      findMany: jest.fn().mockImplementation(({ where }) => {
        const results: any[] = [];
        if (where.doctorId === doctor1.id && where.dayOfWeek === 4) {
          results.push(availabilityDoc1);
        }
        if (where.doctorId === doctor2.id && where.dayOfWeek === 4) {
          results.push(availabilityDoc2);
        }
        return Promise.resolve(results);
      }),
    },
    appointment: {
      findFirst: jest.fn().mockImplementation(({ where }) => {
        const found = appointmentsStore.find((apt) => {
          if (apt.deletedAt !== null) return false;
          if (apt.status === AppointmentStatus.CANCELLED) return false;

          const matchDoctor = where.doctorId ? apt.doctorId === where.doctorId : true;
          const matchPatient = where.patientId ? apt.patientId === where.patientId : true;

          const aptStart = new Date(apt.startTime).getTime();
          const aptEnd = new Date(apt.endTime).getTime();
          const qStart = where.startTime?.lt ? new Date(where.startTime.lt).getTime() : Infinity;
          const qEnd = where.endTime?.gt ? new Date(where.endTime.gt).getTime() : -Infinity;

          const overlaps = aptStart < qStart && aptEnd > qEnd;
          return matchDoctor && matchPatient && overlaps;
        });
        return Promise.resolve(found || null);
      }),
      findMany: jest.fn().mockImplementation(() => {
        return Promise.resolve(appointmentsStore.filter((a) => a.deletedAt === null));
      }),
      create: jest.fn().mockImplementation(({ data, include }) => {
        const newApt = {
          id: `apt-${Date.now()}-${Math.random()}`,
          ...data,
          deletedAt: null,
          doctor: data.doctorId === doctor1.id ? doctor1 : doctor2,
          patient: data.patientId === patient1.id ? patient1 : patient2,
          department,
        };
        appointmentsStore.push(newApt);
        return Promise.resolve(newApt);
      }),
    },
    $transaction: jest.fn().mockImplementation(async (callback) => {
      const releaseFns: (() => void)[] = [];

      const txProxy = {
        ...mockPrisma,
        $queryRaw: jest.fn().mockImplementation(async (query: any, ...args: any[]) => {
          // Detect resource ID from parameterized query (e.g. SELECT id FROM "Doctor" WHERE id = $1 FOR UPDATE)
          const resourceId = args[0] || '';
          if (resourceId) {
            const release = await acquireLock(resourceId);
            releaseFns.push(release);
          }
          return [{ id: resourceId }];
        }),
      };

      try {
        const result = await callback(txProxy);
        return result;
      } finally {
        for (const release of releaseFns) {
          release();
        }
      }
    }),
  };

  beforeAll(async () => {
    jwtService = new JwtService({ secret: JWT_SECRET });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppointmentController],
      providers: [
        AppointmentService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
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
    appointmentsStore = [];
    activeLocks.clear();
    lockResolvers.clear();
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
  // STEP 5: TWO CONCURRENT BOOKING REQUESTS (SAME DOCTOR & TIME)
  // =========================================================
  describe('Step 5: Concurrent Booking for Same Doctor & Slot', () => {
    it('should allow exactly ONE booking to succeed (201) and the other to fail with 409 Conflict', async () => {
      const tokenP1 = generateToken({
        sub: patient1.userId,
        email: patient1.user.email,
        role: 'PATIENT',
      });

      const tokenP2 = generateToken({
        sub: patient2.userId,
        email: patient2.user.email,
        role: 'PATIENT',
      });

      // Launch both requests simultaneously via Promise.all
      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post('/appointments')
          .set('Authorization', `Bearer ${tokenP1}`)
          .send({
            doctorId: doctor1.id,
            departmentId: dept1Id,
            appointmentDate: validDate,
            startTime: slot1Start,
            endTime: slot1End,
            reason: 'Patient 1 Booking',
          }),
        request(app.getHttpServer())
          .post('/appointments')
          .set('Authorization', `Bearer ${tokenP2}`)
          .send({
            doctorId: doctor1.id,
            departmentId: dept1Id,
            appointmentDate: validDate,
            startTime: slot1Start,
            endTime: slot1End,
            reason: 'Patient 2 Booking',
          }),
      ]);

      const statusCodes = [res1.status, res2.status].sort();
      expect(statusCodes).toEqual([201, 409]);

      // INVARIANT: Exactly 1 appointment created in store
      expect(appointmentsStore).toHaveLength(1);
      expect(appointmentsStore[0].doctorId).toBe(doctor1.id);
    });
  });

  // =========================================================
  // STEP 6: ADDITIONAL CONCURRENCY SCENARIOS
  // =========================================================
  describe('Step 6: Comprehensive Concurrency Scenarios', () => {
    it('1. Two patients booking the same doctor/time concurrently -> only one succeeds', async () => {
      const tokenReceptionist = generateToken({
        sub: 'recep-1',
        email: 'recep@apollo.com',
        role: 'RECEPTIONIST',
      });

      const [resA, resB] = await Promise.all([
        request(app.getHttpServer())
          .post('/appointments')
          .set('Authorization', `Bearer ${tokenReceptionist}`)
          .send({
            doctorId: doctor1.id,
            patientId: patient1.id,
            departmentId: dept1Id,
            appointmentDate: validDate,
            startTime: slot1Start,
            endTime: slot1End,
          }),
        request(app.getHttpServer())
          .post('/appointments')
          .set('Authorization', `Bearer ${tokenReceptionist}`)
          .send({
            doctorId: doctor1.id,
            patientId: patient2.id,
            departmentId: dept1Id,
            appointmentDate: validDate,
            startTime: slot1Start,
            endTime: slot1End,
          }),
      ]);

      const statuses = [resA.status, resB.status].sort();
      expect(statuses).toEqual([201, 409]);
      expect(appointmentsStore).toHaveLength(1);
    });

    it('2. Same patient attempting conflicting simultaneous bookings across doctors -> protected', async () => {
      const tokenP1 = generateToken({
        sub: patient1.userId,
        email: patient1.user.email,
        role: 'PATIENT',
      });

      // Patient 1 concurrently tries to book Doctor 1 and Doctor 2 for the exact same time
      const [resDoc1, resDoc2] = await Promise.all([
        request(app.getHttpServer())
          .post('/appointments')
          .set('Authorization', `Bearer ${tokenP1}`)
          .send({
            doctorId: doctor1.id,
            departmentId: dept1Id,
            appointmentDate: validDate,
            startTime: slot1Start,
            endTime: slot1End,
          }),
        request(app.getHttpServer())
          .post('/appointments')
          .set('Authorization', `Bearer ${tokenP1}`)
          .send({
            doctorId: doctor2.id,
            departmentId: dept1Id,
            appointmentDate: validDate,
            startTime: slot1Start,
            endTime: slot1End,
          }),
      ]);

      const statuses = [resDoc1.status, resDoc2.status].sort();
      expect(statuses).toEqual([201, 409]);
      expect(appointmentsStore).toHaveLength(1);
    });

    it('3. Different doctors at the same time -> both can succeed concurrently', async () => {
      const tokenP1 = generateToken({
        sub: patient1.userId,
        email: patient1.user.email,
        role: 'PATIENT',
      });

      const tokenP2 = generateToken({
        sub: patient2.userId,
        email: patient2.user.email,
        role: 'PATIENT',
      });

      // Patient 1 books Doctor 1, Patient 2 books Doctor 2 at the same slot
      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post('/appointments')
          .set('Authorization', `Bearer ${tokenP1}`)
          .send({
            doctorId: doctor1.id,
            departmentId: dept1Id,
            appointmentDate: validDate,
            startTime: slot1Start,
            endTime: slot1End,
          }),
        request(app.getHttpServer())
          .post('/appointments')
          .set('Authorization', `Bearer ${tokenP2}`)
          .send({
            doctorId: doctor2.id,
            departmentId: dept1Id,
            appointmentDate: validDate,
            startTime: slot1Start,
            endTime: slot1End,
          }),
      ]);

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
      expect(appointmentsStore).toHaveLength(2);
    });

    it('4. Different time slots for the same doctor -> both can succeed concurrently', async () => {
      const tokenP1 = generateToken({
        sub: patient1.userId,
        email: patient1.user.email,
        role: 'PATIENT',
      });

      const tokenP2 = generateToken({
        sub: patient2.userId,
        email: patient2.user.email,
        role: 'PATIENT',
      });

      // Patient 1 books 10:00-10:30, Patient 2 books 11:00-11:30 for Doctor 1
      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post('/appointments')
          .set('Authorization', `Bearer ${tokenP1}`)
          .send({
            doctorId: doctor1.id,
            departmentId: dept1Id,
            appointmentDate: validDate,
            startTime: slot1Start,
            endTime: slot1End,
          }),
        request(app.getHttpServer())
          .post('/appointments')
          .set('Authorization', `Bearer ${tokenP2}`)
          .send({
            doctorId: doctor1.id,
            departmentId: dept1Id,
            appointmentDate: validDate,
            startTime: slot2Start,
            endTime: slot2End,
          }),
      ]);

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
      expect(appointmentsStore).toHaveLength(2);
    });

    it('5. Cancelled appointment should not block a new booking for the same slot', async () => {
      // Pre-populate with a cancelled appointment in slot1
      appointmentsStore.push({
        id: 'apt-old-cancelled',
        doctorId: doctor1.id,
        patientId: patient1.id,
        departmentId: dept1Id,
        appointmentDate: new Date(validDate),
        startTime: new Date(slot1Start),
        endTime: new Date(slot1End),
        status: AppointmentStatus.CANCELLED,
        type: AppointmentType.REGULAR,
        deletedAt: new Date(),
      });

      const tokenP2 = generateToken({
        sub: patient2.userId,
        email: patient2.user.email,
        role: 'PATIENT',
      });

      const res = await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${tokenP2}`)
        .send({
          doctorId: doctor1.id,
          departmentId: dept1Id,
          appointmentDate: validDate,
          startTime: slot1Start,
          endTime: slot1End,
        });

      expect(res.status).toBe(201);
      expect(appointmentsStore).toHaveLength(2);
    });

    it('6. Existing availability rules remain enforced during booking', async () => {
      const tokenP1 = generateToken({
        sub: patient1.userId,
        email: patient1.user.email,
        role: 'PATIENT',
      });

      // Doctor is only available 09:00 - 17:00. 19:00 is outside
      const res = await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${tokenP1}`)
        .send({
          doctorId: doctor1.id,
          departmentId: dept1Id,
          appointmentDate: validDate,
          startTime: '2026-10-15T19:00:00.000Z',
          endTime: '2026-10-15T19:30:00.000Z',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('outside doctor availability');
    });

    it('7. Cross-tenant booking remains blocked with 403 Forbidden', async () => {
      const tokenHospitalB = generateToken({
        sub: 'pat-b',
        email: 'patb@hospital-b.com',
        role: 'HOSPITAL_ADMIN',
        hospitalId: hospitalBId, // Hospital B
      });

      // Trying to book doctor1 (Hospital A) from Hospital B
      const res = await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${tokenHospitalB}`)
        .send({
          doctorId: doctor1.id,
          patientId: patient1.id,
          departmentId: dept1Id,
          appointmentDate: validDate,
          startTime: slot1Start,
          endTime: slot1End,
        });

      expect(res.status).toBe(403);
    });
  });
});
