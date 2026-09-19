import { Test, TestingModule } from '@nestjs/testing';
import { HospitalController } from './hospital.controller';
import { HospitalService } from './hospital.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';

describe('HospitalController', () => {
  let controller: HospitalController;
  let service: {
    getHospitalById: jest.Mock;
    updateHospital: jest.Mock;
    getAllHospitals: jest.Mock;
    createHospital: jest.Mock;
  };

  const mockHospital = {
    id: 'hosp-1',
    name: 'Apollo Hospital',
    email: 'contact@apollo.com',
    phone: '+91 9999999999',
  };

  beforeEach(async () => {
    service = {
      getHospitalById: jest.fn(),
      updateHospital: jest.fn(),
      getAllHospitals: jest.fn(),
      createHospital: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HospitalController],
      providers: [
        {
          provide: HospitalService,
          useValue: service,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<HospitalController>(HospitalController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMyHospital (GET /hospitals/me)', () => {
    it('should return the current user hospital details', async () => {
      service.getHospitalById.mockResolvedValue(mockHospital);

      const req = {
        user: {
          userId: 'user-1',
          email: 'admin@apollo.com',
          roleId: 'role-1',
          role: 'HOSPITAL_ADMIN',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.getMyHospital(req);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockHospital);
      expect(service.getHospitalById).toHaveBeenCalledWith('hosp-1');
    });

    it('should throw BadRequestException if user has no hospitalId', async () => {
      const req = {
        user: {
          userId: 'user-2',
          email: 'super@medcore.com',
          roleId: 'role-super',
          role: 'SUPER_ADMIN',
          hospitalId: null,
        },
      } as unknown as Request;

      await expect(controller.getMyHospital(req)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateMyHospital (PATCH /hospitals/me)', () => {
    it('should update current user hospital details', async () => {
      const updatedHospital = { ...mockHospital, name: 'Apollo New Name' };
      service.updateHospital.mockResolvedValue(updatedHospital);

      const req = {
        user: {
          userId: 'user-1',
          role: 'HOSPITAL_ADMIN',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.updateMyHospital(req, {
        name: 'Apollo New Name',
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual(updatedHospital);
      expect(service.updateHospital).toHaveBeenCalledWith('hosp-1', {
        name: 'Apollo New Name',
      });
    });

    it('should throw BadRequestException if user has no hospitalId', async () => {
      const req = {
        user: {
          userId: 'user-2',
          role: 'SUPER_ADMIN',
          hospitalId: null,
        },
      } as unknown as Request;

      await expect(
        controller.updateMyHospital(req, { name: 'Apollo New Name' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAllHospitals (GET /hospitals)', () => {
    it('should return all hospitals', async () => {
      service.getAllHospitals.mockResolvedValue([mockHospital]);

      const result = await controller.getAllHospitals();
      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockHospital]);
      expect(service.getAllHospitals).toHaveBeenCalled();
    });
  });

  describe('getHospitalById (GET /hospitals/:id) - Tenant Isolation', () => {
    it('should allow access if user belongs to the requested hospital', async () => {
      service.getHospitalById.mockResolvedValue(mockHospital);

      const req = {
        user: {
          userId: 'user-1',
          role: 'DOCTOR',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.getHospitalById('hosp-1', req);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockHospital);
    });

    it('should allow access if user is SUPER_ADMIN across different hospital', async () => {
      service.getHospitalById.mockResolvedValue(mockHospital);

      const req = {
        user: {
          userId: 'user-super',
          role: 'SUPER_ADMIN',
          hospitalId: 'hosp-other',
        },
      } as unknown as Request;

      const result = await controller.getHospitalById('hosp-1', req);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockHospital);
    });

    it('should throw ForbiddenException if user tries to access a different hospital', async () => {
      const req = {
        user: {
          userId: 'user-1',
          role: 'DOCTOR',
          hospitalId: 'hosp-2',
        },
      } as unknown as Request;

      await expect(
        controller.getHospitalById('hosp-1', req),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateHospitalById (PATCH /hospitals/:id) - Tenant Isolation', () => {
    it('should allow update if user belongs to the hospital', async () => {
      service.updateHospital.mockResolvedValue(mockHospital);

      const req = {
        user: {
          userId: 'user-1',
          role: 'HOSPITAL_ADMIN',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.updateHospitalById('hosp-1', req, {
        name: 'Apollo Updated',
      });
      expect(result.success).toBe(true);
      expect(service.updateHospital).toHaveBeenCalledWith('hosp-1', {
        name: 'Apollo Updated',
      });
    });

    it('should throw ForbiddenException if user tries to update another hospital', async () => {
      const req = {
        user: {
          userId: 'user-1',
          role: 'HOSPITAL_ADMIN',
          hospitalId: 'hosp-2',
        },
      } as unknown as Request;

      await expect(
        controller.updateHospitalById('hosp-1', req, {
          name: 'Hacked Name',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow update if user is SUPER_ADMIN across different hospital', async () => {
      service.updateHospital.mockResolvedValue(mockHospital);

      const req = {
        user: {
          userId: 'user-super',
          role: 'SUPER_ADMIN',
          hospitalId: 'hosp-other',
        },
      } as unknown as Request;

      const result = await controller.updateHospitalById('hosp-1', req, {
        name: 'Apollo Super Updated',
      });
      expect(result.success).toBe(true);
      expect(service.updateHospital).toHaveBeenCalledWith('hosp-1', {
        name: 'Apollo Super Updated',
      });
    });
  });

  describe('createHospital (POST /hospitals)', () => {
    it('should create a hospital', async () => {
      service.createHospital.mockResolvedValue(mockHospital);

      const result = await controller.createHospital({
        name: 'Apollo Hospital',
        email: 'contact@apollo.com',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockHospital);
    });
  });
});
