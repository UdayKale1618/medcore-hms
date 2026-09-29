import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PharmacyService } from './pharmacy.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import type { AuthUser } from '../auth/auth-user.interface';

describe('PharmacyService', () => {
  let service: PharmacyService;
  let prisma: any;
  let notificationService: any;

  const hospitalA = 'hosp-aaa-111';
  const hospitalB = 'hosp-bbb-222';

  const pharmacistCaller: AuthUser = {
    userId: 'u-pharm-1',
    email: 'pharm@apollo.com',
    roleId: 'role-pharm',
    role: 'PHARMACIST',
    hospitalId: hospitalA,
  };

  const doctorCaller: AuthUser = {
    userId: 'u-doc-1',
    email: 'doc@apollo.com',
    roleId: 'role-doc',
    role: 'DOCTOR',
    hospitalId: hospitalA,
  };

  const patientCaller: AuthUser = {
    userId: 'u-pat-1',
    email: 'pat@apollo.com',
    roleId: 'role-pat',
    role: 'PATIENT',
    hospitalId: hospitalA,
  };

  const otherHospitalPharmacist: AuthUser = {
    userId: 'u-pharm-2',
    email: 'pharm2@fortis.com',
    roleId: 'role-pharm',
    role: 'PHARMACIST',
    hospitalId: hospitalB,
  };

  const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

  beforeEach(async () => {
    prisma = {
      medicine: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      medicineBatch: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      prescription: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      prescriptionItem: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      patient: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((callback) => callback(prisma)),
    };

    notificationService = {
      dispatch: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PharmacyService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationService, useValue: notificationService },
      ],
    }).compile();

    service = module.get<PharmacyService>(PharmacyService);
  });

  describe('Inventory Lookup', () => {
    it('returns hospital-scoped inventory with available and expired stock breakdown', async () => {
      prisma.medicine.findMany.mockResolvedValue([
        {
          id: 'med-1',
          hospitalId: hospitalA,
          name: 'Paracetamol',
          form: 'TABLET',
          description: 'Pain relief',
          reorderLevel: 50,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { batches: 2, prescriptionItems: 5 },
          batches: [
            { quantity: 100, expiryDate: futureDate },
            { quantity: 20, expiryDate: pastDate },
          ],
        },
      ]);

      const result = await service.getInventory({}, pharmacistCaller);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Paracetamol');
      expect(result[0].totalStock).toBe(120);
      expect(result[0].availableStock).toBe(100);
      expect(result[0].expiredStock).toBe(20);
      expect(result[0].isLowStock).toBe(false);
    });

    it('filters low-stock medicines accurately', async () => {
      prisma.medicine.findMany.mockResolvedValue([
        {
          id: 'med-low',
          hospitalId: hospitalA,
          name: 'Insulin',
          form: 'INJECTION',
          reorderLevel: 20,
          isActive: true,
          _count: { batches: 1, prescriptionItems: 1 },
          batches: [{ quantity: 5, expiryDate: futureDate }],
        },
      ]);

      const result = await service.getInventory({ lowStock: true }, pharmacistCaller);
      expect(result).toHaveLength(1);
      expect(result[0].isLowStock).toBe(true);
    });

    it('rejects cross-hospital inventory access for single medicine', async () => {
      prisma.medicine.findUnique.mockResolvedValue({
        id: 'med-b',
        hospitalId: hospitalB,
        batches: [],
      });

      await expect(
        service.getMedicineInventory('med-b', pharmacistCaller),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Batches Lookup', () => {
    it('marks expired batches correctly', async () => {
      prisma.medicineBatch.findMany.mockResolvedValue([
        {
          id: 'batch-exp',
          medicineId: 'med-1',
          batchNumber: 'B-OLD',
          expiryDate: pastDate,
          quantity: 10,
          medicine: { hospitalId: hospitalA },
        },
      ]);

      const result = await service.getBatches({}, pharmacistCaller);
      expect(result[0].isExpired).toBe(true);
    });

    it('blocks other hospital from viewing batch details', async () => {
      prisma.medicineBatch.findUnique.mockResolvedValue({
        id: 'batch-1',
        medicine: { hospitalId: hospitalA },
        expiryDate: futureDate,
      });

      await expect(
        service.getBatchById('batch-1', otherHospitalPharmacist),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Dispensing & Expiry Protection (PRD Mandatory Requirement)', () => {
    const mockPrescription = {
      id: 'presc-1',
      status: 'PRESCRIBED',
      medicalRecord: {
        patient: {
          id: 'pat-1',
          hospitalId: hospitalA,
          userId: 'u-pat-1',
        },
      },
      items: [
        {
          id: 'pi-1',
          medicineId: 'med-1',
          dispensedQuantity: 0,
          medicine: {
            id: 'med-1',
            name: 'Amoxicillin',
            hospitalId: hospitalA,
            isActive: true,
          },
        },
      ],
    };

    it('CRITICAL: throws validation error when attempting to dispense an expired medicine batch', async () => {
      prisma.prescription.findUnique.mockResolvedValue(mockPrescription);
      prisma.medicineBatch.findUnique.mockResolvedValue({
        id: 'batch-expired',
        medicineId: 'med-1',
        batchNumber: 'EXP-999',
        expiryDate: pastDate, // EXPIRED
        quantity: 50,
        medicine: {
          id: 'med-1',
          name: 'Amoxicillin',
          hospitalId: hospitalA,
          isActive: true,
        },
      });

      await expect(
        service.dispense(
          {
            prescriptionId: 'presc-1',
            items: [
              {
                prescriptionItemId: 'pi-1',
                batchId: 'batch-expired',
                quantity: 10,
              },
            ],
          },
          pharmacistCaller,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects dispensing inactive medicine', async () => {
      prisma.prescription.findUnique.mockResolvedValue(mockPrescription);
      prisma.medicineBatch.findUnique.mockResolvedValue({
        id: 'batch-1',
        medicineId: 'med-1',
        batchNumber: 'BAT-100',
        expiryDate: futureDate,
        quantity: 50,
        medicine: {
          id: 'med-1',
          name: 'Amoxicillin',
          hospitalId: hospitalA,
          isActive: false, // INACTIVE
        },
      });

      await expect(
        service.dispense(
          {
            prescriptionId: 'presc-1',
            items: [
              {
                prescriptionItemId: 'pi-1',
                batchId: 'batch-1',
                quantity: 10,
              },
            ],
          },
          pharmacistCaller,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects dispensing with zero or insufficient stock', async () => {
      prisma.prescription.findUnique.mockResolvedValue(mockPrescription);
      prisma.medicineBatch.findUnique.mockResolvedValue({
        id: 'batch-1',
        medicineId: 'med-1',
        batchNumber: 'BAT-100',
        expiryDate: futureDate,
        quantity: 5, // only 5 available
        medicine: {
          id: 'med-1',
          name: 'Amoxicillin',
          hospitalId: hospitalA,
          isActive: true,
        },
      });

      await expect(
        service.dispense(
          {
            prescriptionId: 'presc-1',
            items: [
              {
                prescriptionItemId: 'pi-1',
                batchId: 'batch-1',
                quantity: 20, // requests 20
              },
            ],
          },
          pharmacistCaller,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects dispensing by unauthorized roles (Doctors, Patients)', async () => {
      await expect(
        service.dispense(
          {
            prescriptionId: 'presc-1',
            items: [{ prescriptionItemId: 'pi-1', batchId: 'batch-1', quantity: 10 }],
          },
          doctorCaller,
        ),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.dispense(
          {
            prescriptionId: 'presc-1',
            items: [{ prescriptionItemId: 'pi-1', batchId: 'batch-1', quantity: 10 }],
          },
          patientCaller,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('successfully dispenses medicine, decrements stock atomically, and updates fulfilment status', async () => {
      prisma.prescription.findUnique.mockResolvedValue(mockPrescription);
      prisma.medicineBatch.findUnique.mockResolvedValue({
        id: 'batch-valid',
        medicineId: 'med-1',
        batchNumber: 'BAT-VALID',
        expiryDate: futureDate,
        quantity: 100,
        medicine: {
          id: 'med-1',
          name: 'Amoxicillin',
          hospitalId: hospitalA,
          isActive: true,
        },
      });

      prisma.prescriptionItem.findMany.mockResolvedValue([
        { id: 'pi-1', prescriptionId: 'presc-1', dispensedQuantity: 10 },
      ]);

      prisma.prescription.update.mockResolvedValue({
        id: 'presc-1',
        status: 'FULFILLED',
        items: [{ id: 'pi-1', dispensedQuantity: 10 }],
      });

      const result = await service.dispense(
        {
          prescriptionId: 'presc-1',
          items: [
            {
              prescriptionItemId: 'pi-1',
              batchId: 'batch-valid',
              quantity: 10,
            },
          ],
        },
        pharmacistCaller,
      );

      expect(result.status).toBe('FULFILLED');
      expect(prisma.medicineBatch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'batch-valid' },
          data: { quantity: { decrement: 10 } },
        }),
      );
      expect(prisma.prescriptionItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pi-1' },
          data: { dispensedQuantity: { increment: 10 } },
        }),
      );
      expect(notificationService.dispatch).toHaveBeenCalled();
    });

    it('blocks cross-hospital dispensing', async () => {
      prisma.prescription.findUnique.mockResolvedValue({
        ...mockPrescription,
        medicalRecord: {
          patient: {
            id: 'pat-1',
            hospitalId: hospitalA,
          },
        },
      });

      await expect(
        service.dispense(
          {
            prescriptionId: 'presc-1',
            items: [{ prescriptionItemId: 'pi-1', batchId: 'batch-1', quantity: 10 }],
          },
          otherHospitalPharmacist,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
