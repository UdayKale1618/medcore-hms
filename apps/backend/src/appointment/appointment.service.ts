import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import {
  AppointmentType,
  CreateAppointmentDto,
} from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import {
  AppointmentStatus,
  UpdateAppointmentStatusDto,
} from './dto/update-appointment-status.dto';
import { AppointmentQueryDto } from './dto/appointment-query.dto';
import type { AuthUser } from '../auth/auth-user.interface';

const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  hospitalId: true,
};

const APPOINTMENT_INCLUDE = {
  doctor: {
    select: {
      id: true,
      specialization: true,
      licenseNumber: true,
      consultationFee: true,
      departmentId: true,
      user: {
        select: SAFE_USER_SELECT,
      },
    },
  },
  patient: {
    select: {
      id: true,
      dateOfBirth: true,
      gender: true,
      bloodGroup: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      hospitalId: true,
      user: {
        select: SAFE_USER_SELECT,
      },
    },
  },
  department: {
    select: {
      id: true,
      name: true,
      hospitalId: true,
    },
  },
};

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function extractTimeAndDay(
  dateStr: string,
  dateObj: Date,
): { dayOfWeek: number; minutes: number } {
  const isUtc =
    dateStr.endsWith('Z') ||
    dateStr.includes('+') ||
    (dateStr.length > 10 && dateStr.slice(10).includes('-'));

  const dayOfWeek = isUtc ? dateObj.getUTCDay() : dateObj.getDay();
  const hours = isUtc ? dateObj.getUTCHours() : dateObj.getHours();
  const mins = isUtc ? dateObj.getUTCMinutes() : dateObj.getMinutes();

  return { dayOfWeek, minutes: hours * 60 + mins };
}

