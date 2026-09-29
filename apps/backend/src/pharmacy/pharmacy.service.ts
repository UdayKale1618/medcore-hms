import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import {
  DispenseMedicineDto,
} from './dto/dispense-medicine.dto';
import {
  PharmacyBatchQueryDto,
  PharmacyInventoryQueryDto,
  PharmacyPrescriptionQueryDto,
} from './dto/pharmacy-query.dto';
import type { AuthUser } from '../auth/auth-user.interface';

const PRESCRIPTION_PHARMACY_INCLUDE = {
  medicalRecord: {
    include: {
      patient: {
        include: {
          user: {
            select: { id: true, name: true, email: true, phone: true },
          },
        },
      },
      doctor: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          department: {
            select: { id: true, name: true },
          },
        },
      },
    },
  },
  items: {
    include: {
      medicine: {
        include: {
          batches: {
            orderBy: { expiryDate: 'asc' as const },
          },
        },
      },
    },
  },
} satisfies Prisma.PrescriptionInclude;

@Injectable()
export class PharmacyService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notificationService?: NotificationService,
  ) {}

  // =========================================================
  // 1. INVENTORY LOOKUP
  // =========================================================
  async getInventory(query: PharmacyInventoryQueryDto, caller: AuthUser) {
    const hospitalId =
      caller.role === 'SUPER_ADMIN'
        ? query.hospitalId || caller.hospitalId
        : caller.hospitalId;

    const where: Prisma.MedicineWhereInput = { hospitalId };

    if (query.form) {
      where.form = { equals: query.form.trim(), mode: 'insensitive' };
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const medicines = await this.prisma.medicine.findMany({
      where,
      include: {
        batches: {
          orderBy: { expiryDate: 'asc' },
        },
        _count: {
          select: { batches: true, prescriptionItems: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const now = new Date();

    const inventory = medicines.map((med) => {
      const totalStock = med.batches.reduce((sum, b) => sum + b.quantity, 0);
      const activeBatches = med.batches.filter(
        (b) => new Date(b.expiryDate) > now && b.quantity > 0,
      );
      const availableStock = activeBatches.reduce(
        (sum, b) => sum + b.quantity,
        0,
      );
      const expiredBatches = med.batches.filter(
        (b) => new Date(b.expiryDate) <= now,
      );
      const expiredStock = expiredBatches.reduce(
        (sum, b) => sum + b.quantity,
        0,
      );
      const isLowStock = availableStock <= med.reorderLevel;

      return {
        id: med.id,
        hospitalId: med.hospitalId,
        name: med.name,
        form: med.form,
        description: med.description,
        reorderLevel: med.reorderLevel,
        isActive: med.isActive,
        createdAt: med.createdAt,
        updatedAt: med.updatedAt,
        totalStock,
        availableStock,
        expiredStock,
        isLowStock,
        totalBatches: med._count.batches,
        activeBatchesCount: activeBatches.length,
        hasValidStock: activeBatches.length > 0,
        nearestExpiryDate: activeBatches[0]?.expiryDate || null,
      };
    });

    if (query.lowStock !== undefined) {
      return inventory.filter((item) => item.isLowStock === query.lowStock);
    }

    return inventory;
  }

  // =========================================================
  // 2. DETAILED MEDICINE INVENTORY (WITH BATCHES)
  // =========================================================
  async getMedicineInventory(medicineId: string, caller: AuthUser) {
    const medicine = await this.prisma.medicine.findUnique({
      where: { id: medicineId },
      include: {
        hospital: { select: { id: true, name: true } },
        batches: {
          orderBy: { expiryDate: 'asc' },
        },
      },
    });

    if (!medicine) {
      throw new NotFoundException('Medicine not found');
    }

    if (
      caller.role !== 'SUPER_ADMIN' &&
      medicine.hospitalId !== caller.hospitalId
    ) {
      throw new ForbiddenException(
        'Access denied: Medicine belongs to another hospital',
      );
    }

    const now = new Date();

    const batchesWithStatus = medicine.batches.map((batch) => {
      const isExpired = new Date(batch.expiryDate) <= now;
      return {
        ...batch,
        isExpired,
        availableQuantity: isExpired ? 0 : batch.quantity,
      };
    });

    const activeBatches = batchesWithStatus.filter(
      (b) => !b.isExpired && b.quantity > 0,
    );
    const availableStock = activeBatches.reduce(
      (sum, b) => sum + b.quantity,
      0,
    );
    const totalStock = batchesWithStatus.reduce(
      (sum, b) => sum + b.quantity,
      0,
    );
    const isLowStock = availableStock <= medicine.reorderLevel;

    return {
      ...medicine,
      totalStock,
      availableStock,
      isLowStock,
      batches: batchesWithStatus,
    };
  }

  // =========================================================
  // 3. BATCHES LOOKUP
  // =========================================================
  async getBatches(query: PharmacyBatchQueryDto, caller: AuthUser) {
    const hospitalId =
      caller.role === 'SUPER_ADMIN'
        ? query.hospitalId || caller.hospitalId
        : caller.hospitalId;

    const where: Prisma.MedicineBatchWhereInput = {
      medicine: {
        hospitalId,
      },
    };

    if (query.medicineId) {
      where.medicineId = query.medicineId;
    }

    const now = new Date();
    if (query.expired === true) {
      where.expiryDate = { lte: now };
    } else if (query.expired === false) {
      where.expiryDate = { gt: now };
    }

    const batches = await this.prisma.medicineBatch.findMany({
      where,
      include: {
        medicine: {
          select: {
            id: true,
            name: true,
            form: true,
            hospitalId: true,
            isActive: true,
          },
        },
      },
      orderBy: { expiryDate: 'asc' },
    });

    return batches.map((batch) => ({
      ...batch,
      isExpired: new Date(batch.expiryDate) <= now,
    }));
  }

  async getBatchById(id: string, caller: AuthUser) {
    const batch = await this.prisma.medicineBatch.findUnique({
      where: { id },
      include: {
        medicine: {
          select: {
            id: true,
            name: true,
            form: true,
            hospitalId: true,
            isActive: true,
          },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException('Medicine batch not found');
    }

    if (
      caller.role !== 'SUPER_ADMIN' &&
      batch.medicine.hospitalId !== caller.hospitalId
    ) {
      throw new ForbiddenException(
        'Access denied: Batch belongs to another hospital',
      );
    }

    const isExpired = new Date(batch.expiryDate) <= new Date();

    return {
      ...batch,
      isExpired,
    };
  }

  // =========================================================
  // 4. PHARMACY PRESCRIPTIONS
  // =========================================================
  async getPrescriptions(
    query: PharmacyPrescriptionQueryDto,
    caller: AuthUser,
  ) {
    const where: Prisma.PrescriptionWhereInput = {};
    const medicalRecordWhere: Prisma.MedicalRecordWhereInput = {};
    const patientWhere: Prisma.PatientWhereInput = {};

    if (caller.role === 'SUPER_ADMIN') {
      if (query.hospitalId) {
        patientWhere.hospitalId = query.hospitalId;
      }
    } else {
      patientWhere.hospitalId = caller.hospitalId;
    }

    if (caller.role === 'PATIENT') {
      const patient = await this.prisma.patient.findUnique({
        where: { userId: caller.userId },
      });
      if (!patient) return [];
      medicalRecordWhere.patientId = patient.id;
    } else if (query.patientId) {
      medicalRecordWhere.patientId = query.patientId;
    }

    medicalRecordWhere.patient = patientWhere;
    where.medicalRecord = medicalRecordWhere;

    if (query.status) {
      where.status = query.status.toUpperCase();
    }

    return this.prisma.prescription.findMany({
      where,
      include: PRESCRIPTION_PHARMACY_INCLUDE,
      orderBy: { issuedAt: 'desc' },
    });
  }

  async getPrescriptionById(id: string, caller: AuthUser) {
    const prescription = await this.prisma.prescription.findUnique({
      where: { id },
      include: PRESCRIPTION_PHARMACY_INCLUDE,
    });

    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }

    const hospitalId = prescription.medicalRecord.patient.hospitalId;
    if (caller.role !== 'SUPER_ADMIN' && hospitalId !== caller.hospitalId) {
      throw new ForbiddenException(
        'Access denied: Prescription belongs to another hospital',
      );
    }

    if (caller.role === 'PATIENT') {
      const patient = await this.prisma.patient.findUnique({
        where: { userId: caller.userId },
      });
      if (!patient || patient.id !== prescription.medicalRecord.patientId) {
        throw new ForbiddenException(
          'Access denied: You can only view your own prescriptions',
        );
      }
    }

    return prescription;
  }

  // =========================================================
  // 5. DISPENSE MEDICINE (Transactional with Expiry & Stock Safety)
  // =========================================================
  async dispense(dto: DispenseMedicineDto, caller: AuthUser) {
    // RBAC: Only PHARMACIST, HOSPITAL_ADMIN, or SUPER_ADMIN can dispense
    if (
      caller.role !== 'PHARMACIST' &&
      caller.role !== 'HOSPITAL_ADMIN' &&
      caller.role !== 'SUPER_ADMIN'
    ) {
      throw new ForbiddenException(
        'Only pharmacists and hospital administrators have permission to dispense medications',
      );
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one item must be dispensed');
    }

    // 1. Fetch prescription with relations
    const prescription = await this.prisma.prescription.findUnique({
      where: { id: dto.prescriptionId },
      include: {
        medicalRecord: {
          include: {
            patient: true,
          },
        },
        items: {
          include: {
            medicine: true,
          },
        },
      },
    });

    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }

    const hospitalId = prescription.medicalRecord.patient.hospitalId;
    if (caller.role !== 'SUPER_ADMIN' && hospitalId !== caller.hospitalId) {
      throw new ForbiddenException(
        'Access denied: Prescription belongs to another hospital',
      );
    }

    if (prescription.status === 'FULFILLED') {
      throw new BadRequestException('Prescription is already fully fulfilled');
    }

    const now = new Date();

    // 2. Pre-validate all items before transaction
    for (const item of dto.items) {
      const presItem = prescription.items.find(
        (pi) => pi.id === item.prescriptionItemId,
      );
      if (!presItem) {
        throw new NotFoundException(
          `Prescription item ${item.prescriptionItemId} does not belong to this prescription`,
        );
      }

      const batch = await this.prisma.medicineBatch.findUnique({
        where: { id: item.batchId },
        include: { medicine: true },
      });

      if (!batch) {
        throw new NotFoundException(`Batch ${item.batchId} not found`);
      }

      if (batch.medicineId !== presItem.medicineId) {
        throw new BadRequestException(
          `Batch "${batch.batchNumber}" does not belong to prescribed medicine "${presItem.medicine.name}"`,
        );
      }

      if (batch.medicine.hospitalId !== hospitalId) {
        throw new BadRequestException(
          `Batch "${batch.batchNumber}" belongs to a different hospital`,
        );
      }

      // Inactive medicine protection
      if (!batch.medicine.isActive) {
        throw new BadRequestException(
          `Cannot dispense inactive medicine "${batch.medicine.name}"`,
        );
      }

      // CRITICAL: Expired medicine protection
      if (new Date(batch.expiryDate) <= now) {
        throw new BadRequestException(
          `An expired medicine cannot be dispensed: Batch "${batch.batchNumber}" expired on ${batch.expiryDate.toISOString().slice(0, 10)}`,
        );
      }

      // Zero and insufficient stock protection
      if (batch.quantity <= 0) {
        throw new BadRequestException(
          `Batch "${batch.batchNumber}" has zero stock available`,
        );
      }

      if (item.quantity > batch.quantity) {
        throw new BadRequestException(
          `Insufficient stock in batch "${batch.batchNumber}". Requested: ${item.quantity}, Available: ${batch.quantity}`,
        );
      }
    }

    // 3. Execute atomic stock deduction and fulfilment update in Prisma Transaction
    const result = await this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        // Re-read inside transaction for strict race condition & concurrency protection
        const currentBatch = await tx.medicineBatch.findUnique({
          where: { id: item.batchId },
        });

        if (!currentBatch) {
          throw new NotFoundException(`Batch ${item.batchId} not found`);
        }

        if (new Date(currentBatch.expiryDate) <= now) {
          throw new BadRequestException(
            `Batch "${currentBatch.batchNumber}" has expired and cannot be dispensed`,
          );
        }

        if (currentBatch.quantity < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock in batch "${currentBatch.batchNumber}". Available: ${currentBatch.quantity}, Requested: ${item.quantity}`,
          );
        }

        // Atomically decrement stock
        await tx.medicineBatch.update({
          where: { id: item.batchId },
          data: {
            quantity: {
              decrement: item.quantity,
            },
          },
        });

        // Atomically increment dispensed quantity on prescription item
        await tx.prescriptionItem.update({
          where: { id: item.prescriptionItemId },
          data: {
            dispensedQuantity: {
              increment: item.quantity,
            },
          },
        });
      }

      // Recalculate status
      const updatedItems = await tx.prescriptionItem.findMany({
        where: { prescriptionId: dto.prescriptionId },
      });

      const totalItems = updatedItems.length;
      const dispensedItemsCount = updatedItems.filter(
        (i) => i.dispensedQuantity > 0,
      ).length;

      let newStatus = 'PARTIALLY_FULFILLED';
      if (dispensedItemsCount === totalItems && totalItems > 0) {
        newStatus = 'FULFILLED';
      }

      const updatedPrescription = await tx.prescription.update({
        where: { id: dto.prescriptionId },
        data: { status: newStatus },
        include: PRESCRIPTION_PHARMACY_INCLUDE,
      });

      return {
        message: 'Medicines dispensed successfully',
        status: newStatus,
        prescription: updatedPrescription,
        dispensedItems: dto.items,
      };
    });

    // Asynchronous notification delivery (non-blocking)
    if (this.notificationService && prescription.medicalRecord?.patient?.userId) {
      await this.notificationService.dispatch({
        userId: prescription.medicalRecord.patient.userId,
        hospitalId,
        type: 'pharmacy.fulfilled',
        title: 'Medications Dispensed',
        message: `Your prescription (${prescription.id}) has been updated. Medicines have been dispensed by the pharmacy.`,
        entityType: 'Prescription',
        entityId: prescription.id,
      });
    }

    return result;
  }

  // =========================================================
  // 6. UPDATE PRESCRIPTION STATUS
  // =========================================================
  async updatePrescriptionStatus(
    id: string,
    status: string,
    caller: AuthUser,
  ) {
    if (
      caller.role !== 'PHARMACIST' &&
      caller.role !== 'HOSPITAL_ADMIN' &&
      caller.role !== 'SUPER_ADMIN'
    ) {
      throw new ForbiddenException(
        'You do not have permission to update prescription status',
      );
    }

    const prescription = await this.prisma.prescription.findUnique({
      where: { id },
      include: {
        medicalRecord: {
          include: { patient: true },
        },
      },
    });

    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }

    const hospitalId = prescription.medicalRecord.patient.hospitalId;
    if (caller.role !== 'SUPER_ADMIN' && hospitalId !== caller.hospitalId) {
      throw new ForbiddenException(
        'Access denied: Prescription belongs to another hospital',
      );
    }

    const normalizedStatus = status.toUpperCase().trim();
    const validStatuses = ['PRESCRIBED', 'PARTIALLY_FULFILLED', 'FULFILLED'];
    if (!validStatuses.includes(normalizedStatus)) {
      throw new BadRequestException(
        `Invalid status "${status}". Allowed: ${validStatuses.join(', ')}`,
      );
    }

    return this.prisma.prescription.update({
      where: { id },
      data: { status: normalizedStatus },
      include: PRESCRIPTION_PHARMACY_INCLUDE,
    });
  }
}
