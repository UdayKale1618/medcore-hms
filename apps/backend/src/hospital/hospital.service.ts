import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHospitalDto } from './dto/create-hospital.dto';
import { UpdateHospitalDto } from './dto/update-hospital.dto';

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
}
