import { Test, TestingModule } from '@nestjs/testing';
import { MedicineService } from './medicine.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.interface';

describe('MedicineService', () => {
  let service: MedicineService;
  let prisma: {
    hospital: {
      findUnique: jest.Mock;
    };
    medicine: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    medicineBatch: {
      findFirst: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
    };
  };

  const pharmacistCaller: AuthUser = {
    userId: 'user-pharm-1',
    email: 'pharm@apollo.com',
    roleId: 'role-pharm',
    role: 'PHARMACIST',
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
    userId: 'user-pharm-2',
    email: 'other@fortis.com',
    roleId: 'role-pharm',
    role: 'PHARMACIST',
    hospitalId: 'hosp-2',
  };

  const mockMedicine = {
    id: 'med-1',
    hospitalId: 'hosp-1',
    name: 'Paracetamol',
    form: 'TABLET',
    description: 'Antipyretic and analgesic',
    reorderLevel: 20,
    hospital: { id: 'hosp-1', name: 'Apollo Hospital' },
    batches: [
      {
        id: 'batch-1',
        medicineId: 'med-1',
        batchNumber: 'BATCH-2026-001',
        expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 180), // 180 days in future
        quantity: 100,
        unitCost: 1.5,
        mrp: 3.0,
      },
      {
        id: 'batch-expired',
        medicineId: 'med-1',
        batchNumber: 'BATCH-2025-000',
        expiryDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30), // 30 days expired
        quantity: 50,
        unitCost: 1.5,
        mrp: 3.0,
      },
    ],
  };

  beforeEach(async () => {
    prisma = {
      hospital: {
        findUnique: jest.fn(),
      },
      medicine: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      medicineBatch: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MedicineService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<MedicineService>(MedicineService);
  });

  describe('createMedicine', () => {
    it('creates medicine successfully for hospital staff', async () => {
      prisma.hospital.findUnique.mockResolvedValue({ id: 'hosp-1', name: 'Apollo Hospital' });
      prisma.medicine.findFirst.mockResolvedValue(null);
      prisma.medicine.create.mockResolvedValue(mockMedicine);

      const result = await service.createMedicine(
        {
          name: 'Paracetamol',
          form: 'Tablet',
          description: 'Antipyretic',
          reorderLevel: 20,
        },
        pharmacistCaller,
      );

      expect(prisma.medicine.create).toHaveBeenCalledWith({
        data: {
          hospitalId: 'hosp-1',
          name: 'Paracetamol',
          form: 'TABLET',
          description: 'Antipyretic',
          reorderLevel: 20,
        },
        include: {
          hospital: { select: { id: true, name: true } },
        },
      });
      expect(result).toEqual(mockMedicine);
    });

    it('rejects duplicate medicine name and form within the same hospital', async () => {
      prisma.hospital.findUnique.mockResolvedValue({ id: 'hosp-1' });
      prisma.medicine.findFirst.mockResolvedValue(mockMedicine);

      await expect(
        service.createMedicine(
          { name: 'Paracetamol', form: 'TABLET' },
          pharmacistCaller,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException if hospital does not exist', async () => {
      prisma.hospital.findUnique.mockResolvedValue(null);

      await expect(
        service.createMedicine(
          { name: 'Amoxicillin', form: 'CAPSULE' },
          pharmacistCaller,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMedicines', () => {
    it('returns medicines scoped to caller hospital with totalStock and hasValidStock calculated', async () => {
      prisma.medicine.findMany.mockResolvedValue([mockMedicine]);

      const result = await service.getMedicines({}, pharmacistCaller);

      expect(prisma.medicine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { hospitalId: 'hosp-1' },
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].totalStock).toBe(100); // Only non-expired batch counted
      expect(result[0].hasValidStock).toBe(true);
    });

    it('allows SUPER_ADMIN to filter by arbitrary hospitalId', async () => {
      prisma.medicine.findMany.mockResolvedValue([]);

      await service.getMedicines({ hospitalId: 'hosp-2' }, superAdminCaller);

      expect(prisma.medicine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { hospitalId: 'hosp-2' },
        }),
      );
    });
  });

  describe('getMedicineById', () => {
    it('returns medicine details for authorized caller', async () => {
      prisma.medicine.findUnique.mockResolvedValue(mockMedicine);

      const result = await service.getMedicineById('med-1', pharmacistCaller);

      expect(result.id).toBe('med-1');
      expect(result.totalStock).toBe(100);
      expect(result.hasValidStock).toBe(true);
    });

    it('throws NotFoundException if medicine does not exist', async () => {
      prisma.medicine.findUnique.mockResolvedValue(null);

      await expect(
        service.getMedicineById('non-existent', pharmacistCaller),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if caller belongs to another hospital', async () => {
      prisma.medicine.findUnique.mockResolvedValue(mockMedicine);

      await expect(
        service.getMedicineById('med-1', otherHospitalCaller),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateMedicine', () => {
    it('allows HOSPITAL_ADMIN and PHARMACIST to update medicine', async () => {
      prisma.medicine.findUnique.mockResolvedValue(mockMedicine);
      prisma.medicine.findFirst.mockResolvedValue(null);
      prisma.medicine.update.mockResolvedValue({
        ...mockMedicine,
        description: 'Updated description',
      });

      const result = await service.updateMedicine(
        'med-1',
        { description: 'Updated description' },
        adminCaller,
      );

      expect(result.description).toBe('Updated description');
    });

    it('rejects unauthorized roles from updating medicine', async () => {
      prisma.medicine.findUnique.mockResolvedValue(mockMedicine);

      await expect(
        service.updateMedicine('med-1', { reorderLevel: 30 }, doctorCaller),
      ).rejects.toThrow(ForbiddenException);
    });

    it('prevents update to a duplicate name and form in same hospital', async () => {
      prisma.medicine.findUnique.mockResolvedValue(mockMedicine);
      prisma.medicine.findFirst.mockResolvedValue({ id: 'med-2', name: 'Ibuprofen' });

      await expect(
        service.updateMedicine(
          'med-1',
          { name: 'Ibuprofen', form: 'TABLET' },
          pharmacistCaller,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('createBatch', () => {
    it('creates batch for valid medicine and role', async () => {
      prisma.medicine.findUnique.mockResolvedValue(mockMedicine);
      prisma.medicineBatch.findFirst.mockResolvedValue(null);
      prisma.medicineBatch.create.mockResolvedValue({
        id: 'batch-new',
        medicineId: 'med-1',
        batchNumber: 'BATCH-2026-002',
        quantity: 200,
      });

      const result = await service.createBatch(
        'med-1',
        {
          batchNumber: 'BATCH-2026-002',
          expiryDate: '2026-12-31T00:00:00.000Z',
          quantity: 200,
          unitCost: 2.0,
          mrp: 4.0,
        },
        pharmacistCaller,
      );

      expect(result.id).toBe('batch-new');
      expect(prisma.medicineBatch.create).toHaveBeenCalled();
    });

    it('rejects duplicate batch number for the same medicine', async () => {
      prisma.medicine.findUnique.mockResolvedValue(mockMedicine);
      prisma.medicineBatch.findFirst.mockResolvedValue({ id: 'batch-exist' });

      await expect(
        service.createBatch(
          'med-1',
          {
            batchNumber: 'BATCH-2026-001',
            expiryDate: '2026-12-31T00:00:00.000Z',
            quantity: 50,
            unitCost: 2.0,
            mrp: 4.0,
          },
          pharmacistCaller,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getBatches', () => {
    it('returns batches for medicine ordered by expiry date', async () => {
      prisma.medicine.findUnique.mockResolvedValue(mockMedicine);
      prisma.medicineBatch.findMany.mockResolvedValue(mockMedicine.batches);

      const batches = await service.getBatches('med-1', doctorCaller);

      expect(batches).toHaveLength(2);
      expect(prisma.medicineBatch.findMany).toHaveBeenCalledWith({
        where: { medicineId: 'med-1' },
        orderBy: { expiryDate: 'asc' },
      });
    });
  });
});
