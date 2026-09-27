import { Test, TestingModule } from '@nestjs/testing';
import { LabTestService } from './lab-test.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.interface';

describe('LabTestService', () => {
  let service: LabTestService;
  let prisma: {
    hospital: {
      findUnique: jest.Mock;
    };
    labTest: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  const labTechCaller: AuthUser = {
    userId: 'user-tech-1',
    email: 'tech@apollo.com',
    roleId: 'role-tech',
    role: 'LAB_TECHNICIAN',
    hospitalId: 'hosp-1',
  };

  const adminCaller: AuthUser = {
    userId: 'user-admin-1',
    email: 'admin@apollo.com',
    roleId: 'role-admin',
    role: 'HOSPITAL_ADMIN',
    hospitalId: 'hosp-1',
  };

  const doctorCaller: AuthUser = {
    userId: 'user-doc-1',
    email: 'doc@apollo.com',
    roleId: 'role-doc',
    role: 'DOCTOR',
    hospitalId: 'hosp-1',
  };

  const superAdminCaller: AuthUser = {
    userId: 'user-super-1',
    email: 'super@medcore.com',
    roleId: 'role-super',
    role: 'SUPER_ADMIN',
    hospitalId: 'hosp-super',
  };

  const otherHospitalCaller: AuthUser = {
    userId: 'user-tech-2',
    email: 'tech@fortis.com',
    roleId: 'role-tech',
    role: 'LAB_TECHNICIAN',
    hospitalId: 'hosp-2',
  };

  const mockLabTest = {
    id: 'test-1',
    hospitalId: 'hosp-1',
    name: 'Complete Blood Count',
    description: 'Measures several components and features of blood',
    unit: 'cells/mcL',
    referenceMin: 4.5,
    referenceMax: 11.0,
    hospital: { id: 'hosp-1', name: 'Apollo Hospital' },
  };

  beforeEach(async () => {
    prisma = {
      hospital: {
        findUnique: jest.fn(),
      },
      labTest: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LabTestService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<LabTestService>(LabTestService);
  });

  describe('createLabTest', () => {
    it('creates a lab test successfully', async () => {
      prisma.hospital.findUnique.mockResolvedValue({ id: 'hosp-1' });
      prisma.labTest.findFirst.mockResolvedValue(null);
      prisma.labTest.create.mockResolvedValue(mockLabTest);

      const result = await service.createLabTest(
        {
          name: 'Complete Blood Count',
          description: 'Blood test',
          unit: 'cells/mcL',
          referenceMin: 4.5,
          referenceMax: 11.0,
        },
        labTechCaller,
      );

      expect(prisma.labTest.create).toHaveBeenCalledWith({
        data: {
          hospitalId: 'hosp-1',
          name: 'Complete Blood Count',
          description: 'Blood test',
          unit: 'cells/mcL',
          referenceMin: 4.5,
          referenceMax: 11.0,
        },
        include: { hospital: { select: { id: true, name: true } } },
      });
      expect(result).toEqual(mockLabTest);
    });

    it('rejects duplicate test name within the hospital', async () => {
      prisma.hospital.findUnique.mockResolvedValue({ id: 'hosp-1' });
      prisma.labTest.findFirst.mockResolvedValue(mockLabTest);

      await expect(
        service.createLabTest({ name: 'Complete Blood Count' }, labTechCaller),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException if hospital does not exist', async () => {
      prisma.hospital.findUnique.mockResolvedValue(null);

      await expect(
        service.createLabTest({ name: 'Lipid Panel' }, labTechCaller),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getLabTests', () => {
    it('returns hospital-scoped and global tests', async () => {
      prisma.labTest.findMany.mockResolvedValue([mockLabTest]);

      const result = await service.getLabTests({}, labTechCaller);

      expect(prisma.labTest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [{ hospitalId: 'hosp-1' }, { hospitalId: null }],
          },
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('allows SUPER_ADMIN to filter across hospitals', async () => {
      prisma.labTest.findMany.mockResolvedValue([]);

      await service.getLabTests({ hospitalId: 'hosp-2' }, superAdminCaller);

      expect(prisma.labTest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { hospitalId: 'hosp-2' },
        }),
      );
    });
  });

  describe('getLabTestById', () => {
    it('returns lab test for authorized caller', async () => {
      prisma.labTest.findUnique.mockResolvedValue(mockLabTest);

      const result = await service.getLabTestById('test-1', labTechCaller);

      expect(result.id).toBe('test-1');
    });

    it('throws NotFoundException if test does not exist', async () => {
      prisma.labTest.findUnique.mockResolvedValue(null);

      await expect(
        service.getLabTestById('non-existent', labTechCaller),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if test belongs to another hospital', async () => {
      prisma.labTest.findUnique.mockResolvedValue(mockLabTest);

      await expect(
        service.getLabTestById('test-1', otherHospitalCaller),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateLabTest', () => {
    it('allows LAB_TECHNICIAN and HOSPITAL_ADMIN to update test', async () => {
      prisma.labTest.findUnique.mockResolvedValue(mockLabTest);
      prisma.labTest.findFirst.mockResolvedValue(null);
      prisma.labTest.update.mockResolvedValue({
        ...mockLabTest,
        description: 'Updated description',
      });

      const result = await service.updateLabTest(
        'test-1',
        { description: 'Updated description' },
        adminCaller,
      );

      expect(result.description).toBe('Updated description');
    });

    it('blocks DOCTOR from updating lab tests (ForbiddenException)', async () => {
      prisma.labTest.findUnique.mockResolvedValue(mockLabTest);

      await expect(
        service.updateLabTest('test-1', { unit: 'mg/dL' }, doctorCaller),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
