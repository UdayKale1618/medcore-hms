import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';
import { MedicalRecordQueryDto } from './dto/medical-record-query.dto';
import type { AuthUser } from '../auth/auth-user.interface';

const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  hospitalId: true,
};

const MEDICAL_RECORD_INCLUDE = {
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
  doctor: {
    select: {
      id: true,
      specialization: true,
      licenseNumber: true,
      departmentId: true,
      user: {
        select: SAFE_USER_SELECT,
      },
      department: {
        select: {
          id: true,
          name: true,
          hospitalId: true,
        },
      },
    },
  },
  appointment: {
    select: {
      id: true,
      appointmentDate: true,
      startTime: true,
      endTime: true,
      status: true,
      type: true,
      reason: true,
    },
  },
};

@Injectable()
export class MedicalRecordService {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================================
  // CREATE MEDICAL RECORD (Doctor Encounter)
  // =========================================================
  async createMedicalRecord(dto: CreateMedicalRecordDto, caller: AuthUser) {
    // 1. Fetch Appointment with relations
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: dto.appointmentId },
      include: {
        doctor: {
          include: {
            user: true,
          },
        },
        patient: {
          include: {
            user: true,
          },
        },
        department: true,
      },
    });

    if (!appointment || appointment.deletedAt !== null) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.status === 'CANCELLED') {
      throw new BadRequestException(
        'Cannot create a medical record for a cancelled appointment',
      );
    }

    // 2. Verify one-to-one constraint: Appointment -> MedicalRecord
    const existingRecord = await this.prisma.medicalRecord.findUnique({
      where: { appointmentId: dto.appointmentId },
    });

    if (existingRecord) {
      throw new ConflictException(
        'A medical record already exists for this appointment',
      );
    }

    // 3. Tenancy Validation
    const hospitalId = appointment.department.hospitalId;

    if (caller.role !== 'SUPER_ADMIN') {
      if (hospitalId !== caller.hospitalId) {
        throw new ForbiddenException(
          'Access denied: Appointment belongs to another hospital',
        );
      }
      if (appointment.patient.hospitalId !== caller.hospitalId) {
        throw new ForbiddenException(
          'Access denied: Patient belongs to another hospital',
        );
      }
      if (appointment.doctor.user.hospitalId !== caller.hospitalId) {
        throw new ForbiddenException(
          'Access denied: Doctor belongs to another hospital',
        );
      }
    }

    // Cross-hospital consistency check
    if (
      appointment.doctor.user.hospitalId !== appointment.patient.hospitalId ||
      appointment.doctor.user.hospitalId !== appointment.department.hospitalId
    ) {
      throw new BadRequestException(
        'Doctor, Patient, and Department must belong to the same hospital',
      );
    }

    // 4. Validate doctor & patient IDs if explicitly passed in DTO
    if (dto.doctorId && dto.doctorId !== appointment.doctorId) {
      throw new BadRequestException(
        'Specified doctorId does not match the appointment assigned doctor',
      );
    }

    if (dto.patientId && dto.patientId !== appointment.patientId) {
      throw new BadRequestException(
        'Specified patientId does not match the appointment patient',
      );
    }

    // 5. Caller Permission Check: If DOCTOR, verify they are the assigned doctor
    if (caller.role === 'DOCTOR') {
      const callerDoctor = await this.prisma.doctor.findUnique({
        where: { userId: caller.userId },
      });

      if (!callerDoctor) {
        throw new NotFoundException('Doctor profile not found for user');
      }

      if (callerDoctor.id !== appointment.doctorId) {
        throw new ForbiddenException(
          'Only the assigned doctor can create the medical record for this appointment',
        );
      }
    }

    // 6. BMI auto-calculation if not provided
    let calculatedBmi = dto.bmi;
    if (!calculatedBmi && dto.height && dto.weight) {
      const heightInMeters = Number(dto.height) / 100;
      if (heightInMeters > 0) {
        calculatedBmi =
          Math.round((Number(dto.weight) / (heightInMeters * heightInMeters)) * 100) /
          100;
      }
    }

    // 7. Atomic creation & Appointment status transition to IN_PROGRESS
    return this.prisma.$transaction(async (tx) => {
      const record = await tx.medicalRecord.create({
        data: {
          appointmentId: appointment.id,
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          chiefComplaint: dto.chiefComplaint,
          symptoms: dto.symptoms,
          diagnosis: dto.diagnosis,
          icd10Code: dto.icd10Code,
          treatmentPlan: dto.treatmentPlan,
          allergies: dto.allergies,
          adverseDrugReactions: dto.adverseDrugReactions,
          bloodPressure: dto.bloodPressure,
          pulse: dto.pulse,
          temperature: dto.temperature,
          spo2: dto.spo2,
          height: dto.height,
          weight: dto.weight,
          bmi: calculatedBmi,
          familyHistory: dto.familyHistory,
          notes: dto.notes,
        },
        include: MEDICAL_RECORD_INCLUDE,
      });

      // Advance appointment status if PENDING or CONFIRMED
      if (
        appointment.status === 'PENDING' ||
        appointment.status === 'CONFIRMED'
      ) {
        await tx.appointment.update({
          where: { id: appointment.id },
          data: { status: 'IN_PROGRESS' },
        });
      }

      return record;
    });
  }

  // =========================================================
  // GET MEDICAL RECORD BY ID
  // =========================================================
  async getMedicalRecordById(id: string, caller: AuthUser) {
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id },
      include: MEDICAL_RECORD_INCLUDE,
    });

    if (!record) {
      throw new NotFoundException('Medical record not found');
    }

    // Tenancy Check
    if (
      caller.role !== 'SUPER_ADMIN' &&
      record.patient.hospitalId !== caller.hospitalId
    ) {
      throw new ForbiddenException(
        'Access denied: Medical record belongs to another hospital',
      );
    }

    // Patient Isolation Check: patients can only access their own records
    if (caller.role === 'PATIENT' && record.patient.user.id !== caller.userId) {
      throw new ForbiddenException(
        'Access denied: You can only access your own medical records',
      );
    }

    return record;
  }

  // =========================================================
  // GET MEDICAL RECORD BY APPOINTMENT ID
  // =========================================================
  async getMedicalRecordByAppointmentId(
    appointmentId: string,
    caller: AuthUser,
  ) {
    const record = await this.prisma.medicalRecord.findUnique({
      where: { appointmentId },
      include: MEDICAL_RECORD_INCLUDE,
    });

    if (!record) {
      throw new NotFoundException(
        'Medical record not found for this appointment',
      );
    }

    // Tenancy Check
    if (
      caller.role !== 'SUPER_ADMIN' &&
      record.patient.hospitalId !== caller.hospitalId
    ) {
      throw new ForbiddenException(
        'Access denied: Medical record belongs to another hospital',
      );
    }

    // Patient Isolation
    if (caller.role === 'PATIENT' && record.patient.user.id !== caller.userId) {
      throw new ForbiddenException(
        'Access denied: You can only access your own medical records',
      );
    }

    return record;
  }

  // =========================================================
  // LIST MEDICAL RECORDS (Filtered & Scoped)
  // =========================================================
  async getMedicalRecords(query: MedicalRecordQueryDto, caller: AuthUser) {
    const where: any = {};

    // Tenancy Filter
    if (caller.role === 'SUPER_ADMIN') {
      if (query.hospitalId) {
        where.patient = { hospitalId: query.hospitalId };
      }
    } else {
      where.patient = { hospitalId: caller.hospitalId };
    }

    // Patient Role Isolation: strictly enforce patient ownership
    if (caller.role === 'PATIENT') {
      const patientProfile = await this.prisma.patient.findUnique({
        where: { userId: caller.userId },
      });

      if (!patientProfile) {
        return [];
      }

      if (query.patientId && query.patientId !== patientProfile.id) {
        throw new ForbiddenException(
          'Access denied: You cannot view medical records for other patients',
        );
      }

      where.patientId = patientProfile.id;
    } else if (query.patientId) {
      where.patientId = query.patientId;
    }

    // Doctor filter
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

    if (query.appointmentId) {
      where.appointmentId = query.appointmentId;
    }

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { diagnosis: { contains: search, mode: 'insensitive' } },
        { chiefComplaint: { contains: search, mode: 'insensitive' } },
        { symptoms: { contains: search, mode: 'insensitive' } },
        { treatmentPlan: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.medicalRecord.findMany({
      where,
      include: MEDICAL_RECORD_INCLUDE,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // =========================================================
  // UPDATE MEDICAL RECORD (Clinical updates / Append Notes)
  // =========================================================
  async updateMedicalRecord(
    id: string,
    dto: UpdateMedicalRecordDto,
    caller: AuthUser,
  ) {
    // 1. Fetch record and verify existence & tenancy
    const record = await this.getMedicalRecordById(id, caller);

    // 2. Role Permission Check: Only DOCTOR, HOSPITAL_ADMIN, or SUPER_ADMIN
    if (
      caller.role !== 'DOCTOR' &&
      caller.role !== 'HOSPITAL_ADMIN' &&
      caller.role !== 'SUPER_ADMIN'
    ) {
      throw new ForbiddenException(
        'You do not have permission to update medical records',
      );
    }

    // 3. Treating Doctor Verification
    if (caller.role === 'DOCTOR') {
      const callerDoctor = await this.prisma.doctor.findUnique({
        where: { userId: caller.userId },
      });

      if (callerDoctor && callerDoctor.id !== record.doctorId) {
        throw new ForbiddenException(
          'Only the treating doctor can update this medical record',
        );
      }
    }

    // 4. Recalculate BMI if height or weight changed
    let updatedBmi = dto.bmi !== undefined ? dto.bmi : record.bmi;
    const height = dto.height !== undefined ? dto.height : record.height;
    const weight = dto.weight !== undefined ? dto.weight : record.weight;

    if (dto.bmi === undefined && height && weight) {
      const heightInMeters = Number(height) / 100;
      if (heightInMeters > 0) {
        updatedBmi = (
          Math.round((Number(weight) / (heightInMeters * heightInMeters)) * 100) /
          100
        ) as any;
      }
    }

    return this.prisma.medicalRecord.update({
      where: { id },
      data: {
        ...(dto.chiefComplaint !== undefined && {
          chiefComplaint: dto.chiefComplaint,
        }),
        ...(dto.symptoms !== undefined && { symptoms: dto.symptoms }),
        ...(dto.diagnosis !== undefined && { diagnosis: dto.diagnosis }),
        ...(dto.icd10Code !== undefined && { icd10Code: dto.icd10Code }),
        ...(dto.treatmentPlan !== undefined && {
          treatmentPlan: dto.treatmentPlan,
        }),
        ...(dto.allergies !== undefined && { allergies: dto.allergies }),
        ...(dto.adverseDrugReactions !== undefined && {
          adverseDrugReactions: dto.adverseDrugReactions,
        }),
        ...(dto.bloodPressure !== undefined && {
          bloodPressure: dto.bloodPressure,
        }),
        ...(dto.pulse !== undefined && { pulse: dto.pulse }),
        ...(dto.temperature !== undefined && {
          temperature: dto.temperature,
        }),
        ...(dto.spo2 !== undefined && { spo2: dto.spo2 }),
        ...(dto.height !== undefined && { height: dto.height }),
        ...(dto.weight !== undefined && { weight: dto.weight }),
        ...(updatedBmi !== undefined && { bmi: updatedBmi }),
        ...(dto.familyHistory !== undefined && {
          familyHistory: dto.familyHistory,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: MEDICAL_RECORD_INCLUDE,
    });
  }
}
