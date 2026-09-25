import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { PrescriptionQueryDto } from './dto/prescription-query.dto';
import type { AuthUser } from '../auth/auth-user.interface';

const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  hospitalId: true,
};

export const PRESCRIPTION_INCLUDE = {
  medicalRecord: {
    select: {
      id: true,
      appointmentId: true,
      patientId: true,
      doctorId: true,
      diagnosis: true,
      symptoms: true,
      treatmentPlan: true,
      patient: {
        select: {
          id: true,
          dateOfBirth: true,
          gender: true,
          bloodGroup: true,
          emergencyContactName: true,
          emergencyContactPhone: true,
          hospitalId: true,
          userId: true,
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
          userId: true,
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
          department: {
            select: {
              id: true,
              name: true,
              hospitalId: true,
            },
          },
        },
      },
    },
  },
  items: {
    include: {
      medicine: {
        select: {
          id: true,
          hospitalId: true,
          name: true,
          form: true,
          description: true,
          reorderLevel: true,
        },
      },
    },
  },
};

@Injectable()
export class PrescriptionService {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================================
  // CREATE PRESCRIPTION (Atomic with Items)
  // =========================================================
  async createPrescription(dto: CreatePrescriptionDto, caller: AuthUser) {
    // 1. Fetch MedicalRecord with relations
    const medicalRecord = await this.prisma.medicalRecord.findUnique({
      where: { id: dto.medicalRecordId },
      include: {
        appointment: {
          include: {
            department: true,
          },
        },
        patient: {
          include: {
            user: true,
          },
        },
        doctor: {
          include: {
            user: true,
            department: true,
          },
        },
      },
    });

    if (!medicalRecord) {
      throw new NotFoundException('Medical record not found');
    }

    // 2. Validate appointment
    if (
      !medicalRecord.appointment ||
      medicalRecord.appointment.deletedAt !== null
    ) {
      throw new NotFoundException('Associated appointment not found');
    }

    if (medicalRecord.appointment.status === 'CANCELLED') {
      throw new BadRequestException(
        'Cannot create prescription for a cancelled appointment encounter',
      );
    }

    // 3. Validate Patient & Doctor existence
    if (!medicalRecord.patient) {
      throw new NotFoundException('Patient record not found');
    }
    if (!medicalRecord.doctor) {
      throw new NotFoundException('Doctor record not found');
    }

    // 4. Tenancy validation
    const hospitalId = medicalRecord.patient.hospitalId;

    if (caller.role !== 'SUPER_ADMIN') {
      if (hospitalId !== caller.hospitalId) {
        throw new ForbiddenException(
          'Access denied: Medical record belongs to another hospital',
        );
      }
      if (medicalRecord.doctor.user.hospitalId !== caller.hospitalId) {
        throw new ForbiddenException(
          'Access denied: Doctor belongs to another hospital',
        );
      }
      if (
        medicalRecord.appointment.department.hospitalId !== caller.hospitalId
      ) {
        throw new ForbiddenException(
          'Access denied: Appointment belongs to another hospital',
        );
      }
    }

    // Cross-hospital consistency check
    if (
      medicalRecord.doctor.user.hospitalId !== hospitalId ||
      medicalRecord.appointment.department.hospitalId !== hospitalId
    ) {
      throw new BadRequestException(
        'Doctor, Patient, and Department must belong to the same hospital',
      );
    }

    // 5. Caller Permission Check: If DOCTOR, verify they are the treating doctor
    if (caller.role === 'DOCTOR') {
      const callerDoctor = await this.prisma.doctor.findUnique({
        where: { userId: caller.userId },
      });

      if (!callerDoctor) {
        throw new NotFoundException('Doctor profile not found for user');
      }

      if (callerDoctor.id !== medicalRecord.doctorId) {
        throw new ForbiddenException(
          'Only the assigned doctor can prescribe for this medical record encounter',
        );
      }
    }

    // 6. Validate items: check for duplicate medicine items
    const medicineIds = dto.items.map((i) => i.medicineId);
    const uniqueMedicineIds = new Set(medicineIds);
    if (uniqueMedicineIds.size !== medicineIds.length) {
      throw new BadRequestException(
        'Duplicate medicine items in prescription are not allowed',
      );
    }

    // 7. Validate medicines existence and tenancy
    const medicines = await this.prisma.medicine.findMany({
      where: { id: { in: medicineIds } },
      include: {
        batches: {
          orderBy: { expiryDate: 'asc' },
        },
      },
    });

    if (medicines.length !== medicineIds.length) {
      throw new NotFoundException('One or more prescribed medicines not found');
    }

    const now = new Date();

    // 8. Validate medicine tenancy and non-expired stock
    for (const medicine of medicines) {
      if (medicine.hospitalId !== hospitalId) {
        throw new BadRequestException(
          `Medicine "${medicine.name}" belongs to a different hospital`,
        );
      }

      const validBatches = medicine.batches.filter(
        (b) => new Date(b.expiryDate) > now && b.quantity > 0,
      );

      if (validBatches.length === 0) {
        throw new BadRequestException(
          `Medicine "${medicine.name}" has no valid non-expired stock available`,
        );
      }
    }

    // 9. Atomic creation within transaction
    return this.prisma.$transaction(async (tx) => {
      const prescription = await tx.prescription.create({
        data: {
          medicalRecordId: dto.medicalRecordId,
          digitalSignature: dto.digitalSignature || null,
          items: {
            create: dto.items.map((item) => ({
              medicineId: item.medicineId,
              dosage: item.dosage.trim(),
              frequency: item.frequency.trim(),
              durationDays: item.durationDays,
              specialInstructions: item.specialInstructions?.trim() || null,
            })),
          },
        },
        include: PRESCRIPTION_INCLUDE,
      });

      return prescription;
    });
  }

