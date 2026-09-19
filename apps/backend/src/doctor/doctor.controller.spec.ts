import { Test, TestingModule } from '@nestjs/testing';
import { DoctorController } from './doctor.controller';
import { DoctorService } from './doctor.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { Request } from 'express';

describe('DoctorController', () => {
  let controller: DoctorController;
  let service: {
    createDoctor: jest.Mock;
    getDoctors: jest.Mock;
    getDoctorById: jest.Mock;
    updateDoctor: jest.Mock;
    deleteDoctor: jest.Mock;
  };

  const mockDoctor = {
    id: 'doc-1',
    userId: 'user-doc-1',
    departmentId: 'dept-1',
    specialization: 'Internal Medicine',
  };

  beforeEach(async () => {
    service = {
      createDoctor: jest.fn(),
      getDoctors: jest.fn(),
      getDoctorById: jest.fn(),
      updateDoctor: jest.fn(),
      deleteDoctor: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DoctorController],
      providers: [
        {
          provide: DoctorService,
          useValue: service,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DoctorController>(DoctorController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createDoctor', () => {
    it('should create a doctor profile', async () => {
      service.createDoctor.mockResolvedValue(mockDoctor);

      const req = {
        user: {
          userId: 'admin-1',
          role: 'HOSPITAL_ADMIN',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.createDoctor(req, {
        userId: 'user-doc-1',
        departmentId: 'dept-1',
        specialization: 'Internal Medicine',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockDoctor);
    });
  });

  describe('getDoctors', () => {
    it('should list doctors', async () => {
      service.getDoctors.mockResolvedValue([mockDoctor]);

      const req = {
        user: {
          userId: 'doc-1',
          role: 'DOCTOR',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.getDoctors(req, {});

      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockDoctor]);
    });
  });

  describe('getDoctorById', () => {
    it('should return a doctor profile', async () => {
      service.getDoctorById.mockResolvedValue(mockDoctor);

      const req = {
        user: {
          userId: 'doc-1',
          role: 'DOCTOR',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.getDoctorById('doc-1', req);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockDoctor);
    });
  });

  describe('updateDoctor', () => {
    it('should update doctor profile', async () => {
      const updated = { ...mockDoctor, specialization: 'Pediatrics' };
      service.updateDoctor.mockResolvedValue(updated);

      const req = {
        user: {
          userId: 'admin-1',
          role: 'HOSPITAL_ADMIN',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.updateDoctor('doc-1', req, {
        specialization: 'Pediatrics',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updated);
    });
  });

  describe('deleteDoctor', () => {
    it('should deactivate doctor profile', async () => {
      service.deleteDoctor.mockResolvedValue({
        message: 'Doctor profile deactivated successfully',
      });

      const req = {
        user: {
          userId: 'admin-1',
          role: 'HOSPITAL_ADMIN',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.deleteDoctor('doc-1', req);

      expect(result.success).toBe(true);
      expect(result.message).toBe(
        'Doctor profile deactivated successfully',
      );
    });
  });
});
