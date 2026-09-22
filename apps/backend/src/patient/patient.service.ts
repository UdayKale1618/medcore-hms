import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { PatientQueryDto } from './dto/patient-query.dto';
import type { AuthUser } from '../auth/auth-user.interface';

const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  hospitalId: true,
  emailVerified: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class PatientService {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================================
  // CREATE PATIENT
  // =========================================================
  async createPatient(dto: CreatePatientDto, caller: AuthUser) {
    // 1. Determine and validate target hospital
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

    // Case A: Link to existing User
    if (dto.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: dto.userId },
        include: {
          role: true,
          patient: true,
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Enforce tenant isolation
      if (caller.role !== 'SUPER_ADMIN' && user.hospitalId !== hospitalId) {
        throw new ForbiddenException(
          'Cannot create patient profile for a user from another hospital',
        );
      }

      if (user.role.name !== 'PATIENT') {
        throw new BadRequestException('User does not have the PATIENT role');
      }

      if (user.patient && user.patient.deletedAt === null) {
        throw new ConflictException(
          'Patient profile already exists for this user',
        );
      }

      return this.prisma.patient.create({
        data: {
          userId: dto.userId,
          hospitalId,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
          gender: dto.gender,
          bloodGroup: dto.bloodGroup,
          emergencyContactName: dto.emergencyContactName,
          emergencyContactPhone: dto.emergencyContactPhone,
        },
        include: {
          user: {
            select: SAFE_USER_SELECT,
          },
          hospital: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    }

    // Case B: Create new User + Patient atomically
    if (!dto.email || !dto.name) {
      throw new BadRequestException('Name and email are required to register a new patient');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const patientRole = await this.prisma.role.findUnique({
      where: { name: 'PATIENT' },
    });

    if (!patientRole) {
      throw new NotFoundException('PATIENT role not configured in database');
    }

    const rawPassword = dto.password || randomBytes(16).toString('hex');
    const hashedPassword = await bcrypt.hash(rawPassword, 12);

    return this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: dto.name!,
          email: dto.email!,
          phone: dto.phone,
          passwordHash: hashedPassword,
          hospitalId,
          roleId: patientRole.id,
          emailVerified: false,
        },
      });

      const newPatient = await tx.patient.create({
        data: {
          userId: newUser.id,
          hospitalId,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
          gender: dto.gender,
          bloodGroup: dto.bloodGroup,
          emergencyContactName: dto.emergencyContactName,
          emergencyContactPhone: dto.emergencyContactPhone,
        },
        include: {
          user: {
            select: SAFE_USER_SELECT,
          },
          hospital: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return newPatient;
    });
  }

  // =========================================================
  // LIST PATIENTS (Tenant-isolated, excludes soft-deleted)
  // =========================================================
  async getPatients(query: PatientQueryDto, caller: AuthUser) {
    const whereClause: any = {
      deletedAt: null, // Consistently exclude soft-deleted records
    };

    // Enforce tenant isolation
    if (caller.role === 'SUPER_ADMIN') {
      if (query.hospitalId) {
        whereClause.hospitalId = query.hospitalId;
      }
    } else {
      if (!caller.hospitalId) {
        throw new BadRequestException('No hospital associated with this user');
      }
      whereClause.hospitalId = caller.hospitalId;
    }

    if (query.gender) {
      whereClause.gender = {
        equals: query.gender,
        mode: 'insensitive',
      };
    }

    if (query.bloodGroup) {
      whereClause.bloodGroup = query.bloodGroup;
    }

    if (query.search) {
      const search = query.search.trim();
      whereClause.OR = [
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { user: { phone: { contains: search, mode: 'insensitive' } } },
        { emergencyContactName: { contains: search, mode: 'insensitive' } },
        { emergencyContactPhone: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.patient.findMany({
      where: whereClause,
      include: {
        user: {
          select: SAFE_USER_SELECT,
        },
        hospital: {
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
  // GET PATIENT BY ID (Tenant-isolated)
  // =========================================================
  async getPatientById(id: string, caller: AuthUser) {
    const patient = await this.prisma.patient.findUnique({
      where: { id },
      include: {
        user: {
          select: SAFE_USER_SELECT,
        },
        hospital: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!patient || patient.deletedAt !== null) {
      throw new NotFoundException('Patient not found');
    }

    // Tenant isolation
    if (
      caller.role !== 'SUPER_ADMIN' &&
      patient.hospitalId !== caller.hospitalId
    ) {
      throw new ForbiddenException(
        'Access denied: Patient belongs to another hospital',
      );
    }

    // Patient role self-access constraint: patients can only access their own record
    if (caller.role === 'PATIENT' && patient.userId !== caller.userId) {
      throw new ForbiddenException(
        'Access denied: You can only access your own patient profile',
      );
    }

    return patient;
  }

  // =========================================================
  // GET CURRENT PATIENT PROFILE (Derived from caller's userId)
  // =========================================================
  async getCurrentPatient(caller: AuthUser) {
    const patient = await this.prisma.patient.findFirst({
      where: {
        userId: caller.userId,
        deletedAt: null,
      },
      include: {
        user: {
          select: SAFE_USER_SELECT,
        },
        hospital: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!patient) {
      throw new NotFoundException('Patient profile not found for this user');
    }

    return patient;
  }

  // =========================================================
  // UPDATE PATIENT PROFILE
  // =========================================================
  async updatePatient(id: string, dto: UpdatePatientDto, caller: AuthUser) {
    const patient = await this.getPatientById(id, caller);

    // Permission check
    const isOwner = caller.userId === patient.userId;
    const canManage =
      caller.role === 'HOSPITAL_ADMIN' ||
      caller.role === 'SUPER_ADMIN' ||
      caller.role === 'RECEPTIONIST' ||
      caller.role === 'NURSE';

    if (!isOwner && !canManage) {
      throw new ForbiddenException(
        'You do not have permission to update this patient record',
      );
    }

    const hasUserUpdates = dto.name !== undefined || dto.phone !== undefined;

    return this.prisma.$transaction(async (tx) => {
      if (hasUserUpdates) {
        await tx.user.update({
          where: { id: patient.userId },
          data: {
            ...(dto.name !== undefined && { name: dto.name }),
            ...(dto.phone !== undefined && { phone: dto.phone }),
          },
        });
      }

      const patientData: any = {};
      if (dto.dateOfBirth !== undefined) {
        patientData.dateOfBirth = dto.dateOfBirth
          ? new Date(dto.dateOfBirth)
          : null;
      }
      if (dto.gender !== undefined) patientData.gender = dto.gender;
      if (dto.bloodGroup !== undefined) patientData.bloodGroup = dto.bloodGroup;
      if (dto.emergencyContactName !== undefined) {
        patientData.emergencyContactName = dto.emergencyContactName;
      }
      if (dto.emergencyContactPhone !== undefined) {
        patientData.emergencyContactPhone = dto.emergencyContactPhone;
      }

      return tx.patient.update({
        where: { id },
        data: patientData,
        include: {
          user: {
            select: SAFE_USER_SELECT,
          },
          hospital: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    });
  }

  // =========================================================
  // DEACTIVATE / SOFT DELETE PATIENT
  // =========================================================
  async deletePatient(id: string, caller: AuthUser) {
    await this.getPatientById(id, caller);

    // Permission check: only HOSPITAL_ADMIN or SUPER_ADMIN can deactivate
    if (caller.role !== 'HOSPITAL_ADMIN' && caller.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'Only administrators can deactivate a patient record',
      );
    }

    await this.prisma.patient.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    return {
      message: 'Patient record deactivated successfully',
    };
  }
}
