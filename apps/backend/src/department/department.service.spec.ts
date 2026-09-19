import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentService } from './department.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.interface';

describe('DepartmentService', () => {
  let service: DepartmentService;
  let prisma: {
    hospital: {
      findUnique: jest.Mock;
    };
    department: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    doctor: {
      count: jest.Mock;
    };
  };

  const mockDepartment = {
    id: 'dept-1',
    name: 'Cardiology',
    hospitalId: 'hosp-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    hospital: {
      id: 'hosp-1',
      name: 'City Hospital',
    },
    _count: {
      doctors: 3,
      appointments: 10,
    },
  };

  const adminUser: AuthUser = {
    userId: 'user-admin',
    email: 'admin@cityhospital.com',
    roleId: 'role-admin',
    role: 'HOSPITAL_ADMIN',
    hospitalId: 'hosp-1',
  };

  const superAdminUser: AuthUser = {
    userId: 'user-super',
    email: 'super@medcore.com',
    roleId: 'role-super',
    role: 'SUPER_ADMIN',
    hospitalId: 'hosp-super',
  };

  const otherHospitalUser: AuthUser = {
    userId: 'user-other',
    email: 'other@otherhospital.com',
    roleId: 'role-other',
    role: 'HOSPITAL_ADMIN',
    hospitalId: 'hosp-2',
  };

  beforeEach(async () => {
    prisma = {
      hospital: {
        findUnique: jest.fn(),
      },
      department: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      doctor: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<DepartmentService>(DepartmentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =========================================================
  // createDepartment
  // =========================================================
  describe('createDepartment', () => {
    it('should create a department when valid', async () => {
      prisma.hospital.findUnique.mockResolvedValue({ id: 'hosp-1', name: 'City Hospital' });
      prisma.department.findFirst.mockResolvedValue(null);
      prisma.department.create.mockResolvedValue(mockDepartment);

      const result = await service.createDepartment('hosp-1', { name: 'Cardiology' });

      expect(result).toEqual(mockDepartment);
      expect(prisma.department.create).toHaveBeenCalledWith({
        data: { name: 'Cardiology', hospitalId: 'hosp-1' },
        include: { hospital: { select: { id: true, name: true } } },
      });
    });

    it('should throw NotFoundException if hospital does not exist', async () => {
      prisma.hospital.findUnique.mockResolvedValue(null);

      await expect(
        service.createDepartment('non-existent', { name: 'Cardiology' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if department name already exists in hospital', async () => {
      prisma.hospital.findUnique.mockResolvedValue({ id: 'hosp-1', name: 'City Hospital' });
      prisma.department.findFirst.mockResolvedValue(mockDepartment);

      await expect(
        service.createDepartment('hosp-1', { name: 'Cardiology' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // =========================================================
  // getDepartments
  // =========================================================
  describe('getDepartments', () => {
    it('should return departments filtered by hospitalId', async () => {
      prisma.department.findMany.mockResolvedValue([mockDepartment]);

      const result = await service.getDepartments('hosp-1');

      expect(result).toEqual([mockDepartment]);
      expect(prisma.department.findMany).toHaveBeenCalledWith({
        where: { hospitalId: 'hosp-1' },
        include: { _count: { select: { doctors: true, appointments: true } } },
        orderBy: { name: 'asc' },
      });
    });

    it('should return all departments when no hospitalId provided', async () => {
      prisma.department.findMany.mockResolvedValue([mockDepartment]);

      const result = await service.getDepartments();

      expect(result).toEqual([mockDepartment]);
      expect(prisma.department.findMany).toHaveBeenCalledWith({
        where: undefined,
        include: { _count: { select: { doctors: true, appointments: true } } },
        orderBy: { name: 'asc' },
      });
    });
  });

  // =========================================================
  // getDepartmentById
  // =========================================================
  describe('getDepartmentById', () => {
    it('should return department when user belongs to same hospital', async () => {
      prisma.department.findUnique.mockResolvedValue(mockDepartment);

      const result = await service.getDepartmentById('dept-1', adminUser);

      expect(result).toEqual(mockDepartment);
    });

    it('should return department when user is SUPER_ADMIN across different hospital', async () => {
      prisma.department.findUnique.mockResolvedValue(mockDepartment);

      const result = await service.getDepartmentById('dept-1', superAdminUser);

      expect(result).toEqual(mockDepartment);
    });

    it('should throw ForbiddenException when user belongs to different hospital', async () => {
      prisma.department.findUnique.mockResolvedValue(mockDepartment);

      await expect(
        service.getDepartmentById('dept-1', otherHospitalUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when department does not exist', async () => {
      prisma.department.findUnique.mockResolvedValue(null);

      await expect(
        service.getDepartmentById('non-existent', adminUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================
  // updateDepartment
  // =========================================================
  describe('updateDepartment', () => {
    it('should update department name successfully', async () => {
      prisma.department.findUnique.mockResolvedValue(mockDepartment);
      prisma.department.findFirst.mockResolvedValue(null); // No duplicate
      prisma.department.update.mockResolvedValue({
        ...mockDepartment,
        name: 'Neurology',
      });

      const result = await service.updateDepartment(
        'dept-1',
        { name: 'Neurology' },
        adminUser,
      );

      expect(result.name).toBe('Neurology');
      expect(prisma.department.update).toHaveBeenCalledWith({
        where: { id: 'dept-1' },
        data: { name: 'Neurology' },
        include: { hospital: { select: { id: true, name: true } } },
      });
    });

    it('should throw ConflictException if new name already exists in same hospital', async () => {
      prisma.department.findUnique.mockResolvedValue(mockDepartment);
      prisma.department.findFirst.mockResolvedValue({
        id: 'dept-2',
        name: 'Neurology',
        hospitalId: 'hosp-1',
      });

      await expect(
        service.updateDepartment('dept-1', { name: 'Neurology' }, adminUser),
      ).rejects.toThrow(ConflictException);
    });
  });

  // =========================================================
  // deleteDepartment
  // =========================================================
  describe('deleteDepartment', () => {
    it('should delete department when no active doctors assigned', async () => {
      prisma.department.findUnique.mockResolvedValue(mockDepartment);
      prisma.doctor.count.mockResolvedValue(0);
      prisma.department.delete.mockResolvedValue(mockDepartment);

      const result = await service.deleteDepartment('dept-1', adminUser);

      expect(result.message).toBe('Department deleted successfully');
      expect(prisma.department.delete).toHaveBeenCalledWith({ where: { id: 'dept-1' } });
    });

    it('should throw BadRequestException when active doctors are assigned', async () => {
      prisma.department.findUnique.mockResolvedValue(mockDepartment);
      prisma.doctor.count.mockResolvedValue(2);

      await expect(
        service.deleteDepartment('dept-1', adminUser),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
