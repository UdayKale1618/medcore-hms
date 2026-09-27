import { Test, TestingModule } from '@nestjs/testing';
import { LabOrderService } from './lab-order.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.interface';

describe('LabOrderService', () => {
  let service: LabOrderService;
  let prisma: {
    medicalRecord: {
      findUnique: jest.Mock;
    };
    doctor: {
      findUnique: jest.Mock;
    };
    patient: {
      findUnique: jest.Mock;
    };
    labTest: {
      findUnique: jest.Mock;
    };
    labOrder: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  const doctorCaller: AuthUser = {
    userId: 'user-doc-1',
    email: 'doc@apollo.com',
    roleId: 'role-doc',
    role: 'DOCTOR',
    hospitalId: 'hosp-1',
  };

  const otherDoctorCaller: AuthUser = {
    userId: 'user-doc-2',
    email: 'doc2@apollo.com',
    roleId: 'role-doc',
    role: 'DOCTOR',
    hospitalId: 'hosp-1',
  };

  const labTechCaller: AuthUser = {
    userId: 'user-tech-1',
    email: 'tech@apollo.com',
    roleId: 'role-tech',
    role: 'LAB_TECHNICIAN',
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
    userId: 'user-doc-other',
    email: 'other@fortis.com',
    roleId: 'role-doc',
    role: 'DOCTOR',
    hospitalId: 'hosp-2',
  };

  const mockDoctorProfile = {
    id: 'doc-1',
    userId: 'user-doc-1',
  };

  const mockOtherDoctorProfile = {
    id: 'doc-2',
    userId: 'user-doc-2',
  };

  const mockPatientProfile = {
    id: 'pat-1',
    userId: 'user-pat-1',
    hospitalId: 'hosp-1',
  };

  const mockMedicalRecord = {
    id: 'rec-1',
    patientId: 'pat-1',
    doctorId: 'doc-1',
    appointmentId: 'apt-1',
    appointment: {
      id: 'apt-1',
      status: 'IN_PROGRESS',
      deletedAt: null,
      department: { id: 'dept-1', hospitalId: 'hosp-1' },
    },
    patient: {
      id: 'pat-1',
      hospitalId: 'hosp-1',
      user: { id: 'user-pat-1', hospitalId: 'hosp-1' },
    },
    doctor: {
      id: 'doc-1',
      user: { id: 'user-doc-1', hospitalId: 'hosp-1' },
      department: { id: 'dept-1', hospitalId: 'hosp-1' },
    },
  };

  const mockLabTest = {
    id: 'test-1',
    hospitalId: 'hosp-1',
    name: 'Complete Blood Count',
    unit: 'cells/mcL',
  };

  const mockLabTestOtherHosp = {
    id: 'test-other',
    hospitalId: 'hosp-2',
    name: 'Foreign Test',
  };

  const mockLabOrder = {
    id: 'order-1',
    medicalRecordId: 'rec-1',
    labTestId: 'test-1',
    status: 'ORDERED',
    result: null,
    resultValue: null,
    reportUrl: null,
    orderedAt: new Date(),
    sampleCollectedAt: null,
    reviewedAt: null,
    medicalRecord: mockMedicalRecord,
    labTest: mockLabTest,
  };

  beforeEach(async () => {
    prisma = {
      medicalRecord: {
        findUnique: jest.fn(),
      },
      doctor: {
        findUnique: jest.fn(),
      },
      patient: {
        findUnique: jest.fn(),
      },
      labTest: {
        findUnique: jest.fn(),
      },
      labOrder: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LabOrderService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<LabOrderService>(LabOrderService);
  });

  describe('createLabOrder', () => {
    it('creates a lab order successfully for treating doctor', async () => {
      prisma.medicalRecord.findUnique.mockResolvedValue(mockMedicalRecord);
      prisma.doctor.findUnique.mockResolvedValue(mockDoctorProfile);
      prisma.labTest.findUnique.mockResolvedValue(mockLabTest);
      prisma.labOrder.create.mockResolvedValue(mockLabOrder);

      const result = await service.createLabOrder(
        { medicalRecordId: 'rec-1', labTestId: 'test-1' },
        doctorCaller,
      );

      expect(prisma.labOrder.create).toHaveBeenCalledWith({
        data: {
          medicalRecordId: 'rec-1',
          labTestId: 'test-1',
          status: 'ORDERED',
          orderedAt: expect.any(Date),
        },
        include: expect.any(Object),
      });
      expect(result).toEqual(mockLabOrder);
    });

    it('rejects creation if medical record not found', async () => {
      prisma.medicalRecord.findUnique.mockResolvedValue(null);

      await expect(
        service.createLabOrder(
          { medicalRecordId: 'rec-missing', labTestId: 'test-1' },
          doctorCaller,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects creation if appointment is cancelled', async () => {
      prisma.medicalRecord.findUnique.mockResolvedValue({
        ...mockMedicalRecord,
        appointment: { ...mockMedicalRecord.appointment, status: 'CANCELLED' },
      });

      await expect(
        service.createLabOrder(
          { medicalRecordId: 'rec-1', labTestId: 'test-1' },
          doctorCaller,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('blocks non-treating doctor from ordering lab test', async () => {
      prisma.medicalRecord.findUnique.mockResolvedValue(mockMedicalRecord);
      prisma.doctor.findUnique.mockResolvedValue(mockOtherDoctorProfile);

      await expect(
        service.createLabOrder(
          { medicalRecordId: 'rec-1', labTestId: 'test-1' },
          otherDoctorCaller,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects lab test from another hospital', async () => {
      prisma.medicalRecord.findUnique.mockResolvedValue(mockMedicalRecord);
      prisma.doctor.findUnique.mockResolvedValue(mockDoctorProfile);
      prisma.labTest.findUnique.mockResolvedValue(mockLabTestOtherHosp);

      await expect(
        service.createLabOrder(
          { medicalRecordId: 'rec-1', labTestId: 'test-other' },
          doctorCaller,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getLabOrders', () => {
    it('returns lab orders scoped to hospital for staff', async () => {
      prisma.labOrder.findMany.mockResolvedValue([mockLabOrder]);

      const result = await service.getLabOrders({}, doctorCaller);

      expect(prisma.labOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            medicalRecord: expect.objectContaining({
              patient: { hospitalId: 'hosp-1' },
            }),
          },
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('isolates patient to only their own lab orders', async () => {
      prisma.patient.findUnique.mockResolvedValue(mockPatientProfile);
      prisma.labOrder.findMany.mockResolvedValue([mockLabOrder]);

      await service.getLabOrders({}, patientCaller);

      expect(prisma.labOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            medicalRecord: expect.objectContaining({
              patientId: 'pat-1',
              patient: { hospitalId: 'hosp-1' },
            }),
          },
        }),
      );
    });
  });

  describe('getLabOrderById', () => {
    it('returns lab order for authorized caller', async () => {
      prisma.labOrder.findUnique.mockResolvedValue(mockLabOrder);

      const result = await service.getLabOrderById('order-1', doctorCaller);

      expect(result.id).toBe('order-1');
    });

    it('blocks patient from accessing another patient lab order', async () => {
      prisma.labOrder.findUnique.mockResolvedValue(mockLabOrder);

      await expect(
        service.getLabOrderById('order-1', otherPatientCaller),
      ).rejects.toThrow(ForbiddenException);
    });

    it('blocks cross-hospital access to lab orders', async () => {
      prisma.labOrder.findUnique.mockResolvedValue(mockLabOrder);

      await expect(
        service.getLabOrderById('order-1', otherHospitalCaller),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateLabOrderStatus', () => {
    it('advances status from ORDERED to IN_PROGRESS and sets sampleCollectedAt', async () => {
      prisma.labOrder.findUnique.mockResolvedValue(mockLabOrder);
      prisma.labOrder.update.mockResolvedValue({
        ...mockLabOrder,
        status: 'IN_PROGRESS',
        sampleCollectedAt: new Date(),
      });

      const result = await service.updateLabOrderStatus(
        'order-1',
        { status: 'IN_PROGRESS' },
        labTechCaller,
      );

      expect(result.status).toBe('IN_PROGRESS');
      expect(prisma.labOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'IN_PROGRESS',
            sampleCollectedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('completes order from IN_PROGRESS and sets reviewedAt and findings', async () => {
      prisma.labOrder.findUnique.mockResolvedValue({
        ...mockLabOrder,
        status: 'IN_PROGRESS',
        sampleCollectedAt: new Date(),
      });
      prisma.labOrder.update.mockResolvedValue({
        ...mockLabOrder,
        status: 'COMPLETED',
        resultValue: 7.2,
        result: 'Normal',
        reviewedAt: new Date(),
      });

      const result = await service.updateLabOrderStatus(
        'order-1',
        { status: 'COMPLETED', resultValue: 7.2, result: 'Normal' },
        labTechCaller,
      );

      expect(result.status).toBe('COMPLETED');
    });

    it('rejects invalid status transition (COMPLETED to ORDERED)', async () => {
      prisma.labOrder.findUnique.mockResolvedValue({
        ...mockLabOrder,
        status: 'COMPLETED',
      });

      await expect(
        service.updateLabOrderStatus(
          'order-1',
          { status: 'ORDERED' },
          labTechCaller,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
