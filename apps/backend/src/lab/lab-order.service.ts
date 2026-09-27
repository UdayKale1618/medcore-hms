import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLabOrderDto } from './dto/create-lab-order.dto';
import { UpdateLabOrderDto } from './dto/update-lab-order.dto';
import { UpdateLabOrderStatusDto } from './dto/update-lab-order-status.dto';
import { LabOrderQueryDto } from './dto/lab-order-query.dto';
import type { AuthUser } from '../auth/auth-user.interface';

const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  hospitalId: true,
};

export const LAB_ORDER_INCLUDE = {
  labTest: {
    select: {
      id: true,
      name: true,
      description: true,
      unit: true,
      referenceMin: true,
      referenceMax: true,
      hospitalId: true,
    },
  },
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
          status: true,
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
};

@Injectable()
export class LabOrderService {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================================
  // CREATE LAB ORDER (Doctor Encounter)
  // =========================================================
  async createLabOrder(dto: CreateLabOrderDto, caller: AuthUser) {
    // 1. Fetch MedicalRecord with relations
    const medicalRecord = await this.prisma.medicalRecord.findUnique({
      where: { id: dto.medicalRecordId },
      include: {
        patient: { include: { user: true } },
        doctor: { include: { user: true, department: true } },
        appointment: { include: { department: true } },
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
        'Cannot create lab order for a cancelled appointment encounter',
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
          'Only the assigned doctor can order lab tests for this medical record encounter',
        );
      }
    }

    // 6. Validate LabTest existence and tenancy
    const labTest = await this.prisma.labTest.findUnique({
      where: { id: dto.labTestId },
      select: {
        id: true,
        name: true,
        hospitalId: true,
      },
    });

    if (!labTest) {
      throw new NotFoundException('Lab test not found');
    }

    if (labTest.hospitalId && labTest.hospitalId !== hospitalId) {
      throw new BadRequestException(
        `Lab test "${labTest.name}" belongs to a different hospital`,
      );
    }

    // 7. Create LabOrder
    const data: Prisma.LabOrderUncheckedCreateInput = {
      medicalRecordId: dto.medicalRecordId,
      labTestId: dto.labTestId,
      status: 'ORDERED',
      orderedAt: new Date(),
    };

    return this.prisma.labOrder.create({
      data,
      include: LAB_ORDER_INCLUDE,
    });
  }

