import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import type { AuthUser } from '../auth/auth-user.interface';

const PATIENT_SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
};

@Injectable()
export class PatientPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  // =========================================================
  // HELPER: RESOLVE PATIENT IDENTITY
  // =========================================================
  private async getPatient(caller: AuthUser) {
    const patient = await this.prisma.patient.findUnique({
      where: { userId: caller.userId },
      include: {
        user: { select: PATIENT_SAFE_USER_SELECT },
        hospital: { select: { id: true, name: true, email: true, phone: true } },
      },
    });

    if (!patient || patient.deletedAt !== null) {
      throw new NotFoundException('Patient record not found for this account');
    }

    return patient;
  }

  // =========================================================
  // 1. PATIENT PROFILE
  // =========================================================
  async getProfile(caller: AuthUser) {
    const patient = await this.getPatient(caller);
    return {
      id: patient.id,
      userId: patient.userId,
      hospitalId: patient.hospitalId,
      dateOfBirth: patient.dateOfBirth,
      gender: patient.gender,
      bloodGroup: patient.bloodGroup,
      emergencyContactName: patient.emergencyContactName,
      emergencyContactPhone: patient.emergencyContactPhone,
      createdAt: patient.createdAt,
      user: patient.user,
      hospital: patient.hospital,
    };
  }

  // =========================================================
  // 2. APPOINTMENTS
  // =========================================================
  async getAppointments(caller: AuthUser) {
    const patient = await this.getPatient(caller);

    return this.prisma.appointment.findMany({
      where: {
        patientId: patient.id,
        deletedAt: null,
      },
      include: {
        doctor: {
          select: {
            id: true,
            specialization: true,
            user: { select: PATIENT_SAFE_USER_SELECT },
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { appointmentDate: 'desc' },
    });
  }

  async getAppointmentById(id: string, caller: AuthUser) {
    const patient = await this.getPatient(caller);

    const appointment = await this.prisma.appointment.findFirst({
      where: {
        id,
        patientId: patient.id,
        deletedAt: null,
      },
      include: {
        doctor: {
          select: {
            id: true,
            specialization: true,
            user: { select: PATIENT_SAFE_USER_SELECT },
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

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    return appointment;
  }

  async cancelAppointment(id: string, reason: string | undefined, caller: AuthUser) {
    const patient = await this.getPatient(caller);

    const appointment = await this.prisma.appointment.findFirst({
      where: {
        id,
        patientId: patient.id,
        deletedAt: null,
      },
      include: {
        doctor: {
          include: { user: true },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.status === 'COMPLETED') {
      throw new BadRequestException('Cannot cancel an appointment that has already been completed');
    }

    if (appointment.status === 'CANCELLED') {
      throw new BadRequestException('Appointment is already cancelled');
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        reason: reason ? `Patient cancelled: ${reason}` : appointment.reason,
      },
    });

    // Notify doctor
    if (appointment.doctor?.user?.id) {
      await this.notificationService.dispatch({
        userId: appointment.doctor.user.id,
        hospitalId: patient.hospitalId,
        type: 'appointment.cancelled',
        title: 'Appointment Cancelled by Patient',
        message: `Patient ${patient.user.name} cancelled appointment scheduled for ${appointment.appointmentDate.toISOString().slice(0, 10)}.`,
        entityType: 'Appointment',
        entityId: id,
      });
    }

    return updated;
  }

  // =========================================================
  // 3. MEDICAL RECORDS (Patient-Safe Clinical View)
  // =========================================================
  async getMedicalRecords(caller: AuthUser) {
    const patient = await this.getPatient(caller);

    return this.prisma.medicalRecord.findMany({
      where: {
        patientId: patient.id,
      },
      select: {
        id: true,
        appointmentId: true,
        chiefComplaint: true,
        symptoms: true,
        diagnosis: true,
        treatmentPlan: true,
        allergies: true,
        adverseDrugReactions: true,
        bloodPressure: true,
        pulse: true,
        temperature: true,
        spo2: true,
        height: true,
        weight: true,
        bmi: true,
        createdAt: true,
        doctor: {
          select: {
            id: true,
            specialization: true,
            user: { select: PATIENT_SAFE_USER_SELECT },
          },
        },
        appointment: {
          select: {
            appointmentDate: true,
            type: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMedicalRecordById(id: string, caller: AuthUser) {
    const patient = await this.getPatient(caller);

    const record = await this.prisma.medicalRecord.findFirst({
      where: {
        id,
        patientId: patient.id,
      },
      select: {
        id: true,
        appointmentId: true,
        chiefComplaint: true,
        symptoms: true,
        diagnosis: true,
        treatmentPlan: true,
        allergies: true,
        adverseDrugReactions: true,
        bloodPressure: true,
        pulse: true,
        temperature: true,
        spo2: true,
        height: true,
        weight: true,
        bmi: true,
        createdAt: true,
        doctor: {
          select: {
            id: true,
            specialization: true,
            user: { select: PATIENT_SAFE_USER_SELECT },
          },
        },
        appointment: {
          select: {
            appointmentDate: true,
            type: true,
          },
        },
      },
    });

    if (!record) {
      throw new NotFoundException('Medical record not found');
    }

    return record;
  }

  // =========================================================
  // 4. PRESCRIPTIONS
  // =========================================================
  async getPrescriptions(caller: AuthUser) {
    const patient = await this.getPatient(caller);

    return this.prisma.prescription.findMany({
      where: {
        medicalRecord: {
          patientId: patient.id,
        },
      },
      include: {
        medicalRecord: {
          select: {
            id: true,
            diagnosis: true,
            doctor: {
              select: {
                id: true,
                specialization: true,
                user: { select: PATIENT_SAFE_USER_SELECT },
              },
            },
          },
        },
        items: {
          include: {
            medicine: {
              select: {
                id: true,
                name: true,
                form: true,
                description: true,
              },
            },
          },
        },
      },
      orderBy: { issuedAt: 'desc' },
    });
  }

  async getPrescriptionById(id: string, caller: AuthUser) {
    const patient = await this.getPatient(caller);

    const prescription = await this.prisma.prescription.findFirst({
      where: {
        id,
        medicalRecord: {
          patientId: patient.id,
        },
      },
      include: {
        medicalRecord: {
          select: {
            id: true,
            diagnosis: true,
            treatmentPlan: true,
            doctor: {
              select: {
                id: true,
                specialization: true,
                user: { select: PATIENT_SAFE_USER_SELECT },
              },
            },
          },
        },
        items: {
          include: {
            medicine: {
              select: {
                id: true,
                name: true,
                form: true,
                description: true,
              },
            },
          },
        },
      },
    });

    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }

    return prescription;
  }

  // =========================================================
  // 5. LAB REPORTS
  // =========================================================
  async getLabOrders(caller: AuthUser) {
    const patient = await this.getPatient(caller);

    return this.prisma.labOrder.findMany({
      where: {
        medicalRecord: {
          patientId: patient.id,
        },
      },
      include: {
        labTest: {
          select: {
            id: true,
            name: true,
            description: true,
            unit: true,
            referenceMin: true,
            referenceMax: true,
          },
        },
      },
      orderBy: { orderedAt: 'desc' },
    });
  }

  async getLabOrderById(id: string, caller: AuthUser) {
    const patient = await this.getPatient(caller);

    const order = await this.prisma.labOrder.findFirst({
      where: {
        id,
        medicalRecord: {
          patientId: patient.id,
        },
      },
      include: {
        labTest: {
          select: {
            id: true,
            name: true,
            description: true,
            unit: true,
            referenceMin: true,
            referenceMax: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Lab order report not found');
    }

    return order;
  }

  // =========================================================
  // 6. INVOICES & BILLING
  // =========================================================
  async getInvoices(caller: AuthUser) {
    const patient = await this.getPatient(caller);

    return this.prisma.invoice.findMany({
      where: {
        patientId: patient.id,
      },
      include: {
        items: true,
        payments: {
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            method: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getInvoiceById(id: string, caller: AuthUser) {
    const patient = await this.getPatient(caller);

    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        patientId: patient.id,
      },
      include: {
        items: true,
        payments: {
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            method: true,
            createdAt: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }
}
