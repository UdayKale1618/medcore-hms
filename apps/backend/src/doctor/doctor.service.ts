import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { DoctorQueryDto } from './dto/doctor-query.dto';
import type { AuthUser } from '../auth/auth-user.interface';

@Injectable()
export class DoctorService {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================================
  // CREATE DOCTOR PROFILE
  // =========================================================
  async createDoctor(dto: CreateDoctorDto, caller: AuthUser) {
    // 1. Validate User
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      include: {
        role: true,
        hospital: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role.name !== 'DOCTOR') {
      throw new BadRequestException('User does not have the DOCTOR role');
    }

    // Enforce tenant isolation
    if (caller.role !== 'SUPER_ADMIN' && user.hospitalId !== caller.hospitalId) {
      throw new ForbiddenException(
        'Cannot create doctor profile for a user from another hospital',
      );
    }

    // 2. Validate Department
    const department = await this.prisma.department.findUnique({
      where: { id: dto.departmentId },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    if (department.hospitalId !== user.hospitalId) {
      throw new BadRequestException(
        'Department does not belong to the user hospital',
      );
    }

    // 3. Check for existing doctor profile
    const existingDoctor = await this.prisma.doctor.findUnique({
      where: { userId: dto.userId },
    });

    if (existingDoctor) {
      throw new ConflictException(
        'Doctor profile already exists for this user',
      );
    }

    // 4. Check license number uniqueness if provided
    if (dto.licenseNumber) {
      const existingLicense = await this.prisma.doctor.findUnique({
        where: { licenseNumber: dto.licenseNumber },
      });

      if (existingLicense) {
        throw new ConflictException(
          'Doctor with this license number already exists',
        );
      }
    }

    return this.prisma.doctor.create({
      data: {
        userId: dto.userId,
        departmentId: dto.departmentId,
        specialization: dto.specialization,
        licenseNumber: dto.licenseNumber,
        consultationFee:
          dto.consultationFee !== undefined ? dto.consultationFee : undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            hospitalId: true,
            hospital: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  // =========================================================
  // LIST DOCTORS (With tenant isolation and soft-delete filter)
  // =========================================================
  async getDoctors(query: DoctorQueryDto, caller: AuthUser) {
    const whereClause: any = {
      deletedAt: null, // Consistently filter deletedAt: null
    };

    // Enforce tenant isolation
    if (caller.role === 'SUPER_ADMIN') {
      if (query.hospitalId) {
        whereClause.user = { hospitalId: query.hospitalId };
      }
    } else {
      if (!caller.hospitalId) {
        throw new BadRequestException('No hospital associated with this user');
      }
      whereClause.user = { hospitalId: caller.hospitalId };
    }

    if (query.departmentId) {
      whereClause.departmentId = query.departmentId;
    }

    if (query.specialization) {
      whereClause.specialization = {
        contains: query.specialization,
        mode: 'insensitive',
      };
    }

    return this.prisma.doctor.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            hospitalId: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // =========================================================
  // GET DOCTOR BY ID (With tenant isolation)
  // =========================================================
  async getDoctorById(id: string, caller: AuthUser) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            hospitalId: true,
            hospital: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        availability: true,
      },
    });

    if (!doctor || doctor.deletedAt !== null) {
      throw new NotFoundException('Doctor not found');
    }

    // Enforce tenant isolation
    if (
      caller.role !== 'SUPER_ADMIN' &&
      doctor.user.hospitalId !== caller.hospitalId
    ) {
      throw new ForbiddenException(
        'Access denied: Doctor belongs to another hospital',
      );
    }

    return doctor;
  }

  // =========================================================
  // UPDATE DOCTOR PROFILE
  // =========================================================
  async updateDoctor(
    id: string,
    dto: UpdateDoctorDto,
    caller: AuthUser,
  ) {
    const doctor = await this.getDoctorById(id, caller);

    // Permission check: HOSPITAL_ADMIN, SUPER_ADMIN, or the doctor themselves
    const isOwner = caller.userId === doctor.userId;
    const isAdmin =
      caller.role === 'HOSPITAL_ADMIN' || caller.role === 'SUPER_ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'You do not have permission to update this doctor profile',
      );
    }

    // If departmentId is updated, validate department and tenant
    if (dto.departmentId && dto.departmentId !== doctor.departmentId) {
      const department = await this.prisma.department.findUnique({
        where: { id: dto.departmentId },
      });

      if (!department) {
        throw new NotFoundException('Department not found');
      }

      if (department.hospitalId !== doctor.user.hospitalId) {
        throw new BadRequestException(
          'Department does not belong to the doctor hospital',
        );
      }
    }

    // If licenseNumber is updated, check uniqueness
    if (dto.licenseNumber && dto.licenseNumber !== doctor.licenseNumber) {
      const existingLicense = await this.prisma.doctor.findFirst({
        where: {
          licenseNumber: dto.licenseNumber,
          id: { not: id },
        },
      });

      if (existingLicense) {
        throw new ConflictException('License number already in use');
      }
    }

    const updateData: any = {};
    if (dto.departmentId !== undefined) updateData.departmentId = dto.departmentId;
    if (dto.specialization !== undefined)
      updateData.specialization = dto.specialization;
    if (dto.licenseNumber !== undefined)
      updateData.licenseNumber = dto.licenseNumber;
    if (dto.consultationFee !== undefined)
      updateData.consultationFee = dto.consultationFee;

    return this.prisma.doctor.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            hospitalId: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  // =========================================================
  // DEACTIVATE / SOFT DELETE DOCTOR
  // =========================================================
  async deleteDoctor(id: string, caller: AuthUser) {
    await this.getDoctorById(id, caller);

    // Permission check: only HOSPITAL_ADMIN or SUPER_ADMIN
    if (caller.role !== 'HOSPITAL_ADMIN' && caller.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'Only administrators can deactivate a doctor profile',
      );
    }

    await this.prisma.doctor.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    return {
      message: 'Doctor profile deactivated successfully',
    };
  }
}
