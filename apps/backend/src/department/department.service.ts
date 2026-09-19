import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import type { AuthUser } from '../auth/auth-user.interface';

@Injectable()
export class DepartmentService {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================================
  // CREATE DEPARTMENT
  // =========================================================
  async createDepartment(hospitalId: string, dto: CreateDepartmentDto) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
    });

    if (!hospital) {
      throw new NotFoundException('Hospital not found');
    }

    const trimmedName = dto.name.trim();

    // Service-level duplicate check for department name within the hospital
    const existing = await this.prisma.department.findFirst({
      where: {
        hospitalId,
        name: {
          equals: trimmedName,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        'Department with this name already exists in this hospital',
      );
    }

    return this.prisma.department.create({
      data: {
        name: trimmedName,
        hospitalId,
      },
      include: {
        hospital: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  // =========================================================
  // LIST DEPARTMENTS (With optional hospitalId filter)
  // =========================================================
  async getDepartments(hospitalId?: string) {
    return this.prisma.department.findMany({
      where: hospitalId ? { hospitalId } : undefined,
      include: {
        _count: {
          select: {
            doctors: true,
            appointments: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  // =========================================================
  // GET DEPARTMENT BY ID (With tenant isolation)
  // =========================================================
  async getDepartmentById(id: string, user: AuthUser) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: {
        hospital: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            doctors: true,
            appointments: true,
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    if (user.role !== 'SUPER_ADMIN' && department.hospitalId !== user.hospitalId) {
      throw new ForbiddenException(
        'Access denied: You do not have permission to view departments from another hospital',
      );
    }

    return department;
  }

  // =========================================================
  // UPDATE DEPARTMENT (With tenant isolation & duplicate check)
  // =========================================================
  async updateDepartment(
    id: string,
    dto: UpdateDepartmentDto,
    user: AuthUser,
  ) {
    const department = await this.getDepartmentById(id, user);

    if (dto.name) {
      const trimmedName = dto.name.trim();

      const duplicate = await this.prisma.department.findFirst({
        where: {
          hospitalId: department.hospitalId,
          name: {
            equals: trimmedName,
            mode: 'insensitive',
          },
          id: {
            not: id,
          },
        },
      });

      if (duplicate) {
        throw new ConflictException(
          'Department with this name already exists in this hospital',
        );
      }

      return this.prisma.department.update({
        where: { id },
        data: {
          name: trimmedName,
        },
        include: {
          hospital: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    }

    return department;
  }

  // =========================================================
  // DELETE DEPARTMENT (With safety checks & tenant isolation)
  // =========================================================
  async deleteDepartment(id: string, user: AuthUser) {
    await this.getDepartmentById(id, user);

    // Prevent deletion if active doctors are assigned
    const activeDoctorsCount = await this.prisma.doctor.count({
      where: {
        departmentId: id,
        deletedAt: null,
      },
    });

    if (activeDoctorsCount > 0) {
      throw new BadRequestException(
        'Cannot delete department because active doctors are assigned to it',
      );
    }

    await this.prisma.department.delete({
      where: { id },
    });

    return {
      message: 'Department deleted successfully',
    };
  }
}
