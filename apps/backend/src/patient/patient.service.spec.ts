import { Test, TestingModule } from '@nestjs/testing';
import { PatientService } from './patient.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.interface';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('mock_hashed_password'),
}));

describe('PatientService', () => {
  let service: PatientService;
  let prisma: {
    hospital: {
      findUnique: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    role: {
      findUnique: jest.Mock;
    };
    patient: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const adminCaller: AuthUser = {
    userId: 'admin-1',
    email: 'admin@apollo.com',
    roleId: 'role-admin',
    role: 'HOSPITAL_ADMIN',
    hospitalId: 'hosp-1',
  };

  const receptionistCaller: AuthUser = {
    userId: 'recep-1',
    email: 'recep@apollo.com',
    roleId: 'role-recep',
    role: 'RECEPTIONIST',
    hospitalId: 'hosp-1',
  };

  const superAdminCaller: AuthUser = {
    userId: 'super-1',
    email: 'super@medcore.com',
    roleId: 'role-super',
    role: 'SUPER_ADMIN',
    hospitalId: 'hosp-super',
  };

  const patientCaller: AuthUser = {
    userId: 'user-pat-1',
    email: 'patient1@apollo.com',
    roleId: 'role-pat',
    role: 'PATIENT',
    hospitalId: 'hosp-1',
  };

  const otherPatientCaller: AuthUser = {
    userId: 'user-pat-2',
    email: 'patient2@apollo.com',
    roleId: 'role-pat',
    role: 'PATIENT',
    hospitalId: 'hosp-1',
  };

  const mockHospital = {
    id: 'hosp-1',
    name: 'Apollo Hospital',
  };

  const mockPatientRole = {
    id: 'role-pat',
    name: 'PATIENT',
  };

  const mockPatient = {
    id: 'pat-1',
    userId: 'user-pat-1',
    hospitalId: 'hosp-1',
    dateOfBirth: new Date('1990-01-01'),
    gender: 'MALE',
    bloodGroup: 'O+',
    emergencyContactName: 'John Doe',
    emergencyContactPhone: '+91 9876543210',
    deletedAt: null,
    user: {
      id: 'user-pat-1',
      name: 'Alice Patient',
      email: 'patient1@apollo.com',
      phone: '+91 9123456780',
      hospitalId: 'hosp-1',
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    hospital: {
      id: 'hosp-1',
      name: 'Apollo Hospital',
    },
  };

  beforeEach(async () => {
    prisma = {
      hospital: {
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      role: {
        findUnique: jest.fn(),
      },
      patient: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<PatientService>(PatientService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =========================================================
  // CREATE PATIENT
  // =========================================================
  describe('createPatient', () => {
    it('should create user and patient profile atomically (Case B: New User)', async () => {
      prisma.hospital.findUnique.mockResolvedValue(mockHospital);
      prisma.user.findUnique.mockResolvedValue(null); // email uniqueness check
      prisma.role.findUnique.mockResolvedValue(mockPatientRole);

      prisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          user: {
            create: jest.fn().mockResolvedValue({
              id: 'user-pat-new',
              name: 'New Patient',
              email: 'newpat@apollo.com',
              phone: '+91 9888877777',
              hospitalId: 'hosp-1',
              roleId: 'role-pat',
            }),
          },
          patient: {
            create: jest.fn().mockResolvedValue(mockPatient),
          },
        });
      });

      const result = await service.createPatient(
        {
          name: 'New Patient',
          email: 'newpat@apollo.com',
          phone: '+91 9888877777',
          gender: 'MALE',
          bloodGroup: 'O+',
        },
        receptionistCaller,
      );

      expect(result).toEqual(mockPatient);
      expect(prisma.hospital.findUnique).toHaveBeenCalledWith({
        where: { id: 'hosp-1' },
      });
      expect(bcrypt.hash).toHaveBeenCalled();
    });

    it('should link to existing user with PATIENT role (Case A: Existing User)', async () => {
      prisma.hospital.findUnique.mockResolvedValue(mockHospital);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-pat-1',
        name: 'Alice Patient',
        email: 'patient1@apollo.com',
        hospitalId: 'hosp-1',
        role: { name: 'PATIENT' },
        patient: null,
      });
      prisma.patient.create.mockResolvedValue(mockPatient);

      const result = await service.createPatient(
        {
          userId: 'user-pat-1',
          gender: 'FEMALE',
          bloodGroup: 'A+',
        },
        adminCaller,
      );

      expect(result).toEqual(mockPatient);
      expect(prisma.patient.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if hospital does not exist', async () => {
      prisma.hospital.findUnique.mockResolvedValue(null);

      await expect(
        service.createPatient(
          { name: 'Patient', email: 'pat@example.com' },
          adminCaller,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if email is already registered', async () => {
      prisma.hospital.findUnique.mockResolvedValue(mockHospital);
      prisma.user.findUnique.mockResolvedValue({
        id: 'existing-id',
        email: 'pat@example.com',
      });

      await expect(
        service.createPatient(
          { name: 'Patient', email: 'pat@example.com' },
          adminCaller,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if existing user does not have PATIENT role', async () => {
      prisma.hospital.findUnique.mockResolvedValue(mockHospital);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-doc-1',
        hospitalId: 'hosp-1',
        role: { name: 'DOCTOR' },
        patient: null,
      });

      await expect(
        service.createPatient({ userId: 'user-doc-1' }, adminCaller),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if existing user belongs to another hospital', async () => {
      prisma.hospital.findUnique.mockResolvedValue(mockHospital);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-pat-other',
        hospitalId: 'hosp-different',
        role: { name: 'PATIENT' },
        patient: null,
      });

      await expect(
        service.createPatient({ userId: 'user-pat-other' }, adminCaller),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if existing user already has a patient profile', async () => {
      prisma.hospital.findUnique.mockResolvedValue(mockHospital);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-pat-1',
        hospitalId: 'hosp-1',
        role: { name: 'PATIENT' },
        patient: { id: 'pat-existing', deletedAt: null },
      });

      await expect(
        service.createPatient({ userId: 'user-pat-1' }, adminCaller),
      ).rejects.toThrow(ConflictException);
    });
  });

  // =========================================================
  // GET PATIENTS (LIST)
  // =========================================================
  describe('getPatients', () => {
    it('should filter patients by caller hospital and exclude soft-deleted records', async () => {
      prisma.patient.findMany.mockResolvedValue([mockPatient]);

      const result = await service.getPatients({}, adminCaller);

      expect(result).toEqual([mockPatient]);
      expect(prisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            hospitalId: 'hosp-1',
            deletedAt: null,
          }),
        }),
      );
    });

    it('should allow SUPER_ADMIN to query specific hospitalId', async () => {
      prisma.patient.findMany.mockResolvedValue([mockPatient]);

      await service.getPatients({ hospitalId: 'hosp-999' }, superAdminCaller);

      expect(prisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            hospitalId: 'hosp-999',
            deletedAt: null,
          }),
        }),
      );
    });

    it('should apply search filter across name, email, phone, and emergency contact', async () => {
      prisma.patient.findMany.mockResolvedValue([mockPatient]);

      await service.getPatients({ search: 'Alice' }, adminCaller);

      expect(prisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            hospitalId: 'hosp-1',
            deletedAt: null,
            OR: expect.arrayContaining([
              { user: { name: { contains: 'Alice', mode: 'insensitive' } } },
              { user: { email: { contains: 'Alice', mode: 'insensitive' } } },
            ]),
          }),
        }),
      );
    });
  });

  // =========================================================
  // GET PATIENT BY ID
  // =========================================================
  describe('getPatientById', () => {
    it('should return patient when found and belongs to caller hospital', async () => {
      prisma.patient.findUnique.mockResolvedValue(mockPatient);

      const result = await service.getPatientById('pat-1', adminCaller);

      expect(result).toEqual(mockPatient);
    });

    it('should throw NotFoundException if patient does not exist', async () => {
      prisma.patient.findUnique.mockResolvedValue(null);

      await expect(
        service.getPatientById('unknown-id', adminCaller),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if patient is soft-deleted', async () => {
      prisma.patient.findUnique.mockResolvedValue({
        ...mockPatient,
        deletedAt: new Date(),
      });

      await expect(
        service.getPatientById('pat-1', adminCaller),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if patient belongs to another hospital', async () => {
      prisma.patient.findUnique.mockResolvedValue({
        ...mockPatient,
        hospitalId: 'hosp-other',
      });

      await expect(
        service.getPatientById('pat-1', adminCaller),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow SUPER_ADMIN to view patient from any hospital', async () => {
      prisma.patient.findUnique.mockResolvedValue({
        ...mockPatient,
        hospitalId: 'hosp-other',
      });

      const result = await service.getPatientById('pat-1', superAdminCaller);
      expect(result).toBeDefined();
    });

    it('should allow PATIENT role to access their own record', async () => {
      prisma.patient.findUnique.mockResolvedValue(mockPatient);

      const result = await service.getPatientById('pat-1', patientCaller);
      expect(result).toEqual(mockPatient);
    });

    it('should throw ForbiddenException if PATIENT role attempts to access another patient', async () => {
      prisma.patient.findUnique.mockResolvedValue(mockPatient);

      await expect(
        service.getPatientById('pat-1', otherPatientCaller),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // =========================================================
  // GET CURRENT PATIENT (ME)
  // =========================================================
  describe('getCurrentPatient', () => {
    it('should return current user patient profile', async () => {
      prisma.patient.findFirst.mockResolvedValue(mockPatient);

      const result = await service.getCurrentPatient(patientCaller);

      expect(result).toEqual(mockPatient);
      expect(prisma.patient.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user-pat-1',
            deletedAt: null,
          },
        }),
      );
    });

    it('should throw NotFoundException if profile does not exist', async () => {
      prisma.patient.findFirst.mockResolvedValue(null);

      await expect(
        service.getCurrentPatient(patientCaller),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================
  // UPDATE PATIENT
  // =========================================================
  describe('updatePatient', () => {
    it('should allow staff to update patient and user details', async () => {
      prisma.patient.findUnique.mockResolvedValue(mockPatient);
      const updatedPatient = {
        ...mockPatient,
        bloodGroup: 'B+',
        user: { ...mockPatient.user, name: 'Alice Updated' },
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          user: { update: jest.fn().mockResolvedValue(updatedPatient.user) },
          patient: { update: jest.fn().mockResolvedValue(updatedPatient) },
        });
      });

      const result = await service.updatePatient(
        'pat-1',
        { name: 'Alice Updated', bloodGroup: 'B+' },
        adminCaller,
      );

      expect(result).toEqual(updatedPatient);
    });

    it('should allow PATIENT role to update their own record', async () => {
      prisma.patient.findUnique.mockResolvedValue(mockPatient);
      const updatedPatient = {
        ...mockPatient,
        emergencyContactName: 'Jane Doe',
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          user: { update: jest.fn() },
          patient: { update: jest.fn().mockResolvedValue(updatedPatient) },
        });
      });

      const result = await service.updatePatient(
        'pat-1',
        { emergencyContactName: 'Jane Doe' },
        patientCaller,
      );

      expect(result).toEqual(updatedPatient);
    });

    it('should throw ForbiddenException if caller has no permission to update', async () => {
      prisma.patient.findUnique.mockResolvedValue(mockPatient);

      const doctorCaller: AuthUser = {
        userId: 'doc-1',
        email: 'doc@apollo.com',
        roleId: 'role-doc',
        role: 'DOCTOR',
        hospitalId: 'hosp-1',
      };

      await expect(
        service.updatePatient('pat-1', { bloodGroup: 'AB+' }, doctorCaller),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // =========================================================
  // SOFT DELETE PATIENT
  // =========================================================
  describe('deletePatient', () => {
    it('should soft delete patient by setting deletedAt', async () => {
      prisma.patient.findUnique.mockResolvedValue(mockPatient);
      prisma.patient.update.mockResolvedValue({
        ...mockPatient,
        deletedAt: new Date(),
      });

      const result = await service.deletePatient('pat-1', adminCaller);

      expect(result.message).toContain('deactivated');
      expect(prisma.patient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pat-1' },
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should throw ForbiddenException if non-admin tries to delete', async () => {
      prisma.patient.findUnique.mockResolvedValue(mockPatient);

      await expect(
        service.deletePatient('pat-1', receptionistCaller),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if HOSPITAL_ADMIN deletes patient from another hospital', async () => {
      prisma.patient.findUnique.mockResolvedValue({
        ...mockPatient,
        hospitalId: 'hosp-different',
      });

      await expect(
        service.deletePatient('pat-1', adminCaller),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
