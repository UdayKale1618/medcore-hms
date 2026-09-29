import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { PatientPortalController } from './patient-portal.controller';
import { PatientPortalService } from './patient-portal.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

describe('Patient Portal Module Integration & RBAC Tests', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let portalService: {
    getProfile: jest.Mock;
    getAppointments: jest.Mock;
    getAppointmentById: jest.Mock;
    cancelAppointment: jest.Mock;
    getMedicalRecords: jest.Mock;
    getMedicalRecordById: jest.Mock;
    getPrescriptions: jest.Mock;
    getPrescriptionById: jest.Mock;
    getLabOrders: jest.Mock;
    getLabOrderById: jest.Mock;
    getInvoices: jest.Mock;
    getInvoiceById: jest.Mock;
  };

  const JWT_SECRET = 'test-jwt-secret-key-12345678901234567890';
  process.env.JWT_ACCESS_SECRET = JWT_SECRET;

  beforeAll(async () => {
    portalService = {
      getProfile: jest.fn(),
      getAppointments: jest.fn(),
      getAppointmentById: jest.fn(),
      cancelAppointment: jest.fn(),
      getMedicalRecords: jest.fn(),
      getMedicalRecordById: jest.fn(),
      getPrescriptions: jest.fn(),
      getPrescriptionById: jest.fn(),
      getLabOrders: jest.fn(),
      getLabOrderById: jest.fn(),
      getInvoices: jest.fn(),
      getInvoiceById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PatientPortalController],
      providers: [
        { provide: PatientPortalService, useValue: portalService },
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

  function createToken(role = 'PATIENT', userId = 'u-pat-1') {
    return jwtService.sign(
      {
        userId,
        email: 'patient@apollo.com',
        roleId: `role-${role.toLowerCase()}`,
        role,
        hospitalId: 'hosp-1',
      },
      { secret: JWT_SECRET },
    );
  }

  describe('GET /patient-portal/profile', () => {
    it('allows Patient to view their profile', async () => {
      portalService.getProfile.mockResolvedValue({
        id: 'pat-1',
        gender: 'MALE',
        bloodGroup: 'O+',
      });

      const token = createToken('PATIENT');
      const res = await request(app.getHttpServer())
        .get('/patient-portal/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.id).toBe('pat-1');
      expect(res.body.bloodGroup).toBe('O+');
    });

    it('denies non-Patient roles (e.g. Doctor, Pharmacist) with 403 Forbidden', async () => {
      const doctorToken = createToken('DOCTOR');
      await request(app.getHttpServer())
        .get('/patient-portal/profile')
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(403);
    });
  });

  describe('GET /patient-portal/medical-records', () => {
    it('allows Patient to view their clinical records', async () => {
      portalService.getMedicalRecords.mockResolvedValue([
        { id: 'rec-1', diagnosis: 'Hypertension', bloodPressure: '120/80' },
      ]);

      const token = createToken('PATIENT');
      const res = await request(app.getHttpServer())
        .get('/patient-portal/medical-records')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].diagnosis).toBe('Hypertension');
    });
  });

  describe('GET /patient-portal/prescriptions', () => {
    it('allows Patient to view their prescriptions', async () => {
      portalService.getPrescriptions.mockResolvedValue([
        { id: 'presc-1', status: 'PRESCRIBED', items: [] },
      ]);

      const token = createToken('PATIENT');
      const res = await request(app.getHttpServer())
        .get('/patient-portal/prescriptions')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].status).toBe('PRESCRIBED');
    });
  });

  describe('GET /patient-portal/invoices', () => {
    it('allows Patient to view their invoices and payments', async () => {
      portalService.getInvoices.mockResolvedValue([
        { id: 'inv-1', total: 1500, status: 'PAID' },
      ]);

      const token = createToken('PATIENT');
      const res = await request(app.getHttpServer())
        .get('/patient-portal/invoices')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].total).toBe(1500);
    });
  });
});