@Injectable()
export class AppointmentService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notificationService?: NotificationService,
  ) {}

  // =========================================================
  // CREATE APPOINTMENT
  // =========================================================
  async createAppointment(dto: CreateAppointmentDto, caller: AuthUser) {
    // 1. Resolve Patient ID
    let resolvedPatientId: string;

    if (caller.role === 'PATIENT') {
      const patientProfile = await this.prisma.patient.findUnique({
        where: { userId: caller.userId },
      });

      if (!patientProfile || patientProfile.deletedAt !== null) {
        throw new NotFoundException(
          'Patient profile not found for authenticated user',
        );
      }

      resolvedPatientId = patientProfile.id;
    } else {
      if (!dto.patientId) {
        throw new BadRequestException('patientId is required');
      }

      const patient = await this.prisma.patient.findUnique({
        where: { id: dto.patientId },
      });

      if (!patient || patient.deletedAt !== null) {
        throw new NotFoundException('Patient not found');
      }

      resolvedPatientId = patient.id;
    }

    const patient = await this.prisma.patient.findUnique({
      where: { id: resolvedPatientId },
    });

    if (!patient || patient.deletedAt !== null) {
      throw new NotFoundException('Patient not found');
    }

    // 2. Validate Doctor
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: dto.doctorId },
      include: {
        user: true,
        department: true,
      },
    });

    if (!doctor || doctor.deletedAt !== null) {
      throw new NotFoundException('Doctor not found');
    }

    // 3. Validate Department
    const department = await this.prisma.department.findUnique({
      where: { id: dto.departmentId },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    // 4. Validate Doctor-Department relationship
    if (doctor.departmentId !== department.id) {
      throw new BadRequestException(
        'Doctor does not belong to the selected department',
      );
    }

    // 5. Tenancy Validation
    const hospitalId =
      caller.role === 'SUPER_ADMIN'
        ? dto.hospitalId || doctor.user.hospitalId
        : caller.hospitalId;

    if (caller.role !== 'SUPER_ADMIN') {
      if (doctor.user.hospitalId !== hospitalId) {
        throw new ForbiddenException(
          'Access denied: Doctor belongs to another hospital',
        );
      }
      if (patient.hospitalId !== hospitalId) {
        throw new ForbiddenException(
          'Access denied: Patient belongs to another hospital',
        );
      }
      if (department.hospitalId !== hospitalId) {
        throw new ForbiddenException(
          'Access denied: Department belongs to another hospital',
        );
      }
    } else {
      if (
        doctor.user.hospitalId !== patient.hospitalId ||
        doctor.user.hospitalId !== department.hospitalId
      ) {
        throw new BadRequestException(
          'Doctor, Patient, and Department must all belong to the same hospital',
        );
      }
    }

    // 6. Validate Date & Time
    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);
    const appointmentDate = new Date(dto.appointmentDate);

    if (
      isNaN(start.getTime()) ||
      isNaN(end.getTime()) ||
      isNaN(appointmentDate.getTime())
    ) {
      throw new BadRequestException('Invalid date/time provided');
    }

    if (start >= end) {
      throw new BadRequestException('startTime must be strictly before endTime');
    }

    const type = dto.type || AppointmentType.REGULAR;

    // 7. Validate Doctor Availability (Emergency bookings bypass this schedule check)
    if (type !== AppointmentType.EMERGENCY) {
      const { dayOfWeek, minutes: startMinutes } = extractTimeAndDay(
        dto.startTime,
        start,
      );
      const { minutes: endMinutes } = extractTimeAndDay(dto.endTime, end);

      const availabilities = await this.prisma.doctorAvailability.findMany({
        where: {
          doctorId: doctor.id,
          dayOfWeek,
        },
      });

      if (availabilities.length === 0) {
        throw new BadRequestException(
          `Doctor has no availability scheduled on this day of the week (${dayOfWeek})`,
        );
      }

      const fitsInSlot = availabilities.some((avail) => {
        const slotStart = timeToMinutes(avail.startTime);
        const slotEnd = timeToMinutes(avail.endTime);
        return startMinutes >= slotStart && endMinutes <= slotEnd;
      });

      if (!fitsInSlot) {
        throw new BadRequestException(
          'Requested appointment time is outside doctor availability schedule',
        );
      }
    }

    // 8. Transactional Concurrency Protection & Conflict Check
    return this.prisma.$transaction(async (tx) => {
      // Acquire database row locks on Doctor and Patient to serialize concurrent bookings
      await tx.$queryRaw`SELECT id FROM "Doctor" WHERE id = ${doctor.id} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Patient" WHERE id = ${resolvedPatientId} FOR UPDATE`;

      // Re-check conflicting appointments INSIDE the protected transaction
      const doctorConflict = await tx.appointment.findFirst({
        where: {
          doctorId: doctor.id,
          deletedAt: null,
          status: { notIn: [AppointmentStatus.CANCELLED] },
          startTime: { lt: end },
          endTime: { gt: start },
        },
      });

      if (doctorConflict) {
        throw new ConflictException(
          'Doctor already has an appointment scheduled during this time slot',
        );
      }

      const patientConflict = await tx.appointment.findFirst({
        where: {
          patientId: resolvedPatientId,
          deletedAt: null,
          status: { notIn: [AppointmentStatus.CANCELLED] },
          startTime: { lt: end },
          endTime: { gt: start },
        },
      });

      if (patientConflict) {
        throw new ConflictException(
          'Patient already has an appointment scheduled during this time slot',
        );
      }

      // 9. Create Appointment atomically inside transaction
      return tx.appointment.create({
        data: {
          doctorId: doctor.id,
          patientId: resolvedPatientId,
          departmentId: department.id,
          appointmentDate,
          startTime: start,
          endTime: end,
          status: AppointmentStatus.PENDING,
          type,
          reason: dto.reason,
          notes: dto.notes,
        },
        include: APPOINTMENT_INCLUDE,
      });
    });
  }

  // =========================================================
  // LIST APPOINTMENTS
  // =========================================================
  async getAppointments(query: AppointmentQueryDto, caller: AuthUser) {
    const where: any = {
      deletedAt: null,
    };

    // Tenant isolation
    if (caller.role === 'SUPER_ADMIN') {
      if (query.hospitalId) {
        where.department = { hospitalId: query.hospitalId };
      }
    } else {
      where.department = { hospitalId: caller.hospitalId };
    }

    // Patient role isolation: patients can only list their own appointments
    if (caller.role === 'PATIENT') {
      const patientProfile = await this.prisma.patient.findUnique({
        where: { userId: caller.userId },
      });

      if (!patientProfile) {
        return [];
      }

      if (query.patientId && query.patientId !== patientProfile.id) {
        throw new ForbiddenException(
          'Access denied: You cannot view appointments for other patients',
        );
      }

      where.patientId = patientProfile.id;
    } else if (query.patientId) {
      where.patientId = query.patientId;
    }

    // Doctor role filtering
    if (caller.role === 'DOCTOR') {
      const doctorProfile = await this.prisma.doctor.findUnique({
        where: { userId: caller.userId },
      });

      if (doctorProfile) {
        where.doctorId = query.doctorId || doctorProfile.id;
      } else if (query.doctorId) {
        where.doctorId = query.doctorId;
      }
    } else if (query.doctorId) {
      where.doctorId = query.doctorId;
    }

    if (query.departmentId) {
      where.departmentId = query.departmentId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.date) {
      const dayStart = new Date(`${query.date}T00:00:00.000Z`);
      const dayEnd = new Date(`${query.date}T23:59:59.999Z`);
      where.appointmentDate = {
        gte: dayStart,
        lte: dayEnd,
      };
    }

    if (query.startDate || query.endDate) {
      where.appointmentDate = {
        ...(query.startDate && { gte: new Date(query.startDate) }),
        ...(query.endDate && { lte: new Date(query.endDate) }),
      };
    }

    return this.prisma.appointment.findMany({
      where,
      include: APPOINTMENT_INCLUDE,
      orderBy: {
        startTime: 'asc',
      },
    });
  }

  // =========================================================
  // GET APPOINTMENT BY ID
  // =========================================================
  async getAppointmentById(id: string, caller: AuthUser) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: APPOINTMENT_INCLUDE,
    });

    if (!appointment || appointment.deletedAt !== null) {
      throw new NotFoundException('Appointment not found');
    }

    // Tenant Isolation
    if (
      caller.role !== 'SUPER_ADMIN' &&
      appointment.department.hospitalId !== caller.hospitalId
    ) {
      throw new ForbiddenException(
        'Access denied: Appointment belongs to another hospital',
      );
    }

    // Patient Isolation
    if (
      caller.role === 'PATIENT' &&
      appointment.patient.user.id !== caller.userId
    ) {
      throw new ForbiddenException(
        'Access denied: You can only access your own appointments',
      );
    }

    return appointment;
  }

  // =========================================================
  // GET CURRENT USER APPOINTMENTS (/appointments/me)
  // =========================================================
  async getCurrentUserAppointments(caller: AuthUser) {
    if (caller.role === 'PATIENT') {
      const patientProfile = await this.prisma.patient.findUnique({
        where: { userId: caller.userId },
      });

      if (!patientProfile) {
        return [];
      }

      return this.prisma.appointment.findMany({
        where: {
          patientId: patientProfile.id,
          deletedAt: null,
        },
        include: APPOINTMENT_INCLUDE,
        orderBy: { startTime: 'asc' },
      });
    }

    if (caller.role === 'DOCTOR') {
      const doctorProfile = await this.prisma.doctor.findUnique({
        where: { userId: caller.userId },
      });

      if (!doctorProfile) {
        return [];
      }

      return this.prisma.appointment.findMany({
        where: {
          doctorId: doctorProfile.id,
          deletedAt: null,
        },
        include: APPOINTMENT_INCLUDE,
        orderBy: { startTime: 'asc' },
      });
    }

    // For other staff roles, return appointments for their hospital
    return this.getAppointments({}, caller);
  }

  // =========================================================
  // UPDATE APPOINTMENT (Details / Rescheduling)
  // =========================================================
  async updateAppointment(
    id: string,
    dto: UpdateAppointmentDto,
    caller: AuthUser,
  ) {
    const appointment = await this.getAppointmentById(id, caller);

    // Terminal state protection
    if (
      appointment.status === AppointmentStatus.COMPLETED ||
      appointment.status === AppointmentStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot modify an appointment that is already ${appointment.status}`,
      );
    }

    // Patient permission check: patient can only update reason/notes or reschedule own pending appointment
    if (caller.role === 'PATIENT') {
      if (appointment.status !== AppointmentStatus.PENDING) {
        throw new ForbiddenException(
          'Patients can only modify appointments that are in PENDING status',
        );
      }
    }

    const doctorId = dto.doctorId || appointment.doctorId;
    const departmentId = dto.departmentId || appointment.departmentId;

    // If department or doctor is changing, validate relationship
    if (dto.doctorId || dto.departmentId) {
      const doctor = await this.prisma.doctor.findUnique({
        where: { id: doctorId },
        include: { user: true },
      });

      if (!doctor || doctor.deletedAt !== null) {
        throw new NotFoundException('Doctor not found');
      }

      if (doctor.departmentId !== departmentId) {
        throw new BadRequestException(
          'Doctor does not belong to the selected department',
        );
      }

      if (
        caller.role !== 'SUPER_ADMIN' &&
        doctor.user.hospitalId !== caller.hospitalId
      ) {
        throw new ForbiddenException(
          'Access denied: Doctor belongs to another hospital',
        );
      }
    }

    const newStart = dto.startTime
      ? new Date(dto.startTime)
      : appointment.startTime;
    const newEnd = dto.endTime ? new Date(dto.endTime) : appointment.endTime;
    const newDate = dto.appointmentDate
      ? new Date(dto.appointmentDate)
      : appointment.appointmentDate;
    const newType =
      dto.type || (appointment.type as AppointmentType) || AppointmentType.REGULAR;

    if (newStart >= newEnd) {
      throw new BadRequestException('startTime must be strictly before endTime');
    }

    const isTimeChanged = dto.startTime || dto.endTime || dto.doctorId;

    if (isTimeChanged) {
      // 1. Availability check (unless emergency)
      if (newType !== AppointmentType.EMERGENCY) {
        const startStr = dto.startTime || appointment.startTime.toISOString();
        const endStr = dto.endTime || appointment.endTime.toISOString();

        const { dayOfWeek, minutes: startMinutes } = extractTimeAndDay(
          startStr,
          newStart,
        );
        const { minutes: endMinutes } = extractTimeAndDay(endStr, newEnd);

        const availabilities = await this.prisma.doctorAvailability.findMany({
          where: {
            doctorId,
            dayOfWeek,
          },
        });

        if (availabilities.length === 0) {
          throw new BadRequestException(
            `Doctor has no availability scheduled on day ${dayOfWeek}`,
          );
        }

        const fitsInSlot = availabilities.some((avail) => {
          const slotStart = timeToMinutes(avail.startTime);
          const slotEnd = timeToMinutes(avail.endTime);
          return startMinutes >= slotStart && endMinutes <= slotEnd;
        });

        if (!fitsInSlot) {
          throw new BadRequestException(
            'Requested appointment time is outside doctor availability schedule',
          );
        }
      }

      // 2. Transactional Concurrency Protection & Conflict checks
      return this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Doctor" WHERE id = ${doctorId} FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM "Patient" WHERE id = ${appointment.patientId} FOR UPDATE`;

        const doctorConflict = await tx.appointment.findFirst({
          where: {
            id: { not: id },
            doctorId,
            deletedAt: null,
            status: { notIn: [AppointmentStatus.CANCELLED] },
            startTime: { lt: newEnd },
            endTime: { gt: newStart },
          },
        });

        if (doctorConflict) {
          throw new ConflictException(
            'Doctor already has an appointment scheduled during this time slot',
          );
        }

        const patientConflict = await tx.appointment.findFirst({
          where: {
            id: { not: id },
            patientId: appointment.patientId,
            deletedAt: null,
            status: { notIn: [AppointmentStatus.CANCELLED] },
            startTime: { lt: newEnd },
            endTime: { gt: newStart },
          },
        });

        if (patientConflict) {
          throw new ConflictException(
            'Patient already has an appointment scheduled during this time slot',
          );
        }

        return tx.appointment.update({
          where: { id },
          data: {
            ...(dto.doctorId && { doctorId: dto.doctorId }),
            ...(dto.departmentId && { departmentId: dto.departmentId }),
            ...(dto.appointmentDate && { appointmentDate: newDate }),
            ...(dto.startTime && { startTime: newStart }),
            ...(dto.endTime && { endTime: newEnd }),
            ...(dto.type && { type: dto.type }),
            ...(dto.reason !== undefined && { reason: dto.reason }),
            ...(dto.notes !== undefined && { notes: dto.notes }),
          },
          include: APPOINTMENT_INCLUDE,
        });
      });
    }

    return this.prisma.appointment.update({
      where: { id },
      data: {
        ...(dto.doctorId && { doctorId: dto.doctorId }),
        ...(dto.departmentId && { departmentId: dto.departmentId }),
        ...(dto.appointmentDate && { appointmentDate: newDate }),
        ...(dto.startTime && { startTime: newStart }),
        ...(dto.endTime && { endTime: newEnd }),
        ...(dto.type && { type: dto.type }),
        ...(dto.reason !== undefined && { reason: dto.reason }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: APPOINTMENT_INCLUDE,
    });
  }

  // =========================================================
  // UPDATE APPOINTMENT STATUS (State Transitions)
  // =========================================================
  async updateAppointmentStatus(
    id: string,
    dto: UpdateAppointmentStatusDto,
    caller: AuthUser,
  ) {
    const appointment = await this.getAppointmentById(id, caller);
    const currentStatus = appointment.status as AppointmentStatus;
    const targetStatus = dto.status;

    // Terminal status protection
    if (
      currentStatus === AppointmentStatus.COMPLETED ||
      currentStatus === AppointmentStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot change status of an appointment that is already ${currentStatus}`,
      );
    }

    if (currentStatus === targetStatus) {
      return appointment;
    }

    // Role-specific transition rules
    if (caller.role === 'PATIENT') {
      if (targetStatus !== AppointmentStatus.CANCELLED) {
        throw new ForbiddenException(
          'Patients are only permitted to cancel their appointments',
        );
      }
      if (
        currentStatus !== AppointmentStatus.PENDING &&
        currentStatus !== AppointmentStatus.CONFIRMED
      ) {
        throw new BadRequestException(
          'Cannot cancel an appointment that is already in progress or completed',
        );
      }
    }

    // Doctor permissions
    if (caller.role === 'DOCTOR') {
      const doctorProfile = await this.prisma.doctor.findUnique({
        where: { userId: caller.userId },
      });

      if (doctorProfile && appointment.doctorId !== doctorProfile.id) {
        throw new ForbiddenException(
          'Doctors can only update the status of their assigned appointments',
        );
      }
    }

    // Workflow transition validation:
    // PENDING -> CONFIRMED, CANCELLED, NO_SHOW
    // CONFIRMED -> IN_PROGRESS, CANCELLED, NO_SHOW
    // IN_PROGRESS -> COMPLETED, CANCELLED
    const validTransitions: Record<AppointmentStatus, AppointmentStatus[]> = {
      [AppointmentStatus.PENDING]: [
        AppointmentStatus.CONFIRMED,
        AppointmentStatus.CANCELLED,
        AppointmentStatus.NO_SHOW,
      ],
      [AppointmentStatus.CONFIRMED]: [
        AppointmentStatus.IN_PROGRESS,
        AppointmentStatus.CANCELLED,
        AppointmentStatus.NO_SHOW,
      ],
      [AppointmentStatus.IN_PROGRESS]: [
        AppointmentStatus.COMPLETED,
        AppointmentStatus.CANCELLED,
      ],
      [AppointmentStatus.COMPLETED]: [],
      [AppointmentStatus.CANCELLED]: [],
      [AppointmentStatus.NO_SHOW]: [AppointmentStatus.CANCELLED],
    };

    const allowed = validTransitions[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${targetStatus}`,
      );
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: targetStatus },
      include: APPOINTMENT_INCLUDE,
    });

    if (this.notificationService && updated.patient?.user?.id) {
      const eventType =
        targetStatus === AppointmentStatus.CONFIRMED
          ? 'appointment.confirmed'
          : targetStatus === AppointmentStatus.CANCELLED
            ? 'appointment.cancelled'
            : 'appointment.updated';

      await this.notificationService.dispatch({
        userId: updated.patient.user.id,
        hospitalId: updated.patient.hospitalId,
        type: eventType,
        title: `Appointment ${targetStatus}`,
        message: `Your appointment with Dr. ${updated.doctor.user.name} on ${updated.appointmentDate.toISOString().slice(0, 10)} is ${targetStatus.toLowerCase()}.`,
        entityType: 'Appointment',
        entityId: id,
      });
    }

    return updated;
  }

  // =========================================================
  // SOFT DELETE / CANCEL APPOINTMENT
  // =========================================================
  async deleteAppointment(id: string, caller: AuthUser) {
    const appointment = await this.getAppointmentById(id, caller);

    // Permission check
    const isPatient = caller.role === 'PATIENT';
    const isStaff =
      caller.role === 'HOSPITAL_ADMIN' ||
      caller.role === 'SUPER_ADMIN' ||
      caller.role === 'RECEPTIONIST';

    if (!isPatient && !isStaff) {
      throw new ForbiddenException(
        'You do not have permission to delete this appointment',
      );
    }

    if (isPatient) {
      if (
        appointment.status !== AppointmentStatus.PENDING &&
        appointment.status !== AppointmentStatus.CONFIRMED
      ) {
        throw new BadRequestException(
          'Cannot delete an appointment that is already in progress or completed',
        );
      }
    }

    await this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.CANCELLED,
        deletedAt: new Date(),
      },
    });

    return {
      message: 'Appointment cancelled and removed successfully',
    };
  }
}
