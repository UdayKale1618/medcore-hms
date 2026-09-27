import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { UpdateInvoiceStatusDto } from './dto/update-invoice-status.dto';
import { InvoiceQueryDto } from './dto/invoice-query.dto';
import type { AuthUser } from '../auth/auth-user.interface';

const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  hospitalId: true,
};

export const INVOICE_INCLUDE = {
  patient: {
    select: {
      id: true,
      hospitalId: true,
      userId: true,
      user: {
        select: SAFE_USER_SELECT,
      },
    },
  },
  appointment: {
    select: {
      id: true,
      appointmentDate: true,
      status: true,
      doctor: {
        select: {
          id: true,
          specialization: true,
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
    },
  },
  items: true,
};

@Injectable()
export class InvoiceService {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================================
  // CREATE INVOICE (Server-side monetary calculation)
  // =========================================================
  async createInvoice(dto: CreateInvoiceDto, caller: AuthUser) {
    // 1. Fetch Patient
    const patient = await this.prisma.patient.findUnique({
      where: { id: dto.patientId },
      include: { user: true },
    });

    if (!patient || patient.deletedAt !== null) {
      throw new NotFoundException('Patient not found');
    }

    const hospitalId = patient.hospitalId;

    // Tenancy Check
    if (caller.role !== 'SUPER_ADMIN' && hospitalId !== caller.hospitalId) {
      throw new ForbiddenException(
        'Access denied: Patient belongs to another hospital',
      );
    }

    // 2. Validate Appointment if provided
    if (dto.appointmentId) {
      const appointment = await this.prisma.appointment.findUnique({
        where: { id: dto.appointmentId },
        include: { department: true, invoice: true },
      });

      if (!appointment || appointment.deletedAt !== null) {
        throw new NotFoundException('Appointment not found');
      }

      if (appointment.patientId !== patient.id) {
        throw new BadRequestException(
          'Appointment does not belong to the specified patient',
        );
      }

      if (appointment.department.hospitalId !== hospitalId) {
        throw new BadRequestException(
          'Appointment belongs to a different hospital than patient',
        );
      }

      if (appointment.invoice) {
        throw new ConflictException(
          'An invoice already exists for this appointment',
        );
      }
    }

    // 3. Server-side calculations
    let calculatedSubtotal = 0;
    const itemCreates = dto.items.map((item) => {
      const itemTotal = Number((item.quantity * item.unitPrice).toFixed(2));
      calculatedSubtotal += itemTotal;
      return {
        description: item.description.trim(),
        category: item.category.trim(),
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: itemTotal,
      };
    });

    const subtotal = Number(calculatedSubtotal.toFixed(2));
    const tax = Number((dto.tax || 0).toFixed(2));
    const discount = Number((dto.discount || 0).toFixed(2));
    const total = Number(Math.max(0, subtotal + tax - discount).toFixed(2));

    // 4. Generate unique invoice number
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    const timeSuffix = Date.now().toString().slice(-4);
    const invoiceNumber = `INV-${datePart}-${randomPart}-${timeSuffix}`;

    // 5. Save atomically
    return this.prisma.$transaction(async (tx) => {
      const createData: Prisma.InvoiceUncheckedCreateInput = {
        invoiceNumber,
        patientId: dto.patientId,
        appointmentId: dto.appointmentId ?? null,
        subtotal,
        tax,
        discount,
        total,
        status: 'DRAFT',
        items: {
          create: itemCreates,
        },
      };

      return tx.invoice.create({
        data: createData,
        include: INVOICE_INCLUDE,
      });
    });
  }

  // =========================================================
  // LIST INVOICES (Filtered & Scoped)
  // =========================================================
  async getInvoices(query: InvoiceQueryDto, caller: AuthUser) {
    const where: any = {
      patient: {},
    };

    // Hospital Tenancy
    if (caller.role === 'SUPER_ADMIN') {
      if (query.hospitalId) {
        where.patient = { hospitalId: query.hospitalId };
      }
    } else {
      where.patient = { hospitalId: caller.hospitalId };
    }

    // Patient Role Isolation: strictly own invoices
    if (caller.role === 'PATIENT') {
      const patientProfile = await this.prisma.patient.findUnique({
        where: { userId: caller.userId },
      });

      if (!patientProfile) {
        return [];
      }

      if (query.patientId && query.patientId !== patientProfile.id) {
        throw new ForbiddenException(
          'Access denied: You cannot view invoices for other patients',
        );
      }

      where.patientId = patientProfile.id;
    } else if (query.patientId) {
      where.patientId = query.patientId;
    }

    if (query.appointmentId) {
      where.appointmentId = query.appointmentId;
    }

    if (query.status) {
      where.status = query.status.toUpperCase();
    }

    return this.prisma.invoice.findMany({
      where,
      include: INVOICE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  // =========================================================
  // GET INVOICE BY ID
  // =========================================================
  async getInvoiceById(id: string, caller: AuthUser) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: INVOICE_INCLUDE,
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Tenancy Check
    if (
      caller.role !== 'SUPER_ADMIN' &&
      invoice.patient.hospitalId !== caller.hospitalId
    ) {
      throw new ForbiddenException(
        'Access denied: Invoice belongs to another hospital',
      );
    }

    // Patient Isolation Check
    if (
      caller.role === 'PATIENT' &&
      invoice.patient.user.id !== caller.userId
    ) {
      throw new ForbiddenException(
        'Access denied: You can only view your own invoices',
      );
    }

    return invoice;
  }

  // =========================================================
  // GET INVOICES BY PATIENT ID
  // =========================================================
  async getInvoicesByPatientId(patientId: string, caller: AuthUser) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      include: { user: true },
    });

    if (!patient || patient.deletedAt !== null) {
      throw new NotFoundException('Patient not found');
    }

    // Tenancy Check
    if (
      caller.role !== 'SUPER_ADMIN' &&
      patient.hospitalId !== caller.hospitalId
    ) {
      throw new ForbiddenException(
        'Access denied: Patient belongs to another hospital',
      );
    }

    // Patient Isolation Check
    if (caller.role === 'PATIENT' && patient.user.id !== caller.userId) {
      throw new ForbiddenException(
        'Access denied: You can only view your own invoices',
      );
    }

    return this.prisma.invoice.findMany({
      where: { patientId },
      include: INVOICE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  // =========================================================
  // GET INVOICE BY APPOINTMENT ID
  // =========================================================
  async getInvoiceByAppointmentId(appointmentId: string, caller: AuthUser) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { appointmentId },
      include: INVOICE_INCLUDE,
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found for this appointment');
    }

    // Tenancy Check
    if (
      caller.role !== 'SUPER_ADMIN' &&
      invoice.patient.hospitalId !== caller.hospitalId
    ) {
      throw new ForbiddenException(
        'Access denied: Invoice belongs to another hospital',
      );
    }

    // Patient Isolation
    if (
      caller.role === 'PATIENT' &&
      invoice.patient.user.id !== caller.userId
    ) {
      throw new ForbiddenException(
        'Access denied: You can only view your own invoices',
      );
    }

    return invoice;
  }

  // =========================================================
  // UPDATE INVOICE (Tax / Discount adjustment)
  // =========================================================
  async updateInvoice(id: string, dto: UpdateInvoiceDto, caller: AuthUser) {
    const invoice = await this.getInvoiceById(id, caller);

    if (
      caller.role !== 'ACCOUNTANT' &&
      caller.role !== 'HOSPITAL_ADMIN' &&
      caller.role !== 'SUPER_ADMIN'
    ) {
      throw new ForbiddenException(
        'You do not have permission to update invoices',
      );
    }

    if (invoice.status === 'PAID') {
      throw new BadRequestException('Cannot update a paid invoice');
    }
    if (invoice.status === 'CANCELLED') {
      throw new BadRequestException('Cannot update a cancelled invoice');
    }

    const subtotal = Number(invoice.subtotal);
    const tax =
      dto.tax !== undefined ? Number(dto.tax.toFixed(2)) : Number(invoice.tax);
    const discount =
      dto.discount !== undefined
        ? Number(dto.discount.toFixed(2))
        : Number(invoice.discount);
    const total = Number(Math.max(0, subtotal + tax - discount).toFixed(2));
    const updateData: Prisma.InvoiceUncheckedUpdateInput = {
      tax,
      discount,
      total,
    };

    return this.prisma.invoice.update({
      where: { id },
      data: updateData,
      include: INVOICE_INCLUDE,
    });
  }

  // =========================================================
  // UPDATE INVOICE STATUS (Workflow Management)
  // =========================================================
  async updateInvoiceStatus(
    id: string,
    dto: UpdateInvoiceStatusDto,
    caller: AuthUser,
  ) {
    const invoice = await this.getInvoiceById(id, caller);
    const newStatus = dto.status.toUpperCase();
    const currentStatus = invoice.status.toUpperCase();

    // Check terminal states
    if (currentStatus === 'PAID') {
      throw new BadRequestException('Cannot change status of a paid invoice');
    }
    if (currentStatus === 'CANCELLED') {
      throw new BadRequestException(
        'Cannot change status of a cancelled invoice',
      );
    }

    // Valid state transitions:
    // DRAFT -> ISSUED | CANCELLED
    // ISSUED -> PAID | CANCELLED
    // PAID -> terminal
    // CANCELLED -> terminal
    const allowedTransitions: Record<string, string[]> = {
      DRAFT: ['ISSUED', 'CANCELLED'],
      ISSUED: ['PAID', 'CANCELLED'],
    };

    const validNextStates = allowedTransitions[currentStatus] || [];
    if (!validNextStates.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from "${currentStatus}" to "${newStatus}"`,
      );
    }

    // RBAC validation for status changes:
    if (
      caller.role !== 'ACCOUNTANT' &&
      caller.role !== 'HOSPITAL_ADMIN' &&
      caller.role !== 'RECEPTIONIST' &&
      caller.role !== 'SUPER_ADMIN'
    ) {
      throw new ForbiddenException(
        'You do not have permission to modify invoice status',
      );
    }

    const updateData: Prisma.InvoiceUncheckedUpdateInput = {
      status: newStatus,
    };

    if (newStatus === 'ISSUED' && !invoice.issuedAt) {
      updateData.issuedAt = new Date();
    }
    if (newStatus === 'PAID') {
      updateData.paidAt = new Date();
    }

    return this.prisma.invoice.update({
      where: { id },
      data: updateData,
      include: INVOICE_INCLUDE,
    });
  }
}