  // =========================================================
  // GET PRESCRIPTIONS (Filtered & Scoped)
  // =========================================================
  async getPrescriptions(query: PrescriptionQueryDto, caller: AuthUser) {
    const where: any = {
      medicalRecord: {},
    };

    // Hospital Tenancy
    if (caller.role === 'SUPER_ADMIN') {
      if (query.hospitalId) {
        where.medicalRecord.patient = { hospitalId: query.hospitalId };
      }
    } else {
      where.medicalRecord.patient = { hospitalId: caller.hospitalId };
    }

    // Patient Role Isolation: strictly own prescriptions
    if (caller.role === 'PATIENT') {
      const patientProfile = await this.prisma.patient.findUnique({
        where: { userId: caller.userId },
      });

      if (!patientProfile) {
        return [];
      }

      if (query.patientId && query.patientId !== patientProfile.id) {
        throw new ForbiddenException(
          'Access denied: You cannot view prescriptions for other patients',
        );
      }

      where.medicalRecord.patientId = patientProfile.id;
    } else if (query.patientId) {
      where.medicalRecord.patientId = query.patientId;
    }

    // Doctor filter
    if (caller.role === 'DOCTOR') {
      const doctorProfile = await this.prisma.doctor.findUnique({
        where: { userId: caller.userId },
      });

      if (doctorProfile) {
        where.medicalRecord.doctorId = query.doctorId || doctorProfile.id;
      } else if (query.doctorId) {
        where.medicalRecord.doctorId = query.doctorId;
      }
    } else if (query.doctorId) {
      where.medicalRecord.doctorId = query.doctorId;
    }

    if (query.medicalRecordId) {
      where.medicalRecordId = query.medicalRecordId;
    }

    return this.prisma.prescription.findMany({
      where,
      include: PRESCRIPTION_INCLUDE,
      orderBy: { issuedAt: 'desc' },
    });
  }

  // =========================================================
  // GET PRESCRIPTION BY ID
  // =========================================================
  async getPrescriptionById(id: string, caller: AuthUser) {
    const prescription = await this.prisma.prescription.findUnique({
      where: { id },
      include: PRESCRIPTION_INCLUDE,
    });

    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }

