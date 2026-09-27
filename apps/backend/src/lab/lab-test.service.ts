import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLabTestDto } from './dto/create-lab-test.dto';
import { UpdateLabTestDto } from './dto/update-lab-test.dto';
import { LabTestQueryDto } from './dto/lab-test-query.dto';
import type { AuthUser } from '../auth/auth-user.interface';

@Injectable()
export class LabTestService {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================================
  // CREATE LAB TEST
  // =========================================================
  async createLabTest(dto: CreateLabTestDto, caller: AuthUser) {
    const hospitalId =
      caller.role === 'SUPER_ADMIN'
        ? dto.hospitalId || caller.hospitalId || null
        : caller.hospitalId;

    if (hospitalId) {
      const hospital = await this.prisma.hospital.findUnique({
        where: { id: hospitalId },
      });
      if (!hospital) {
        throw new NotFoundException('Hospital not found');
      }
    }

    const trimmedName = dto.name.trim();

    // Check for duplicate test name within the same hospital context
    const existing = await this.prisma.labTest.findFirst({
      where: {
        hospitalId: hospitalId || null,
        name: { equals: trimmedName, mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Lab test "${trimmedName}" already exists for this hospital`,
      );
    }

    const data: Prisma.LabTestUncheckedCreateInput = {
      hospitalId: hospitalId || null,
      name: trimmedName,
      description: dto.description?.trim() || null,
      unit: dto.unit?.trim() || null,
      referenceMin: dto.referenceMin !== undefined ? dto.referenceMin : null,
      referenceMax: dto.referenceMax !== undefined ? dto.referenceMax : null,
    };

    return this.prisma.labTest.create({
      data,
      include: {
        hospital: {
          select: { id: true, name: true },
        },
      },
    });
  }

  // =========================================================
  // LIST LAB TESTS
  // =========================================================
  async getLabTests(query: LabTestQueryDto, caller: AuthUser) {
    const where: any = {};

    if (caller.role === 'SUPER_ADMIN') {
      if (query.hospitalId) {
        where.hospitalId = query.hospitalId;
      }
    } else {
      where.OR = [
        { hospitalId: caller.hospitalId },
        { hospitalId: null },
      ];
    }

    if (query.search) {
      const search = query.search.trim();
      const searchFilter = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
      if (where.OR) {
        where.AND = [{ OR: searchFilter }];
      } else {
        where.OR = searchFilter;
      }
    }

    return this.prisma.labTest.findMany({
      where,
      include: {
        hospital: {
          select: { id: true, name: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  // =========================================================
  // GET LAB TEST BY ID
  // =========================================================
  async getLabTestById(id: string, caller: AuthUser) {
    const labTest = await this.prisma.labTest.findUnique({
      where: { id },
      include: {
        hospital: {
          select: { id: true, name: true },
        },
      },
    });

    if (!labTest) {
      throw new NotFoundException('Lab test not found');
    }

    if (
      caller.role !== 'SUPER_ADMIN' &&
      labTest.hospitalId &&
      labTest.hospitalId !== caller.hospitalId
    ) {
      throw new ForbiddenException(
        'Access denied: Lab test belongs to another hospital',
      );
    }

    return labTest;
  }

  // =========================================================
  // UPDATE LAB TEST
  // =========================================================
  async updateLabTest(id: string, dto: UpdateLabTestDto, caller: AuthUser) {
    const labTest = await this.getLabTestById(id, caller);

    if (
      caller.role !== 'HOSPITAL_ADMIN' &&
      caller.role !== 'LAB_TECHNICIAN' &&
      caller.role !== 'SUPER_ADMIN'
    ) {
      throw new ForbiddenException(
        'You do not have permission to update lab tests',
      );
    }

    const newName = dto.name !== undefined ? dto.name.trim() : labTest.name;

    if (dto.name !== undefined) {
      const duplicate = await this.prisma.labTest.findFirst({
        where: {
          id: { not: id },
          hospitalId: labTest.hospitalId,
          name: { equals: newName, mode: 'insensitive' },
        },
      });

      if (duplicate) {
        throw new ConflictException(
          `Lab test "${newName}" already exists in this hospital`,
        );
      }
    }

    const updateData: Prisma.LabTestUncheckedUpdateInput = {
      ...(dto.name !== undefined && { name: newName }),
      ...(dto.description !== undefined && {
        description: dto.description?.trim() || null,
      }),
      ...(dto.unit !== undefined && { unit: dto.unit?.trim() || null }),
      ...(dto.referenceMin !== undefined && {
        referenceMin: dto.referenceMin,
      }),
      ...(dto.referenceMax !== undefined && {
        referenceMax: dto.referenceMax,
      }),
    };

    return this.prisma.labTest.update({
      where: { id },
      data: updateData,
      include: {
        hospital: {
          select: { id: true, name: true },
        },
      },
    });
  }
}
