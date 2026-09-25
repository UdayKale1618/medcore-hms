import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';
import { CreateMedicineBatchDto } from './dto/create-medicine-batch.dto';
import { MedicineQueryDto } from './dto/medicine-query.dto';
import type { AuthUser } from '../auth/auth-user.interface';

@Injectable()
export class MedicineService {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================================
  // CREATE MEDICINE
  // =========================================================
  async createMedicine(dto: CreateMedicineDto, caller: AuthUser) {
    const hospitalId =
      caller.role === 'SUPER_ADMIN'
        ? dto.hospitalId || caller.hospitalId
        : caller.hospitalId;

    if (!hospitalId) {
      throw new BadRequestException('Hospital ID is required');
    }

    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
    });

    if (!hospital) {
      throw new NotFoundException('Hospital not found');
    }

    const trimmedName = dto.name.trim();
    const normalizedForm = dto.form.trim().toUpperCase();

    // Check for duplicate name + form within the same hospital
    const existing = await this.prisma.medicine.findFirst({
      where: {
        hospitalId,
        name: { equals: trimmedName, mode: 'insensitive' },
        form: { equals: normalizedForm, mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Medicine "${trimmedName}" (${normalizedForm}) already exists in this hospital`,
      );
    }

    return this.prisma.medicine.create({
      data: {
        hospitalId,
        name: trimmedName,
        form: normalizedForm,
        description: dto.description,
        reorderLevel: dto.reorderLevel !== undefined ? dto.reorderLevel : 10,
      },
      include: {
        hospital: {
          select: { id: true, name: true },
        },
      },
    });
  }

  // =========================================================
  // LIST MEDICINES
  // =========================================================
  async getMedicines(query: MedicineQueryDto, caller: AuthUser) {
    const where: any = {};

    if (caller.role === 'SUPER_ADMIN') {
      if (query.hospitalId) {
        where.hospitalId = query.hospitalId;
      }
    } else {
      where.hospitalId = caller.hospitalId;
    }

    if (query.form) {
      where.form = { equals: query.form.trim(), mode: 'insensitive' };
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

    return medicines.map((med) => {
      const activeBatches = med.batches.filter(
        (b) => new Date(b.expiryDate) > now && b.quantity > 0,
      );
      const totalStock = activeBatches.reduce((acc, b) => acc + b.quantity, 0);

      return {
        ...med,
        totalStock,
        hasValidStock: activeBatches.length > 0,
      };
    });
  }

  // =========================================================
  // GET MEDICINE BY ID
  // =========================================================
  async getMedicineById(id: string, caller: AuthUser) {
    const medicine = await this.prisma.medicine.findUnique({
      where: { id },
      include: {
        hospital: {
          select: { id: true, name: true },
        },
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
    const activeBatches = medicine.batches.filter(
      (b) => new Date(b.expiryDate) > now && b.quantity > 0,
    );
    const totalStock = activeBatches.reduce((acc, b) => acc + b.quantity, 0);

    return {
      ...medicine,
      totalStock,
      hasValidStock: activeBatches.length > 0,
    };
  }

  // =========================================================
  // UPDATE MEDICINE
  // =========================================================
  async updateMedicine(id: string, dto: UpdateMedicineDto, caller: AuthUser) {
    const medicine = await this.getMedicineById(id, caller);

    if (
      caller.role !== 'HOSPITAL_ADMIN' &&
      caller.role !== 'PHARMACIST' &&
      caller.role !== 'SUPER_ADMIN'
    ) {
      throw new ForbiddenException(
        'You do not have permission to update medicine details',
      );
    }

    const newName = dto.name !== undefined ? dto.name.trim() : medicine.name;
    const newForm =
      dto.form !== undefined ? dto.form.trim().toUpperCase() : medicine.form;

    if (dto.name !== undefined || dto.form !== undefined) {
      const duplicate = await this.prisma.medicine.findFirst({
        where: {
          id: { not: id },
          hospitalId: medicine.hospitalId,
          name: { equals: newName, mode: 'insensitive' },
          form: { equals: newForm, mode: 'insensitive' },
        },
      });

      if (duplicate) {
        throw new ConflictException(
          `Medicine "${newName}" (${newForm}) already exists in this hospital`,
        );
      }
    }

    return this.prisma.medicine.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: newName }),
        ...(dto.form !== undefined && { form: newForm }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.reorderLevel !== undefined && {
          reorderLevel: dto.reorderLevel,
        }),
      },
      include: {
        batches: true,
      },
    });
  }

  // =========================================================
  // CREATE MEDICINE BATCH
  // =========================================================
  async createBatch(
    medicineId: string,
    dto: CreateMedicineBatchDto,
    caller: AuthUser,
  ) {
    const medicine = await this.getMedicineById(medicineId, caller);

    if (
      caller.role !== 'HOSPITAL_ADMIN' &&
      caller.role !== 'PHARMACIST' &&
      caller.role !== 'SUPER_ADMIN'
    ) {
      throw new ForbiddenException(
        'You do not have permission to add medicine batches',
      );
    }

    const batchNumber = dto.batchNumber.trim();
    const expiryDate = new Date(dto.expiryDate);

    if (isNaN(expiryDate.getTime())) {
      throw new BadRequestException('Invalid expiryDate');
    }

    // Check duplicate batch number for this medicine
    const existing = await this.prisma.medicineBatch.findFirst({
      where: {
        medicineId,
        batchNumber: { equals: batchNumber, mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Batch "${batchNumber}" already exists for this medicine`,
      );
    }

    return this.prisma.medicineBatch.create({
      data: {
        medicineId,
        batchNumber,
        manufacturingDate: dto.manufacturingDate
          ? new Date(dto.manufacturingDate)
          : null,
        expiryDate,
        quantity: dto.quantity,
        unitCost: dto.unitCost,
        mrp: dto.mrp,
      },
    });
  }

  // =========================================================
  // GET BATCHES FOR MEDICINE
  // =========================================================
  async getBatches(medicineId: string, caller: AuthUser) {
    await this.getMedicineById(medicineId, caller);

    return this.prisma.medicineBatch.findMany({
      where: { medicineId },
      orderBy: { expiryDate: 'asc' },
    });
  }
}
