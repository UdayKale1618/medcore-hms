import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHospitalDto } from './dto/create-hospital.dto';
import { UpdateHospitalDto } from './dto/update-hospital.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import type { AuthUser } from '../auth/auth-user.interface';

@Injectable()
export class HospitalService {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================================
  // GET HOSPITAL BY ID
  // =========================================================
  async getHospitalById(id: string) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id },
      include: {
        addresses: true,
        _count: {
          select: {
            departments: true,
            rooms: true,
            patients: true,
            users: true,
          },
        },
      },
    });

    if (!hospital) {
      throw new NotFoundException('Hospital not found');
    }

    return hospital;
  }

  // =========================================================
  // UPDATE HOSPITAL
  // =========================================================
  async updateHospital(id: string, dto: UpdateHospitalDto) {
    const existingHospital = await this.prisma.hospital.findUnique({
      where: { id },
    });

    if (!existingHospital) {
      throw new NotFoundException('Hospital not found');
    }

    if (dto.email && dto.email !== existingHospital.email) {
      const emailInUse = await this.prisma.hospital.findFirst({
        where: {
          email: dto.email,
          id: { not: id },
        },
      });

      if (emailInUse) {
        throw new ConflictException(
          'Email is already registered to another hospital',
        );
      }
    }

    const hospitalData: {
      name?: string;
      email?: string;
      phone?: string;
    } = {};

    if (dto.name !== undefined) hospitalData.name = dto.name;
    if (dto.email !== undefined) hospitalData.email = dto.email;
    if (dto.phone !== undefined) hospitalData.phone = dto.phone;

    if (Object.keys(hospitalData).length > 0) {
      await this.prisma.hospital.update({
        where: { id },
        data: hospitalData,
      });
    }

    // Handle address update/creation if address fields provided
    const hasAddressFields =
      dto.addressLine1 !== undefined ||
      dto.addressLine2 !== undefined ||
      dto.city !== undefined ||
      dto.state !== undefined ||
      dto.postalCode !== undefined ||
      dto.country !== undefined;

    if (hasAddressFields) {
      const existingAddress = await this.prisma.address.findFirst({
        where: { hospitalId: id },
      });

      if (existingAddress) {
        await this.prisma.address.update({
          where: { id: existingAddress.id },
          data: {
            addressLine1: dto.addressLine1 ?? existingAddress.addressLine1,
            addressLine2: dto.addressLine2 ?? existingAddress.addressLine2,
            city: dto.city ?? existingAddress.city,
            state: dto.state ?? existingAddress.state,
            postalCode: dto.postalCode ?? existingAddress.postalCode,
            country: dto.country ?? existingAddress.country,
          },
        });
      } else if (
        dto.addressLine1 &&
        dto.city &&
        dto.state &&
        dto.postalCode
      ) {
        await this.prisma.address.create({
          data: {
            hospitalId: id,
            addressLine1: dto.addressLine1,
            addressLine2: dto.addressLine2,
            city: dto.city,
            state: dto.state,
            postalCode: dto.postalCode,
            country: dto.country ?? 'India',
          },
        });
      }
    }

    return this.getHospitalById(id);
  }

  // =========================================================
  // GET ALL HOSPITALS (Cross-tenant: SUPER_ADMIN)
  // =========================================================
  async getAllHospitals() {
    return this.prisma.hospital.findMany({
      include: {
        addresses: true,
        _count: {
          select: {
            departments: true,
            rooms: true,
            patients: true,
            users: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // =========================================================
  // CREATE HOSPITAL (SUPER_ADMIN onboarding)
  // =========================================================
  async createHospital(dto: CreateHospitalDto) {
    const existing = await this.prisma.hospital.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException(
        'Hospital with this email already exists',
      );
    }

    const hasAddress =
      dto.addressLine1 && dto.city && dto.state && dto.postalCode;

    const hospital = await this.prisma.hospital.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        ...(hasAddress && {
          addresses: {
            create: {
              addressLine1: dto.addressLine1!,
              addressLine2: dto.addressLine2,
              city: dto.city!,
              state: dto.state!,
              postalCode: dto.postalCode!,
              country: dto.country ?? 'India',
            },
          },
        }),
      },
      include: {
        addresses: true,
        _count: {
          select: {
            departments: true,
            rooms: true,
            patients: true,
            users: true,
          },
        },
      },
    });

    return hospital;
  }

  // =========================================================
  // GET HOSPITAL DEPARTMENTS (PRD: GET /hospitals/:id/departments)
  // =========================================================
  async getHospitalDepartments(hospitalId: string) {
    await this.getHospitalById(hospitalId);

    return this.prisma.department.findMany({
      where: { hospitalId },
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
  // PROVISION HOSPITAL STAFF (PRD: Staff Onboarding by Admin)
  // =========================================================
  async createStaff(hospitalId: string, dto: CreateStaffDto, caller: AuthUser) {
    // 1. Enforce tenant isolation: HOSPITAL_ADMIN can only provision for their own hospital
    if (caller.role !== 'SUPER_ADMIN' && caller.hospitalId !== hospitalId) {
      throw new ForbiddenException(
        'Access denied: You can only provision staff for your own hospital',
      );
    }

    // 2. Prevent role escalation: HOSPITAL_ADMIN cannot provision another HOSPITAL_ADMIN
    if (caller.role !== 'SUPER_ADMIN' && dto.role === 'HOSPITAL_ADMIN') {
      throw new ForbiddenException(
        'Access denied: Only SUPER_ADMIN can provision hospital administrators',
      );
    }

    // 3. Verify target hospital exists
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
    });
    if (!hospital) {
      throw new NotFoundException('Hospital not found');
    }

    // 4. Verify email uniqueness
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    // 5. Look up specified staff role
    const role = await this.prisma.role.findUnique({
      where: { name: dto.role },
    });
    if (!role) {
      throw new NotFoundException(`Role ${dto.role} not found in system`);
    }

    // 6. Validate department belongs to this hospital if DOCTOR
    if (dto.role === 'DOCTOR' && dto.departmentId) {
      const department = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, hospitalId },
      });
      if (!department) {
        throw new BadRequestException(
          'Department does not belong to this hospital',
        );
      }
    }

    // 7. Hash password with bcrypt cost factor 12
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // 8. Create user record
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        hospitalId,
        roleId: role.id,
        emailVerified: true, // admin-provisioned account
      },
      include: {
        role: true,
        hospital: true,
      },
    });

    // 9. If DOCTOR and department provided, create Doctor entity
    let doctorRecord = null;
    if (dto.role === 'DOCTOR' && dto.departmentId) {
      doctorRecord = await this.prisma.doctor.create({
        data: {
          userId: user.id,
          departmentId: dto.departmentId,
          specialization: dto.specialization,
          licenseNumber: dto.licenseNumber,
          consultationFee: dto.consultationFee,
        },
        include: {
          department: {
            select: { id: true, name: true },
          },
        },
      });
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role.name,
      hospitalId: user.hospitalId,
      hospitalName: user.hospital.name,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      doctor: doctorRecord,
    };
  }

  // =========================================================
  // GET HOSPITAL STAFF (PRD: List Staff Scoped to Tenant)
  // =========================================================
  async getHospitalStaff(hospitalId: string, caller: AuthUser) {
    if (caller.role !== 'SUPER_ADMIN' && caller.hospitalId !== hospitalId) {
      throw new ForbiddenException(
        'Access denied: You can only view staff for your own hospital',
      );
    }

    return this.prisma.user.findMany({
      where: {
        hospitalId,
        role: {
          name: { not: 'PATIENT' },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        roleId: true,
        emailVerified: true,
        createdAt: true,
        role: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        doctor: {
          select: {
            id: true,
            departmentId: true,
            specialization: true,
            licenseNumber: true,
            consultationFee: true,
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
