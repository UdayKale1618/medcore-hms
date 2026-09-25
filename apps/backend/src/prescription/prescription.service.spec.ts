import { Test, TestingModule } from '@nestjs/testing';
import { PrescriptionService } from './prescription.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.interface';

describe('PrescriptionService', () => {
  let service: PrescriptionService;
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
    medicine: {
      findMany: jest.Mock;
    };
    prescription: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
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

  const superAdminCaller: AuthUser = {
    userId: 'user-super-1',
    email: 'super@medcore.com',
    roleId: 'role-super',
    role: 'SUPER_ADMIN',
    hospitalId: 'hosp-super',
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
    departmentId: 'dept-1',
    specialization: 'Internal Medicine',
  };

  const mockOtherDoctorProfile = {
    id: 'doc-2',
    userId: 'user-doc-2',
    departmentId: 'dept-1',
    specialization: 'Cardiology',
  };

  const mockPatientProfile = {
    id: 'pat-1',
    userId: 'user-pat-1',
    hospitalId: 'hosp-1',
  };

  const mockAppointment = {
    id: 'apt-1',
    status: 'IN_PROGRESS',
    deletedAt: null,
    department: {
      id: 'dept-1',
      name: 'Cardiology',
      hospitalId: 'hosp-1',
    },
  };

  const mockMedicalRecord = {
    id: 'rec-1',
    appointmentId: 'apt-1',
    patientId: 'pat-1',
    doctorId: 'doc-1',
    diagnosis: 'Bacterial Pharyngitis',
    symptoms: 'Sore throat, fever',
    treatmentPlan: 'Antibiotic therapy',
    appointment: mockAppointment,
    patient: {
      id: 'pat-1',
      hospitalId: 'hosp-1',
      userId: 'user-pat-1',
      user: {
        id: 'user-pat-1',
        name: 'Jane Doe',
        email: 'pat@apollo.com',
        phone: '+1 555-0101',
        hospitalId: 'hosp-1',
      },
    },
    doctor: {
      id: 'doc-1',
      departmentId: 'dept-1',
      specialization: 'Internal Medicine',
      user: {
        id: 'user-doc-1',
        name: 'Dr. Gregory House',
        email: 'doc@apollo.com',
        phone: '+1 555-0199',
        hospitalId: 'hosp-1',
      },
      department: {
        id: 'dept-1',
        name: 'Internal Medicine',
        hospitalId: 'hosp-1',
      },
    },
  };

  const mockMedicine1 = {
    id: 'med-1',
    hospitalId: 'hosp-1',
    name: 'Amoxicillin',
    form: 'CAPSULE',
    reorderLevel: 10,
    batches: [
      {
        id: 'batch-1',
        medicineId: 'med-1',
        batchNumber: 'B-001',
        expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90), // 90 days future
        quantity: 50,
      },
    ],
  };

  const mockMedicineExpired = {
    id: 'med-expired',
    hospitalId: 'hosp-1',
    name: 'ExpiredMed',
    form: 'TABLET',
    reorderLevel: 10,
    batches: [
      {
        id: 'batch-exp',
        medicineId: 'med-expired',
        batchNumber: 'B-EXP',
        expiryDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10), // expired
        quantity: 50,
      },
    ],
  };

  const mockMedicineHospitalB = {
    id: 'med-hosp-b',
    hospitalId: 'hosp-2',
    name: 'Foreign Med',
    form: 'TABLET',
    reorderLevel: 10,
    batches: [
      {
        id: 'batch-b',
        medicineId: 'med-hosp-b',
        batchNumber: 'B-002',
        expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90),
        quantity: 100,
      },
    ],
  };

  const mockPrescription = {
    id: 'presc-1',
    medicalRecordId: 'rec-1',
    digitalSignature: 'SIG-DOC-HOUSE-2026',
    issuedAt: new Date(),
    medicalRecord: mockMedicalRecord,
    items: [
      {
        id: 'item-1',
        prescriptionId: 'presc-1',
        medicineId: 'med-1',
        dosage: '500mg',
        frequency: 'TID',
        durationDays: 7,
        specialInstructions: 'After food',
        medicine: mockMedicine1,
      },
    ],
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
      medicine: {
        findMany: jest.fn(),
      },
      prescription: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((callback) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrescriptionService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PrescriptionService>(PrescriptionService);
  });

  describe('createPrescription', () => {
    it('creates prescription atomically for authorized treating doctor', async () => {
      prisma.medicalRecord.findUnique.mockResolvedValue(mockMedicalRecord);
      prisma.doctor.findUnique.mockResolvedValue(mockDoctorProfile);
      prisma.medicine.findMany.mockResolvedValue([mockMedicine1]);
      prisma.prescription.create.mockResolvedValue(mockPrescription);

      const result = await service.createPrescription(
        {
          medicalRecordId: 'rec-1',
          digitalSignature: 'SIG-DOC-HOUSE-2026',
          items: [
            {
              medicineId: 'med-1',
              dosage: '500mg',
              frequency: 'TID',
              durationDays: 7,
              specialInstructions: 'After food',
            },
          ],
        },
        doctorCaller,
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.prescription.create).toHaveBeenCalledWith({
        data: {
          medicalRecordId: 'rec-1',
          digitalSignature: 'SIG-DOC-HOUSE-2026',
          items: {
            create: [
              {
                medicineId: 'med-1',
                dosage: '500mg',
                frequency: 'TID',
                durationDays: 7,
                specialInstructions: 'After food',
              },
            ],
          },
        },
        include: expect.any(Object),
      });
      expect(result).toEqual(mockPrescription);
    });

    it('throws NotFoundException if medical record does not exist', async () => {
      prisma.medicalRecord.findUnique.mockResolvedValue(null);

      await expect(
        service.createPrescription(
          {
            medicalRecordId: 'rec-missing',
            items: [
              {
                medicineId: 'med-1',
                dosage: '500mg',
                frequency: 'TID',
                durationDays: 5,
              },
            ],
          },
          doctorCaller,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if appointment is cancelled', async () => {
      prisma.medicalRecord.findUnique.mockResolvedValue({
        ...mockMedicalRecord,
        appointment: { ...mockAppointment, status: 'CANCELLED' },
      });

      await expect(
        service.createPrescription(
          {
            medicalRecordId: 'rec-1',
            items: [
              {
                medicineId: 'med-1',
                dosage: '500mg',
                frequency: 'TID',
                durationDays: 5,
              },
            ],
          },
          doctorCaller,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException if non-assigned doctor attempts to prescribe', async () => {
      prisma.medicalRecord.findUnique.mockResolvedValue(mockMedicalRecord);
      prisma.doctor.findUnique.mockResolvedValue(mockOtherDoctorProfile);

      await expect(
        service.createPrescription(
          {
            medicalRecordId: 'rec-1',
            items: [
              {
                medicineId: 'med-1',
                dosage: '500mg',
                frequency: 'TID',
                durationDays: 5,
              },
            ],
          },
          otherDoctorCaller,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException if medical record belongs to another hospital', async () => {
      prisma.medicalRecord.findUnique.mockResolvedValue(mockMedicalRecord);

      await expect(
        service.createPrescription(
          {
            medicalRecordId: 'rec-1',
            items: [
              {
                medicineId: 'med-1',
                dosage: '500mg',
                frequency: 'TID',
                durationDays: 5,
              },
            ],
          },
          otherHospitalCaller,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException if duplicate medicines are in items', async () => {
      prisma.medicalRecord.findUnique.mockResolvedValue(mockMedicalRecord);
      prisma.doctor.findUnique.mockResolvedValue(mockDoctorProfile);

      await expect(
        service.createPrescription(
          {
            medicalRecordId: 'rec-1',
            items: [
              {
                medicineId: 'med-1',
                dosage: '250mg',
                frequency: 'BID',
                durationDays: 5,
              },
              {
                medicineId: 'med-1', // duplicate
                dosage: '500mg',
                frequency: 'TID',
                durationDays: 5,
              },
            ],
          },
          doctorCaller,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if medicine belongs to a different hospital', async () => {
      prisma.medicalRecord.findUnique.mockResolvedValue(mockMedicalRecord);
      prisma.doctor.findUnique.mockResolvedValue(mockDoctorProfile);
      prisma.medicine.findMany.mockResolvedValue([mockMedicineHospitalB]);

      await expect(
        service.createPrescription(
          {
            medicalRecordId: 'rec-1',
            items: [
              {
                medicineId: 'med-hosp-b',
                dosage: '500mg',
                frequency: 'TID',
                durationDays: 5,
              },
            ],
          },
          doctorCaller,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if medicine has no valid non-expired batch', async () => {
      prisma.medicalRecord.findUnique.mockResolvedValue(mockMedicalRecord);
      prisma.doctor.findUnique.mockResolvedValue(mockDoctorProfile);
      prisma.medicine.findMany.mockResolvedValue([mockMedicineExpired]);

      await expect(
        service.createPrescription(
          {
            medicalRecordId: 'rec-1',
            items: [
              {
                medicineId: 'med-expired',
                dosage: '500mg',
                frequency: 'TID',
                durationDays: 5,
              },
            ],
          },
          doctorCaller,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPrescriptions', () => {
    it('returns prescriptions scoped to hospital for staff', async () => {
      prisma.prescription.findMany.mockResolvedValue([mockPrescription]);

      const result = await service.getPrescriptions({}, doctorCaller);

      expect(prisma.prescription.findMany).toHaveBeenCalledWith(
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

    it('strictly isolates patient to their own prescriptions', async () => {
      prisma.patient.findUnique.mockResolvedValue(mockPatientProfile);
      prisma.prescription.findMany.mockResolvedValue([mockPrescription]);

      await service.getPrescriptions({}, patientCaller);

      expect(prisma.prescription.findMany).toHaveBeenCalledWith(
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

    it('blocks patient from querying another patient prescriptions', async () => {
      prisma.patient.findUnique.mockResolvedValue(mockPatientProfile);

      await expect(
        service.getPrescriptions({ patientId: 'pat-2' }, patientCaller),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getPrescriptionById', () => {
    it('returns prescription by ID for authorized staff', async () => {
      prisma.prescription.findUnique.mockResolvedValue(mockPrescription);

      const result = await service.getPrescriptionById('presc-1', doctorCaller);

      expect(result.id).toBe('presc-1');
    });

    it('allows patient to view their own prescription', async () => {
      prisma.prescription.findUnique.mockResolvedValue(mockPrescription);

      const result = await service.getPrescriptionById('presc-1', patientCaller);

      expect(result.id).toBe('presc-1');
    });

    it('blocks patient from viewing another patient prescription (403)', async () => {
      prisma.prescription.findUnique.mockResolvedValue(mockPrescription);

      await expect(
        service.getPrescriptionById('presc-1', otherPatientCaller),
      ).rejects.toThrow(ForbiddenException);
    });

    it('blocks cross-hospital access to prescription (403)', async () => {
      prisma.prescription.findUnique.mockResolvedValue(mockPrescription);

      await expect(
        service.getPrescriptionById('presc-1', otherHospitalCaller),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getMyPrescriptions', () => {
    it('returns patient prescriptions directly', async () => {
      prisma.patient.findUnique.mockResolvedValue(mockPatientProfile);
      prisma.prescription.findMany.mockResolvedValue([mockPrescription]);

      const result = await service.getMyPrescriptions(patientCaller);

      expect(result).toHaveLength(1);
    });
  });

  describe('updatePrescription', () => {
    it('allows prescribing doctor to update signature', async () => {
      prisma.prescription.findUnique.mockResolvedValue(mockPrescription);
      prisma.doctor.findUnique.mockResolvedValue(mockDoctorProfile);
      prisma.prescription.update.mockResolvedValue({
        ...mockPrescription,
        digitalSignature: 'SIG-UPDATED-2026',
      });

      const result = await service.updatePrescription(
        'presc-1',
        { digitalSignature: 'SIG-UPDATED-2026' },
        doctorCaller,
      );

      expect(result.digitalSignature).toBe('SIG-UPDATED-2026');
    });

    it('blocks non-prescribing doctor from updating prescription', async () => {
      prisma.prescription.findUnique.mockResolvedValue(mockPrescription);
      prisma.doctor.findUnique.mockResolvedValue(mockOtherDoctorProfile);

      await expect(
        service.updatePrescription(
          'presc-1',
          { digitalSignature: 'SIG-INVALID' },
          otherDoctorCaller,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
