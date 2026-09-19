import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentController } from './department.controller';
import { DepartmentService } from './department.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';

describe('DepartmentController', () => {
  let controller: DepartmentController;
  let service: {
    createDepartment: jest.Mock;
    getDepartments: jest.Mock;
    getDepartmentById: jest.Mock;
    updateDepartment: jest.Mock;
    deleteDepartment: jest.Mock;
  };

  const mockDepartment = {
    id: 'dept-1',
    name: 'Cardiology',
    hospitalId: 'hosp-1',
  };

  beforeEach(async () => {
    service = {
      createDepartment: jest.fn(),
      getDepartments: jest.fn(),
      getDepartmentById: jest.fn(),
      updateDepartment: jest.fn(),
      deleteDepartment: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DepartmentController],
      providers: [
        {
          provide: DepartmentService,
          useValue: service,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DepartmentController>(DepartmentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createDepartment', () => {
    it('should create a department with user hospitalId', async () => {
      service.createDepartment.mockResolvedValue(mockDepartment);

      const req = {
        user: {
          userId: 'user-1',
          role: 'HOSPITAL_ADMIN',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.createDepartment(req, {
        name: 'Cardiology',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockDepartment);
      expect(service.createDepartment).toHaveBeenCalledWith('hosp-1', {
        name: 'Cardiology',
      });
    });

    it('should throw BadRequestException if user has no hospitalId and none provided', async () => {
      const req = {
        user: {
          userId: 'user-1',
          role: 'SUPER_ADMIN',
          hospitalId: null,
        },
      } as unknown as Request;

      await expect(
        controller.createDepartment(req, { name: 'Cardiology' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getDepartments', () => {
    it('should return departments for user hospital', async () => {
      service.getDepartments.mockResolvedValue([mockDepartment]);

      const req = {
        user: {
          userId: 'user-1',
          role: 'DOCTOR',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.getDepartments(req);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockDepartment]);
      expect(service.getDepartments).toHaveBeenCalledWith('hosp-1');
    });
  });

  describe('getDepartmentById', () => {
    it('should return a department by id', async () => {
      service.getDepartmentById.mockResolvedValue(mockDepartment);

      const req = {
        user: {
          userId: 'user-1',
          role: 'DOCTOR',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.getDepartmentById('dept-1', req);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockDepartment);
      expect(service.getDepartmentById).toHaveBeenCalledWith(
        'dept-1',
        req.user,
      );
    });
  });

  describe('updateDepartment', () => {
    it('should update department', async () => {
      const updated = { ...mockDepartment, name: 'Cardiology Plus' };
      service.updateDepartment.mockResolvedValue(updated);

      const req = {
        user: {
          userId: 'user-1',
          role: 'HOSPITAL_ADMIN',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.updateDepartment('dept-1', req, {
        name: 'Cardiology Plus',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updated);
    });
  });

  describe('deleteDepartment', () => {
    it('should delete department', async () => {
      service.deleteDepartment.mockResolvedValue({
        message: 'Department deleted successfully',
      });

      const req = {
        user: {
          userId: 'user-1',
          role: 'HOSPITAL_ADMIN',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.deleteDepartment('dept-1', req);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Department deleted successfully');
    });
  });
});
