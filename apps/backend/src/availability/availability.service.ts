import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import type { AuthUser } from '../auth/auth-user.interface';

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================================
  // CREATE DOCTOR AVAILABILITY
  // =========================================================
  async createAvailability(
    doctorId: string,
    dto: CreateAvailabilityDto,
    caller: AuthUser,
  ) {
    const startMinutes = timeToMinutes(dto.startTime);
    const endMinutes = timeToMinutes(dto.endTime);
    const slotMinutes = dto.slotMinutes ?? 30;

    // Time validation
    if (startMinutes >= endMinutes) {
      throw new BadRequestException('startTime must be strictly before endTime');
    }

    if (endMinutes - startMinutes < slotMinutes) {
      throw new BadRequestException(
        `Time range must be at least ${slotMinutes} minutes long`,
      );
    }

    // Doctor existence & tenant validation
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
      include: {
        user: true,
      },
    });

    if (!doctor || doctor.deletedAt !== null) {
      throw new NotFoundException('Doctor not found');
    }

    // Tenant isolation
    if (
      caller.role !== 'SUPER_ADMIN' &&
      doctor.user.hospitalId !== caller.hospitalId
    ) {
      throw new ForbiddenException(
        'Access denied: Doctor belongs to another hospital',
      );
    }

    // Permission check: Doctor owner, HOSPITAL_ADMIN, or SUPER_ADMIN
    const isOwner = caller.userId === doctor.userId;
    const isAdmin =
      caller.role === 'HOSPITAL_ADMIN' || caller.role === 'SUPER_ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'You do not have permission to manage this doctor availability',
      );
    }

    // Overlap / conflicting schedule detection for the same doctor and day
    const existingSlots = await this.prisma.doctorAvailability.findMany({
      where: {
        doctorId,
        dayOfWeek: dto.dayOfWeek,
      },
    });

    for (const slot of existingSlots) {
      const slotStart = timeToMinutes(slot.startTime);
      const slotEnd = timeToMinutes(slot.endTime);

      if (startMinutes < slotEnd && endMinutes > slotStart) {
        throw new ConflictException(
          `Availability time range (${dto.startTime} - ${dto.endTime}) overlaps with an existing schedule (${slot.startTime} - ${slot.endTime}) on day ${dto.dayOfWeek}`,
        );
      }
    }

    return this.prisma.doctorAvailability.create({
      data: {
        doctorId,
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
        slotMinutes,
      },
    });
  }

  // =========================================================
  // GET DOCTOR AVAILABILITY
  // =========================================================
  async getDoctorAvailability(doctorId: string, caller: AuthUser) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
      include: {
        user: true,
      },
    });

    if (!doctor || doctor.deletedAt !== null) {
      throw new NotFoundException('Doctor not found');
    }

    // Tenant isolation
    if (
      caller.role !== 'SUPER_ADMIN' &&
      doctor.user.hospitalId !== caller.hospitalId
    ) {
      throw new ForbiddenException(
        'Access denied: Doctor belongs to another hospital',
      );
    }

    return this.prisma.doctorAvailability.findMany({
      where: { doctorId },
      orderBy: [
        { dayOfWeek: 'asc' },
        { startTime: 'asc' },
      ],
    });
  }

  // =========================================================
  // GET AVAILABILITY BY ID
  // =========================================================
  async getAvailabilityById(id: string, caller: AuthUser) {
    const availability = await this.prisma.doctorAvailability.findUnique({
      where: { id },
      include: {
        doctor: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!availability || availability.doctor.deletedAt !== null) {
      throw new NotFoundException('Availability schedule not found');
    }

    if (
      caller.role !== 'SUPER_ADMIN' &&
      availability.doctor.user.hospitalId !== caller.hospitalId
    ) {
      throw new ForbiddenException(
        'Access denied: Schedule belongs to another hospital',
      );
    }

    return availability;
  }

  // =========================================================
  // UPDATE AVAILABILITY
  // =========================================================
  async updateAvailability(
    id: string,
    dto: UpdateAvailabilityDto,
    caller: AuthUser,
  ) {
    const availability = await this.getAvailabilityById(id, caller);
    const doctor = availability.doctor;

    // Permission check
    const isOwner = caller.userId === doctor.userId;
    const isAdmin =
      caller.role === 'HOSPITAL_ADMIN' || caller.role === 'SUPER_ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'You do not have permission to update this availability schedule',
      );
    }

    const newDayOfWeek =
      dto.dayOfWeek !== undefined ? dto.dayOfWeek : availability.dayOfWeek;
    const newStartTime = dto.startTime ?? availability.startTime;
    const newEndTime = dto.endTime ?? availability.endTime;
    const newSlotMinutes = dto.slotMinutes ?? availability.slotMinutes;

    const startMinutes = timeToMinutes(newStartTime);
    const endMinutes = timeToMinutes(newEndTime);

    if (startMinutes >= endMinutes) {
      throw new BadRequestException('startTime must be strictly before endTime');
    }

    if (endMinutes - startMinutes < newSlotMinutes) {
      throw new BadRequestException(
        `Time range must be at least ${newSlotMinutes} minutes long`,
      );
    }

    // Overlap check excluding current record
    const existingSlots = await this.prisma.doctorAvailability.findMany({
      where: {
        doctorId: doctor.id,
        dayOfWeek: newDayOfWeek,
        id: { not: id },
      },
    });

    for (const slot of existingSlots) {
      const slotStart = timeToMinutes(slot.startTime);
      const slotEnd = timeToMinutes(slot.endTime);

      if (startMinutes < slotEnd && endMinutes > slotStart) {
        throw new ConflictException(
          `Updated time range (${newStartTime} - ${newEndTime}) overlaps with an existing schedule (${slot.startTime} - ${slot.endTime}) on day ${newDayOfWeek}`,
        );
      }
    }

    return this.prisma.doctorAvailability.update({
      where: { id },
      data: {
        dayOfWeek: newDayOfWeek,
        startTime: newStartTime,
        endTime: newEndTime,
        slotMinutes: newSlotMinutes,
      },
    });
  }

  // =========================================================
  // DELETE AVAILABILITY
  // =========================================================
  async deleteAvailability(id: string, caller: AuthUser) {
    const availability = await this.getAvailabilityById(id, caller);
    const doctor = availability.doctor;

    const isOwner = caller.userId === doctor.userId;
    const isAdmin =
      caller.role === 'HOSPITAL_ADMIN' || caller.role === 'SUPER_ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'You do not have permission to delete this availability schedule',
      );
    }

    await this.prisma.doctorAvailability.delete({
      where: { id },
    });

    return {
      message: 'Availability schedule deleted successfully',
    };
  }
}
