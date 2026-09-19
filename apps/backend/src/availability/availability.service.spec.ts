import { Test, TestingModule } from '@nestjs/testing';
import { AvailabilityService } from './availability.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.interface';

describe('AvailabilityService', () => {
  let service: AvailabilityService;
  let prisma: {
    doctor: {
      findUnique: jest.Mock;
    };
    doctorAvailability: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const doctorCaller: AuthUser = {
    userId: 'user-doc-1',
    email: 'house@apollo.com',
    roleId: 'role-doc',
    role: 'DOCTOR',
    hospitalId: 'hosp-1',
  };

  const adminCaller: AuthUser = {
    userId: 'admin-1',
    email: 'admin@apollo.com',
    roleId: 'role-admin',
    role: 'HOSPITAL_ADMIN',
    hospitalId: 'hosp-1',
  };

  const otherHospitalCaller: AuthUser = {
    userId: 'admin-2',
    email: 'admin@other.com',
    roleId: 'role-admin',
    role: 'HOSPITAL_ADMIN',
    hospitalId: 'hosp-2',
  };

  const unauthorizedCaller: AuthUser = {
    userId: 'pat-1',
    email: 'patient@apollo.com',
    roleId: 'role-patient',
    role: 'PATIENT',
    hospitalId: 'hosp-1',
  };

  const mockDoctor = {
    id: 'doc-1',
    userId: 'user-doc-1',
    departmentId: 'dept-1',
    deletedAt: null,
    user: {
      id: 'user-doc-1',
      hospitalId: 'hosp-1',
    },
  };

  const mockAvailability = {
    id: 'avail-1',
    doctorId: 'doc-1',
    dayOfWeek: 1, // Monday
    startTime: '09:00',
    endTime: '13:00',
    slotMinutes: 30,
    doctor: mockDoctor,
  };

  beforeEach(async () => {
    prisma = {
      doctor: {
        findUnique: jest.fn(),
      },
      doctorAvailability: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<AvailabilityService>(AvailabilityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =========================================================
  // createAvailability
  // =========================================================
  describe('createAvailability', () => {
    it('should create an availability slot when valid', async () => {
      prisma.doctor.findUnique.mockResolvedValue(mockDoctor);
      prisma.doctorAvailability.findMany.mockResolvedValue([]);
      prisma.doctorAvailability.create.mockResolvedValue(mockAvailability);

      const result = await service.createAvailability(
        'doc-1',
        {
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '13:00',
          slotMinutes: 30,
        },
        doctorCaller,
      );

      expect(result).toEqual(mockAvailability);
      expect(prisma.doctorAvailability.create).toHaveBeenCalledWith({
        data: {
          doctorId: 'doc-1',
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '13:00',
          slotMinutes: 30,
        },
      });
    });

    it('should reject when startTime >= endTime (BadRequestException)', async () => {
      await expect(
        service.createAvailability(
          'doc-1',
          { dayOfWeek: 1, startTime: '15:00', endTime: '09:00' },
          doctorCaller,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when duration is less than slotMinutes', async () => {
      await expect(
        service.createAvailability(
          'doc-1',
          { dayOfWeek: 1, startTime: '09:00', endTime: '09:15', slotMinutes: 30 },
          doctorCaller,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if doctor does not exist', async () => {
      prisma.doctor.findUnique.mockResolvedValue(null);

      await expect(
        service.createAvailability(
          'doc-1',
          { dayOfWeek: 1, startTime: '09:00', endTime: '13:00' },
          doctorCaller,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if doctor belongs to another hospital', async () => {
      prisma.doctor.findUnique.mockResolvedValue(mockDoctor);

      await expect(
        service.createAvailability(
          'doc-1',
          { dayOfWeek: 1, startTime: '09:00', endTime: '13:00' },
          otherHospitalCaller,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if caller is unauthorized (e.g. PATIENT)', async () => {
      prisma.doctor.findUnique.mockResolvedValue(mockDoctor);

      await expect(
        service.createAvailability(
          'doc-1',
          { dayOfWeek: 1, startTime: '09:00', endTime: '13:00' },
          unauthorizedCaller,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if time range overlaps existing schedule', async () => {
      prisma.doctor.findUnique.mockResolvedValue(mockDoctor);
      prisma.doctorAvailability.findMany.mockResolvedValue([
        {
          id: 'existing-1',
          doctorId: 'doc-1',
          dayOfWeek: 1,
          startTime: '10:00',
          endTime: '12:00',
        },
      ]);

      await expect(
        service.createAvailability(
          'doc-1',
          { dayOfWeek: 1, startTime: '11:00', endTime: '14:00' },
          doctorCaller,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  // =========================================================
  // getDoctorAvailability
  // =========================================================
  describe('getDoctorAvailability', () => {
    it('should return availability list for doctor', async () => {
      prisma.doctor.findUnique.mockResolvedValue(mockDoctor);
      prisma.doctorAvailability.findMany.mockResolvedValue([mockAvailability]);

      const result = await service.getDoctorAvailability('doc-1', doctorCaller);

      expect(result).toEqual([mockAvailability]);
    });

    it('should throw ForbiddenException if doctor belongs to another hospital', async () => {
      prisma.doctor.findUnique.mockResolvedValue(mockDoctor);

      await expect(
        service.getDoctorAvailability('doc-1', otherHospitalCaller),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // =========================================================
  // updateAvailability
  // =========================================================
  describe('updateAvailability', () => {
    it('should update availability slot successfully', async () => {
      prisma.doctorAvailability.findUnique.mockResolvedValue(mockAvailability);
      prisma.doctorAvailability.findMany.mockResolvedValue([]);
      prisma.doctorAvailability.update.mockResolvedValue({
        ...mockAvailability,
        startTime: '10:00',
      });

      const result = await service.updateAvailability(
        'avail-1',
        { startTime: '10:00' },
        adminCaller,
      );

      expect(result.startTime).toBe('10:00');
    });

    it('should throw ConflictException if update creates an overlap', async () => {
      prisma.doctorAvailability.findUnique.mockResolvedValue(mockAvailability);
      prisma.doctorAvailability.findMany.mockResolvedValue([
        {
          id: 'other-slot',
          doctorId: 'doc-1',
          dayOfWeek: 1,
          startTime: '14:00',
          endTime: '16:00',
        },
      ]);

      await expect(
        service.updateAvailability(
          'avail-1',
          { endTime: '15:00' },
          doctorCaller,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  // =========================================================
  // deleteAvailability
  // =========================================================
  describe('deleteAvailability', () => {
    it('should delete availability slot successfully', async () => {
      prisma.doctorAvailability.findUnique.mockResolvedValue(mockAvailability);
      prisma.doctorAvailability.delete.mockResolvedValue(mockAvailability);

      const result = await service.deleteAvailability('avail-1', doctorCaller);

      expect(result.message).toBe('Availability schedule deleted successfully');
      expect(prisma.doctorAvailability.delete).toHaveBeenCalledWith({
        where: { id: 'avail-1' },
      });
    });

    it('should throw ForbiddenException if caller is unauthorized', async () => {
      prisma.doctorAvailability.findUnique.mockResolvedValue(mockAvailability);

      await expect(
        service.deleteAvailability('avail-1', unauthorizedCaller),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