  // =========================================================
  // LIST LAB ORDERS (Filtered & Scoped)
  // =========================================================
  async getLabOrders(query: LabOrderQueryDto, caller: AuthUser) {
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

    // Patient Role Isolation: strictly own lab orders
    if (caller.role === 'PATIENT') {
      const patientProfile = await this.prisma.patient.findUnique({
        where: { userId: caller.userId },
      });

      if (!patientProfile) {
        return [];
      }

      if (query.patientId && query.patientId !== patientProfile.id) {
        throw new ForbiddenException(
          'Access denied: You cannot view lab orders for other patients',
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

    if (query.labTestId) {
      where.labTestId = query.labTestId;
    }

    if (query.status) {
      where.status = query.status.toUpperCase();
    }

    return this.prisma.labOrder.findMany({
      where,
      include: LAB_ORDER_INCLUDE,
      orderBy: { orderedAt: 'desc' },
    });
  }

  // =========================================================
  // GET LAB ORDER BY ID
  // =========================================================
  async getLabOrderById(id: string, caller: AuthUser) {
    const order = await this.prisma.labOrder.findUnique({
      where: { id },
      include: LAB_ORDER_INCLUDE,
    });

    if (!order) {
      throw new NotFoundException('Lab order not found');
    }

    // Tenancy Check
    if (
      caller.role !== 'SUPER_ADMIN' &&
      order.medicalRecord.patient.hospitalId !== caller.hospitalId
    ) {
      throw new ForbiddenException(
        'Access denied: Lab order belongs to another hospital',
      );
    }

    // Patient Isolation Check
    if (
      caller.role === 'PATIENT' &&
      order.medicalRecord.patient.user.id !== caller.userId
    ) {
      throw new ForbiddenException(
        'Access denied: You can only view your own lab orders',
      );
    }

    return order;
  }

  // =========================================================
  // GET LAB ORDERS BY MEDICAL RECORD ID
  // =========================================================
  async getLabOrdersByMedicalRecordId(
    medicalRecordId: string,
    caller: AuthUser,
  ) {
    const medicalRecord = await this.prisma.medicalRecord.findUnique({
      where: { id: medicalRecordId },
      include: {
        patient: { include: { user: true } },
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
        'Access denied: You can only view your own lab orders',
      );
    }

    return this.prisma.labOrder.findMany({
      where: { medicalRecordId },
      include: LAB_ORDER_INCLUDE,
      orderBy: { orderedAt: 'desc' },
    });
  }

  // =========================================================
  // UPDATE LAB ORDER (Results / Findings)
  // =========================================================
  async updateLabOrder(id: string, dto: UpdateLabOrderDto, caller: AuthUser) {
    const order = await this.getLabOrderById(id, caller);

    if (
      caller.role !== 'LAB_TECHNICIAN' &&
      caller.role !== 'DOCTOR' &&
      caller.role !== 'HOSPITAL_ADMIN' &&
      caller.role !== 'SUPER_ADMIN'
    ) {
      throw new ForbiddenException(
        'You do not have permission to update lab order results',
      );
    }

    if (order.status === 'CANCELLED') {
      throw new BadRequestException('Cannot update a cancelled lab order');
    }

    const data: Prisma.LabOrderUncheckedUpdateInput = {
      ...(dto.result !== undefined && { result: dto.result?.trim() || null }),
      ...(dto.resultValue !== undefined && {
        resultValue: dto.resultValue,
      }),
      ...(dto.reportUrl !== undefined && {
        reportUrl: dto.reportUrl?.trim() || null,
      }),
    };

    return this.prisma.labOrder.update({
      where: { id },
      data,
      include: LAB_ORDER_INCLUDE,
    });
  }

  // =========================================================
  // UPDATE LAB ORDER STATUS (Workflow Management)
  // =========================================================
  async updateLabOrderStatus(
    id: string,
    dto: UpdateLabOrderStatusDto,
    caller: AuthUser,
  ) {
    const order = await this.getLabOrderById(id, caller);
    const newStatus = dto.status.toUpperCase();
    const currentStatus = order.status.toUpperCase();

    // Check terminal states
    if (currentStatus === 'COMPLETED') {
      throw new BadRequestException(
        'Cannot change status of a completed lab order',
      );
    }
    if (currentStatus === 'CANCELLED') {
      throw new BadRequestException(
        'Cannot change status of a cancelled lab order',
      );
    }

    // Valid state transitions:
    // (ORDERED | PENDING) -> IN_PROGRESS | CANCELLED
    // IN_PROGRESS -> COMPLETED | CANCELLED
    // COMPLETED -> terminal
    // CANCELLED -> terminal
    const allowedTransitions: Record<string, string[]> = {
      ORDERED: ['IN_PROGRESS', 'CANCELLED'],
      PENDING: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
    };

    const validNextStates = allowedTransitions[currentStatus] || [];
    if (!validNextStates.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from "${currentStatus}" to "${newStatus}"`,
      );
    }

    // Role authorization for specific transitions
    if (newStatus === 'CANCELLED') {
      if (
        caller.role !== 'DOCTOR' &&
        caller.role !== 'HOSPITAL_ADMIN' &&
        caller.role !== 'SUPER_ADMIN'
      ) {
        throw new ForbiddenException(
          'Only the treating doctor or hospital administrator can cancel a lab order',
        );
      }
    } else if (newStatus === 'IN_PROGRESS' || newStatus === 'COMPLETED') {
      if (
        caller.role !== 'LAB_TECHNICIAN' &&
        caller.role !== 'HOSPITAL_ADMIN' &&
        caller.role !== 'SUPER_ADMIN' &&
        caller.role !== 'DOCTOR'
      ) {
        throw new ForbiddenException(
          'You do not have permission to advance lab order status',
        );
      }
    }

    const updateData: Prisma.LabOrderUncheckedUpdateInput = {
      status: newStatus,
    };

    if (newStatus === 'IN_PROGRESS' && !order.sampleCollectedAt) {
      updateData.sampleCollectedAt = new Date();
    }

    if (newStatus === 'COMPLETED') {
      updateData.reviewedAt = new Date();
      if (dto.result !== undefined) {
        updateData.result = dto.result?.trim() || null;
      }
      if (dto.resultValue !== undefined) {
        updateData.resultValue = dto.resultValue;
      }
      if (dto.reportUrl !== undefined) {
        updateData.reportUrl = dto.reportUrl?.trim() || null;
      }
    }

    return this.prisma.labOrder.update({
      where: { id },
      data: updateData,
      include: LAB_ORDER_INCLUDE,
    });
  }
}