    // Tenancy Check
    if (
      caller.role !== 'SUPER_ADMIN' &&
      prescription.medicalRecord.patient.hospitalId !== caller.hospitalId
    ) {
      throw new ForbiddenException(
        'Access denied: Prescription belongs to another hospital',
      );
    }

    // Patient Isolation Check
    if (
      caller.role === 'PATIENT' &&
      prescription.medicalRecord.patient.user.id !== caller.userId
    ) {
      throw new ForbiddenException(
        'Access denied: You can only view your own prescriptions',
      );
    }

    return prescription;
  }

  // =========================================================
  // GET PRESCRIPTIONS BY MEDICAL RECORD ID
  // =========================================================
  async getPrescriptionsByMedicalRecordId(
    medicalRecordId: string,
    caller: AuthUser,
  ) {
    const medicalRecord = await this.prisma.medicalRecord.findUnique({
      where: { id: medicalRecordId },
      include: {
        patient: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!medicalRecord) {
      throw new NotFoundException('Medical record not found');
    }

    // Tenancy Check
    if (
      caller.role !== 'SUPER_ADMIN' &&
      medicalRecord.patient.hospitalId !== caller.hospitalId
    ) {
      throw new ForbiddenException(
        'Access denied: Medical record belongs to another hospital',
      );
    }

    // Patient Isolation
    if (
      caller.role === 'PATIENT' &&
      medicalRecord.patient.user.id !== caller.userId
    ) {
      throw new ForbiddenException(
        'Access denied: You can only view your own prescriptions',
      );
    }

    return this.prisma.prescription.findMany({
      where: { medicalRecordId },
      include: PRESCRIPTION_INCLUDE,
      orderBy: { issuedAt: 'desc' },
    });
  }

  // =========================================================
  // GET MY PRESCRIPTIONS (Patient convenience endpoint)
  // =========================================================
  async getMyPrescriptions(caller: AuthUser) {
    const patientProfile = await this.prisma.patient.findUnique({
      where: { userId: caller.userId },
    });

    if (!patientProfile) {
      return [];
    }

    return this.prisma.prescription.findMany({
      where: {
        medicalRecord: {
          patientId: patientProfile.id,
          patient: {
            hospitalId: caller.hospitalId || undefined,
          },
        },
      },
      include: PRESCRIPTION_INCLUDE,
      orderBy: { issuedAt: 'desc' },
    });
  }

  // =========================================================
  // UPDATE PRESCRIPTION (Digital signature / notes)
  // =========================================================
  async updatePrescription(
    id: string,
    dto: UpdatePrescriptionDto,
    caller: AuthUser,
  ) {
    const prescription = await this.prisma.prescription.findUnique({
      where: { id },
      include: {
        medicalRecord: {
          include: {
            patient: true,
            doctor: true,
          },
        },
      },
    });

    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }

    // Tenancy Check
    if (
      caller.role !== 'SUPER_ADMIN' &&
      prescription.medicalRecord.patient.hospitalId !== caller.hospitalId
    ) {
      throw new ForbiddenException(
        'Access denied: Prescription belongs to another hospital',
      );
    }

    // Authorization check
    if (caller.role === 'DOCTOR') {
      const callerDoctor = await this.prisma.doctor.findUnique({
        where: { userId: caller.userId },
      });

      if (!callerDoctor || callerDoctor.id !== prescription.medicalRecord.doctorId) {
        throw new ForbiddenException(
          'Only the prescribing doctor can update this prescription',
        );
      }
    } else if (caller.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'You do not have permission to update this prescription',
      );
    }

    return this.prisma.prescription.update({
      where: { id },
      data: {
        ...(dto.digitalSignature !== undefined && {
          digitalSignature: dto.digitalSignature,
        }),
      },
      include: PRESCRIPTION_INCLUDE,
    });
  }
}
