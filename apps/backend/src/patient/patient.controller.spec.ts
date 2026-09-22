import { Test, TestingModule } from '@nestjs/testing';
import { PatientController } from './patient.controller';
import { PatientService } from './patient.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { Request } from 'express';

describe('PatientController', () => {
  let controller: PatientController;
  let service: {
    createPatient: jest.Mock;
    getPatients: jest.Mock;
    getPatientById: jest.Mock;
    getCurrentPatient: jest.Mock;
    updatePatient: jest.Mock;
    deletePatient: jest.Mock;
  };

  const mockPatient = {
    id: 'pat-1',
    userId: 'user-pat-1',
    hospitalId: 'hosp-1',
    dateOfBirth: new Date('1990-01-01'),
    gender: 'MALE',
    bloodGroup: 'O+',
  };

  beforeEach(async () => {
    service = {
      createPatient: jest.fn(),
      getPatients: jest.fn(),
      getPatientById: jest.fn(),
      getCurrentPatient: jest.fn(),
      updatePatient: jest.fn(),
      deletePatient: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PatientController],
      providers: [
        {
          provide: PatientService,
          useValue: service,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PatientController>(PatientController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createPatient', () => {
    it('should register a patient', async () => {
      service.createPatient.mockResolvedValue(mockPatient);

      const req = {
        user: {
          userId: 'admin-1',
          role: 'HOSPITAL_ADMIN',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.createPatient(req, {
        name: 'John Doe',
        email: 'john@example.com',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPatient);
      expect(service.createPatient).toHaveBeenCalled();
    });
  });

  describe('getCurrentPatient', () => {
    it('should return self patient profile', async () => {
      service.getCurrentPatient.mockResolvedValue(mockPatient);

      const req = {
        user: {
          userId: 'user-pat-1',
          role: 'PATIENT',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.getCurrentPatient(req);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPatient);
    });
  });

  describe('updateCurrentPatient', () => {
    it('should update self patient profile', async () => {
      service.getCurrentPatient.mockResolvedValue(mockPatient);
      service.updatePatient.mockResolvedValue({
        ...mockPatient,
        bloodGroup: 'A+',
      });

      const req = {
        user: {
          userId: 'user-pat-1',
          role: 'PATIENT',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.updateCurrentPatient(req, {
        bloodGroup: 'A+',
      });

      expect(result.success).toBe(true);
      expect(result.data.bloodGroup).toBe('A+');
    });
  });

  describe('getPatients', () => {
    it('should list patients', async () => {
      service.getPatients.mockResolvedValue([mockPatient]);

      const req = {
        user: {
          userId: 'doc-1',
          role: 'DOCTOR',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.getPatients(req, {});

      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockPatient]);
    });
  });

  describe('getPatientById', () => {
    it('should return a patient profile', async () => {
      service.getPatientById.mockResolvedValue(mockPatient);

      const req = {
        user: {
          userId: 'doc-1',
          role: 'DOCTOR',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.getPatientById('pat-1', req);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPatient);
    });
  });

  describe('updatePatient', () => {
    it('should update a patient profile', async () => {
      service.updatePatient.mockResolvedValue({
        ...mockPatient,
        bloodGroup: 'B+',
      });

      const req = {
        user: {
          userId: 'admin-1',
          role: 'HOSPITAL_ADMIN',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.updatePatient('pat-1', req, {
        bloodGroup: 'B+',
      });

      expect(result.success).toBe(true);
      expect(result.data.bloodGroup).toBe('B+');
    });
  });

  describe('deletePatient', () => {
    it('should deactivate a patient profile', async () => {
      service.deletePatient.mockResolvedValue({
        message: 'Patient record deactivated successfully',
      });

      const req = {
        user: {
          userId: 'admin-1',
          role: 'HOSPITAL_ADMIN',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.deletePatient('pat-1', req);

      expect(result.success).toBe(true);
      expect(result.message).toContain('deactivated');
    });
  });
});
