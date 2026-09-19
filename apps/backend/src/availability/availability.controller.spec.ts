import { Test, TestingModule } from '@nestjs/testing';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { Request } from 'express';

describe('AvailabilityController', () => {
  let controller: AvailabilityController;
  let service: {
    createAvailability: jest.Mock;
    getDoctorAvailability: jest.Mock;
    getAvailabilityById: jest.Mock;
    updateAvailability: jest.Mock;
    deleteAvailability: jest.Mock;
  };

  const mockAvailability = {
    id: 'avail-1',
    doctorId: 'doc-1',
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '13:00',
    slotMinutes: 30,
  };

  beforeEach(async () => {
    service = {
      createAvailability: jest.fn(),
      getDoctorAvailability: jest.fn(),
      getAvailabilityById: jest.fn(),
      updateAvailability: jest.fn(),
      deleteAvailability: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AvailabilityController],
      providers: [
        {
          provide: AvailabilityService,
          useValue: service,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AvailabilityController>(AvailabilityController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createAvailability', () => {
    it('should create an availability slot', async () => {
      service.createAvailability.mockResolvedValue(mockAvailability);

      const req = {
        user: {
          userId: 'user-doc-1',
          role: 'DOCTOR',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.createAvailability('doc-1', req, {
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '13:00',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAvailability);
    });
  });

  describe('getDoctorAvailability', () => {
    it('should return doctor availability', async () => {
      service.getDoctorAvailability.mockResolvedValue([mockAvailability]);

      const req = {
        user: {
          userId: 'user-doc-1',
          role: 'DOCTOR',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.getDoctorAvailability('doc-1', req);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockAvailability]);
    });
  });

  describe('getAvailabilityById', () => {
    it('should return availability by id', async () => {
      service.getAvailabilityById.mockResolvedValue(mockAvailability);

      const req = {
        user: {
          userId: 'user-doc-1',
          role: 'DOCTOR',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.getAvailabilityById('avail-1', req);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAvailability);
    });
  });

  describe('updateAvailability', () => {
    it('should update availability slot', async () => {
      const updated = { ...mockAvailability, endTime: '14:00' };
      service.updateAvailability.mockResolvedValue(updated);

      const req = {
        user: {
          userId: 'user-doc-1',
          role: 'DOCTOR',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.updateAvailability('avail-1', req, {
        endTime: '14:00',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updated);
    });
  });

  describe('deleteAvailability', () => {
    it('should delete availability slot', async () => {
      service.deleteAvailability.mockResolvedValue({
        message: 'Availability schedule deleted successfully',
      });

      const req = {
        user: {
          userId: 'user-doc-1',
          role: 'DOCTOR',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.deleteAvailability('avail-1', req);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Availability schedule deleted successfully');
    });
  });
});
