import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceService } from './invoice.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.interface';

describe('InvoiceService', () => {
  let service: InvoiceService;
  let prisma: {
    patient: {
      findUnique: jest.Mock;
    };
    appointment: {
      findUnique: jest.Mock;
    };
    invoice: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const accountantCaller: AuthUser = {
    userId: 'user-acc-1',
    email: 'acc@apollo.com',
    roleId: 'role-acc',
    role: 'ACCOUNTANT',
    hospitalId: 'hosp-1',
  };

  const patientCaller: AuthUser = {
    userId: 'user-pat-1',
    email: 'pat@apollo.com',
    roleId: 'role-pat',
    role: 'PATIENT',
    hospitalId: 'hosp-1',
  };

  const otherPatientCaller: AuthUser = {
    userId: 'user-pat-2',
    email: 'pat2@apollo.com',
    roleId: 'role-pat',
    role: 'PATIENT',
    hospitalId: 'hosp-1',
  };

  const otherHospitalCaller: AuthUser = {
    userId: 'user-acc-2',
    email: 'acc@fortis.com',
    roleId: 'role-acc',
    role: 'ACCOUNTANT',
    hospitalId: 'hosp-2',
  };

  const doctorCaller: AuthUser = {
    userId: 'user-doc-1',
    email: 'doc@apollo.com',
    roleId: 'role-doc',
    role: 'DOCTOR',
    hospitalId: 'hosp-1',
  };

  const mockPatient = {
    id: 'pat-1',
    hospitalId: 'hosp-1',
    deletedAt: null,
    userId: 'user-pat-1',
    user: { id: 'user-pat-1', name: 'Jane Doe', hospitalId: 'hosp-1' },
  };

  const mockAppointment = {
    id: 'apt-1',
    patientId: 'pat-1',
    deletedAt: null,
    department: { id: 'dept-1', hospitalId: 'hosp-1' },
    invoice: null,
  };

  const mockInvoice = {
    id: 'inv-1',
    invoiceNumber: 'INV-20260926-1001-9999',
    patientId: 'pat-1',
    appointmentId: 'apt-1',
    subtotal: 350.0,
    tax: 35.0,
    discount: 20.0,
    total: 365.0,
    status: 'DRAFT',
    issuedAt: null,
    paidAt: null,
    patient: mockPatient,
    appointment: mockAppointment,
    items: [
      {
        id: 'item-1',
        description: 'Consultation Fee',
        category: 'CONSULTATION',
        quantity: 1,
        unitPrice: 200.0,
        total: 200.0,
      },
      {
        id: 'item-2',
        description: 'Blood Test',
        category: 'LAB_TEST',
        quantity: 1,
        unitPrice: 150.0,
        total: 150.0,
      },
    ],
  };

  beforeEach(async () => {
    prisma = {
      patient: {
        findUnique: jest.fn(),
      },
      appointment: {
        findUnique: jest.fn(),
      },
      invoice: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<InvoiceService>(InvoiceService);
  });

  describe('createInvoice & Calculations', () => {
    it('creates invoice and calculates subtotal, tax, discount, and total accurately server-side', async () => {
      prisma.patient.findUnique.mockResolvedValue(mockPatient);
      prisma.appointment.findUnique.mockResolvedValue(mockAppointment);
      prisma.invoice.create.mockResolvedValue(mockInvoice);

      const result = await service.createInvoice(
        {
          patientId: 'pat-1',
          appointmentId: 'apt-1',
          tax: 35.0,
          discount: 20.0,
          items: [
            {
              description: 'Consultation Fee',
              category: 'CONSULTATION',
              quantity: 1,
              unitPrice: 200.0,
            },
            {
              description: 'Blood Test',
              category: 'LAB_TEST',
              quantity: 1,
              unitPrice: 150.0,
            },
          ],
        },
        accountantCaller,
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.invoice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          patientId: 'pat-1',
          appointmentId: 'apt-1',
          subtotal: 350.0,
          tax: 35.0,
          discount: 20.0,
          total: 365.0,
          status: 'DRAFT',
          items: {
            create: [
              {
                description: 'Consultation Fee',
                category: 'CONSULTATION',
                quantity: 1,
                unitPrice: 200.0,
                total: 200.0,
              },
              {
                description: 'Blood Test',
                category: 'LAB_TEST',
                quantity: 1,
                unitPrice: 150.0,
                total: 150.0,
              },
            ],
          },
        }),
        include: expect.any(Object),
      });
      expect(result).toEqual(mockInvoice);
    });

    it('rejects creation if patient does not exist', async () => {
      prisma.patient.findUnique.mockResolvedValue(null);

      await expect(
        service.createInvoice(
          {
            patientId: 'pat-missing',
            items: [
              {
                description: 'Consultation',
                category: 'CONSULTATION',
                quantity: 1,
                unitPrice: 100,
              },
            ],
          },
          accountantCaller,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects creation if appointment patient mismatch', async () => {
      prisma.patient.findUnique.mockResolvedValue(mockPatient);
      prisma.appointment.findUnique.mockResolvedValue({
        ...mockAppointment,
        patientId: 'pat-other',
      });

      await expect(
        service.createInvoice(
          {
            patientId: 'pat-1',
            appointmentId: 'apt-1',
            items: [
              {
                description: 'Consultation',
                category: 'CONSULTATION',
                quantity: 1,
                unitPrice: 100,
              },
            ],
          },
          accountantCaller,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects creation if invoice already exists for appointment', async () => {
      prisma.patient.findUnique.mockResolvedValue(mockPatient);
      prisma.appointment.findUnique.mockResolvedValue({
        ...mockAppointment,
        invoice: { id: 'existing-inv' },
      });

      await expect(
        service.createInvoice(
          {
            patientId: 'pat-1',
            appointmentId: 'apt-1',
            items: [
              {
                description: 'Consultation',
                category: 'CONSULTATION',
                quantity: 1,
                unitPrice: 100,
              },
            ],
          },
          accountantCaller,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('blocks cross-hospital invoice creation', async () => {
      prisma.patient.findUnique.mockResolvedValue(mockPatient);

      await expect(
        service.createInvoice(
          {
            patientId: 'pat-1',
            items: [
              {
                description: 'Consultation',
                category: 'CONSULTATION',
                quantity: 1,
                unitPrice: 100,
              },
            ],
          },
          otherHospitalCaller,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getInvoices', () => {
    it('returns invoices scoped to hospital for staff', async () => {
      prisma.invoice.findMany.mockResolvedValue([mockInvoice]);

      const result = await service.getInvoices({}, accountantCaller);

      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            patient: { hospitalId: 'hosp-1' },
          }),
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('strictly isolates patient to their own invoices', async () => {
      prisma.patient.findUnique.mockResolvedValue(mockPatient);
      prisma.invoice.findMany.mockResolvedValue([mockInvoice]);

      await service.getInvoices({}, patientCaller);

      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            patientId: 'pat-1',
            patient: { hospitalId: 'hosp-1' },
          }),
        }),
      );
    });
  });

  describe('getInvoiceById', () => {
    it('returns invoice for authorized caller', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      const result = await service.getInvoiceById('inv-1', accountantCaller);

      expect(result.id).toBe('inv-1');
    });

    it('blocks patient from viewing another patient invoice', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      await expect(
        service.getInvoiceById('inv-1', otherPatientCaller),
      ).rejects.toThrow(ForbiddenException);
    });

    it('blocks cross-hospital access to invoice', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      await expect(
        service.getInvoiceById('inv-1', otherHospitalCaller),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateInvoiceStatus', () => {
    it('transitions DRAFT to ISSUED and sets issuedAt', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      prisma.invoice.update.mockResolvedValue({
        ...mockInvoice,
        status: 'ISSUED',
        issuedAt: new Date(),
      });

      const result = await service.updateInvoiceStatus(
        'inv-1',
        { status: 'ISSUED' },
        accountantCaller,
      );

      expect(result.status).toBe('ISSUED');
      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'ISSUED',
            issuedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('transitions ISSUED to PAID and sets paidAt', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        ...mockInvoice,
        status: 'ISSUED',
        issuedAt: new Date(),
      });
      prisma.invoice.update.mockResolvedValue({
        ...mockInvoice,
        status: 'PAID',
        paidAt: new Date(),
      });

      const result = await service.updateInvoiceStatus(
        'inv-1',
        { status: 'PAID' },
        accountantCaller,
      );

      expect(result.status).toBe('PAID');
    });

    it('rejects changing status of an already PAID invoice', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        ...mockInvoice,
        status: 'PAID',
      });

      await expect(
        service.updateInvoiceStatus(
          'inv-1',
          { status: 'CANCELLED' },
          accountantCaller,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('blocks unauthorized roles (like DOCTOR) from modifying invoice status', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      await expect(
        service.updateInvoiceStatus(
          'inv-1',
          { status: 'ISSUED' },
          doctorCaller,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
