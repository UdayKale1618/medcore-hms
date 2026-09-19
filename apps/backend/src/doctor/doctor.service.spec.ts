import { Test, TestingModule } from '@nestjs/testing';
import { DoctorService } from './doctor.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.interface';

describe('DoctorService', () => {
  let service: DoctorService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
    };
    department: {
      findUnique: jest.Mock;
    };
    doctor: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  const adminCaller: AuthUser = {
    userId: 'admin-1',
    email: 'admin@apollo.com',
    roleId: 'role-admin',
    role: 'HOSPITAL_ADMIN',
    hospitalId: 'hosp-1',
  };

  const superAdminCaller: AuthUser = {
    userId: 'super-1',
    email: 'super@medcore.com',
    roleId: 'role-super',
    role: 'SUPER_ADMIN',
    hospitalId: 'hosp-super',
  };

  const doctorUser = {
    id: 'user-doc-1',
    name: 'Dr. House',
    email: 'house@apollo.com',
    hospitalId: 'hosp-1',
    role: { name: 'DOCTOR' },
    hospital: { id: 'hosp-1', name: 'Apollo Hospital' },
  };

  const department = {
    id: 'dept-1',
    name: 'Diagnostics',
    hospitalId: 'hosp-1',
  };

  const mockDoctor = {
    id: 'doc-1',
    userId: 'user-doc-1',
    departmentId: 'dept-1',
    specialization: 'Internal Medicine',
    licenseNumber: 'DOC-12345',
    consultationFee: 500,
    deletedAt: null,
    user: {
      id: 'user-doc-1',
      name: 'Dr. House',
      email: 'house@apollo.com',
      phone: '+91 9999999999',
      hospitalId: 'hosp-1',
    },
    department: {
      id: 'dept-1',
      name: 'Diagnostics',
    },
    availability: [],
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
      department: {
        findUnique: jest.fn(),
      },
      doctor: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DoctorService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<DoctorService>(DoctorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =========================================================
  // createDoctor
  // =========================================================
  describe('createDoctor', () => {
    it('should create a doctor profile successfully', async () => {
      prisma.user.findUnique.mockResolvedValue(doctorUser);
      prisma.department.findUnique.mockResolvedValue(department);
      prisma.doctor.findUnique
        .mockResolvedValueOnce(null) // existing check
        .mockResolvedValueOnce(null); // license check
      prisma.doctor.create.mockResolvedValue(mockDoctor);

      const result = await service.createDoctor(
        {
          userId: 'user-doc-1',
          departmentId: 'dept-1',
          specialization: 'Internal Medicine',
          licenseNumber: 'DOC-12345',
          consultationFee: 500,
        },
        adminCaller,
      );

      expect(result).toEqual(mockDoctor);
      expect(prisma.doctor.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user is not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createDoctor(
          { userId: 'unknown-user', departmentId: 'dept-1' },
          adminCaller,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if user role is not DOCTOR', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...doctorUser,
        role: { name: 'PATIENT' },
      });

      await expect(
        service.createDoctor(
          { userId: 'user-doc-1', departmentId: 'dept-1' },
          adminCaller,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if user belongs to another hospital', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...doctorUser,
        hospitalId: 'hosp-2',
      });

      await expect(
        service.createDoctor(
          { userId: 'user-doc-1', departmentId: 'dept-1' },
          adminCaller,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if department is not found', async () => {
      prisma.user.findUnique.mockResolvedValue(doctorUser);
      prisma.department.findUnique.mockResolvedValue(null);

      await expect(
        service.createDoctor(
          { userId: 'user-doc-1', departmentId: 'non-existent' },
          adminCaller,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if department belongs to a different hospital than the user', async () => {
      prisma.user.findUnique.mockResolvedValue(doctorUser);
      prisma.department.findUnique.mockResolvedValue({
        ...department,
        hospitalId: 'hosp-other',
      });

      await expect(
        service.createDoctor(
          { userId: 'user-doc-1', departmentId: 'dept-1' },
          adminCaller,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if user already has a doctor profile', async () => {
      prisma.user.findUnique.mockResolvedValue(doctorUser);
      prisma.department.findUnique.mockResolvedValue(department);
      prisma.doctor.findUnique.mockResolvedValue(mockDoctor);

      await expect(
        service.createDoctor(
          { userId: 'user-doc-1', departmentId: 'dept-1' },
          adminCaller,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if licenseNumber already exists', async () => {
      prisma.user.findUnique.mockResolvedValue(doctorUser);
      prisma.department.findUnique.mockResolvedValue(department);
      prisma.doctor.findUnique
        .mockResolvedValueOnce(null) // existing user check
        .mockResolvedValueOnce(mockDoctor); // license check

      await expect(
        service.createDoctor(
          {
            userId: 'user-doc-1',
            departmentId: 'dept-1',
            licenseNumber: 'DOC-12345',
          },
          adminCaller,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  // =========================================================
  // getDoctors
  // =========================================================
  describe('getDoctors', () => {
    it('should return doctors filtered by caller hospital and deletedAt: null', async () => {
      prisma.doctor.findMany.mockResolvedValue([mockDoctor]);

      const result = await service.getDoctors({}, adminCaller);

      expect(result).toEqual([mockDoctor]);
      expect(prisma.doctor.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          user: { hospitalId: 'hosp-1' },
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should allow SUPER_ADMIN to query specific hospitalId', async () => {
      prisma.doctor.findMany.mockResolvedValue([mockDoctor]);

      await service.getDoctors({ hospitalId: 'hosp-99' }, superAdminCaller);

      expect(prisma.doctor.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          user: { hospitalId: 'hosp-99' },
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  // =========================================================
  // getDoctorById
  // =========================================================
  describe('getDoctorById', () => {
    it('should return doctor when found and tenant matches', async () => {
      prisma.doctor.findUnique.mockResolvedValue(mockDoctor);

      const result = await service.getDoctorById('doc-1', adminCaller);

      expect(result).toEqual(mockDoctor);
    });

    it('should allow SUPER_ADMIN across different hospital', async () => {
      prisma.doctor.findUnique.mockResolvedValue(mockDoctor);

      const result = await service.getDoctorById('doc-1', superAdminCaller);

      expect(result).toEqual(mockDoctor);
    });

    it('should throw ForbiddenException if doctor belongs to another hospital', async () => {
      prisma.doctor.findUnique.mockResolvedValue({
        ...mockDoctor,
        user: { ...mockDoctor.user, hospitalId: 'hosp-other' },
      });

      await expect(
        service.getDoctorById('doc-1', adminCaller),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if doctor does not exist or is soft-deleted', async () => {
      prisma.doctor.findUnique.mockResolvedValue({
        ...mockDoctor,
        deletedAt: new Date(),
      });

      await expect(
        service.getDoctorById('doc-1', adminCaller),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================
  // updateDoctor
  // =========================================================
  describe('updateDoctor', () => {
    it('should update doctor specialization and consultationFee', async () => {
      prisma.doctor.findUnique.mockResolvedValue(mockDoctor);
      prisma.doctor.update.mockResolvedValue({
        ...mockDoctor,
        specialization: 'Neurology',
        consultationFee: 700,
      });

      const result = await service.updateDoctor(
        'doc-1',
        { specialization: 'Neurology', consultationFee: 700 },
        adminCaller,
      );

      expect(result.specialization).toBe('Neurology');
    });

    it('should throw ConflictException if new licenseNumber already in use', async () => {
      prisma.doctor.findUnique.mockResolvedValue(mockDoctor);
      prisma.doctor.findFirst.mockResolvedValue({ id: 'doc-other', licenseNumber: 'TAKEN' });

      await expect(
        service.updateDoctor(
          'doc-1',
          { licenseNumber: 'TAKEN' },
          adminCaller,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  // =========================================================
  // deleteDoctor (soft delete)
  // =========================================================
  describe('deleteDoctor', () => {
    it('should soft delete doctor by setting deletedAt', async () => {
      prisma.doctor.findUnique.mockResolvedValue(mockDoctor);
      prisma.doctor.update.mockResolvedValue({
        ...mockDoctor,
        deletedAt: new Date(),
      });

      const result = await service.deleteDoctor('doc-1', adminCaller);

      expect(result.message).toBe('Doctor profile deactivated successfully');
      expect(prisma.doctor.update).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should throw ForbiddenException if caller is not an admin', async () => {
      prisma.doctor.findUnique.mockResolvedValue(mockDoctor);

      const doctorCaller: AuthUser = {
        userId: 'user-doc-1',
        email: 'house@apollo.com',
        roleId: 'role-doc',
        role: 'DOCTOR',
        hospitalId: 'hosp-1',
      };

      await expect(
        service.deleteDoctor('doc-1', doctorCaller),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
