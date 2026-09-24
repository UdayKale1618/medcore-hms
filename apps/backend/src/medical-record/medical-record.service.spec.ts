import { Test, TestingModule } from '@nestjs/testing';
import { MedicalRecordService } from './medical-record.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.interface';

describe('MedicalRecordService', () => {
  let service: MedicalRecordService;
  let prisma: {
    appointment: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    medicalRecord: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    doctor: {
      findUnique: jest.Mock;
    };
    patient: {
      findUnique: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const doctorCaller: AuthUser = {
    userId: 'user-doc-1',
    email: 'house@apollo.com',
    roleId: 'role-doc',
    role: 'DOCTOR',
    hospitalId: 'hosp-1',
  };

  const otherDoctorCaller: AuthUser = {
    userId: 'user-doc-2',
    email: 'wilson@apollo.com',
    roleId: 'role-doc',
    role: 'DOCTOR',
    hospitalId: 'hosp-1',
  };

  const patientCaller: AuthUser = {
    userId: 'user-pat-1',
    email: 'patient@apollo.com',
    roleId: 'role-pat',
    role: 'PATIENT',
    hospitalId: 'hosp-1',
  };

  const otherPatientCaller: AuthUser = {
    userId: 'user-pat-2',
    email: 'patient2@apollo.com',
    roleId: 'role-pat',
    role: 'PATIENT',
    hospitalId: 'hosp-1',
  };

  const adminCaller: AuthUser = {
    userId: 'admin-1',
    email: 'admin@apollo.com',
    roleId: 'role-admin',
    role: 'HOSPITAL_ADMIN',
    hospitalId: 'hosp-1',
  };

  const receptionistCaller: AuthUser = {
    userId: 'recep-1',
    email: 'recep@apollo.com',
    roleId: 'role-recep',
    role: 'RECEPTIONIST',
    hospitalId: 'hosp-1',
  };

  const superAdminCaller: AuthUser = {
    userId: 'super-1',
    email: 'super@medcore.com',
    roleId: 'role-super',
    role: 'SUPER_ADMIN',
    hospitalId: 'hosp-super',
  };

  const mockDoctor = {
    id: 'doc-1',
    userId: 'user-doc-1',
    departmentId: 'dept-1',
    specialization: 'Internal Medicine',
    user: {
      id: 'user-doc-1',
      name: 'Dr. Gregory House',
      email: 'house@apollo.com',
      phone: '+1 555-0199',
      hospitalId: 'hosp-1',
    },
  };

  const mockPatient = {
    id: 'pat-1',
    userId: 'user-pat-1',
    hospitalId: 'hosp-1',
    dateOfBirth: new Date('1990-01-01'),
    gender: 'MALE',
    user: {
      id: 'user-pat-1',
      name: 'Alice Patient',
      email: 'patient@apollo.com',
      phone: '+1 555-0100',
      hospitalId: 'hosp-1',
    },
  };

  const mockAppointment = {
    id: 'apt-1',
    doctorId: 'doc-1',
    patientId: 'pat-1',
    departmentId: 'dept-1',
    status: 'CONFIRMED',
    deletedAt: null,
    doctor: mockDoctor,
    patient: mockPatient,
    department: {
      id: 'dept-1',
      name: 'Internal Medicine',
      hospitalId: 'hosp-1',
    },
  };

  const mockMedicalRecord = {
    id: 'mr-1',
    appointmentId: 'apt-1',
    patientId: 'pat-1',
    doctorId: 'doc-1',
    chiefComplaint: 'Chest pain and fatigue',
    symptoms: 'Mild shortness of breath on exertion',
    diagnosis: 'Mild Angina',
    treatmentPlan: 'Rest, nitroglycerin as needed, follow-up in 2 weeks',
    bloodPressure: '120/80',
    pulse: 72,
    temperature: 37.0,
    spo2: 98,
    height: 175,
    weight: 70,
    bmi: 22.86,
    notes: 'Patient advised on lifestyle modifications',
    patient: mockPatient,
    doctor: mockDoctor,
    appointment: mockAppointment,
  };

  beforeEach(async () => {
    prisma = {
      appointment: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      medicalRecord: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      doctor: {
        findUnique: jest.fn(),
      },
      patient: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback({
          medicalRecord: {
            create: jest.fn().mockResolvedValue(mockMedicalRecord),
          },
          appointment: {
            update: jest.fn().mockResolvedValue({
              ...mockAppointment,
              status: 'IN_PROGRESS',
            }),
          },
        });
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MedicalRecordService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<MedicalRecordService>(MedicalRecordService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =========================================================
  // 1-8. CREATION TESTS
  // =========================================================
  describe('createMedicalRecord', () => {
    it('1. should create a medical record successfully and transition appointment to IN_PROGRESS', async () => {
      prisma.appointment.findUnique.mockResolvedValue(mockAppointment);
      prisma.medicalRecord.findUnique.mockResolvedValue(null); // No existing record
      prisma.doctor.findUnique.mockResolvedValue(mockDoctor);

      const result = await service.createMedicalRecord(
        {
          appointmentId: 'apt-1',
          chiefComplaint: 'Chest pain and fatigue',
          diagnosis: 'Mild Angina',
          height: 175,
          weight: 70,
        },
        doctorCaller,
      );

      expect(result).toEqual(mockMedicalRecord);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('2. should throw NotFoundException if appointment does not exist', async () => {
      prisma.appointment.findUnique.mockResolvedValue(null);

      await expect(
        service.createMedicalRecord(
          { appointmentId: 'non-existent' },
          doctorCaller,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if appointment is CANCELLED', async () => {
      prisma.appointment.findUnique.mockResolvedValue({
        ...mockAppointment,
        status: 'CANCELLED',
      });

      await expect(
        service.createMedicalRecord({ appointmentId: 'apt-1' }, doctorCaller),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if a medical record already exists for the appointment', async () => {
      prisma.appointment.findUnique.mockResolvedValue(mockAppointment);
      prisma.medicalRecord.findUnique.mockResolvedValue(mockMedicalRecord);

      await expect(
        service.createMedicalRecord({ appointmentId: 'apt-1' }, doctorCaller),
      ).rejects.toThrow(ConflictException);
    });

    it('5. should throw BadRequestException if specified patientId does not match appointment', async () => {
      prisma.appointment.findUnique.mockResolvedValue(mockAppointment);
      prisma.medicalRecord.findUnique.mockResolvedValue(null);

      await expect(
        service.createMedicalRecord(
          { appointmentId: 'apt-1', patientId: 'wrong-patient' },
          doctorCaller,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('6. should throw BadRequestException if specified doctorId does not match appointment', async () => {
      prisma.appointment.findUnique.mockResolvedValue(mockAppointment);
      prisma.medicalRecord.findUnique.mockResolvedValue(null);

      await expect(
        service.createMedicalRecord(
          { appointmentId: 'apt-1', doctorId: 'wrong-doctor' },
          doctorCaller,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('7. should throw ForbiddenException if appointment belongs to another hospital', async () => {
      prisma.appointment.findUnique.mockResolvedValue({
        ...mockAppointment,
        department: { ...mockAppointment.department, hospitalId: 'hosp-other' },
      });
      prisma.medicalRecord.findUnique.mockResolvedValue(null);

      await expect(
        service.createMedicalRecord({ appointmentId: 'apt-1' }, doctorCaller),
      ).rejects.toThrow(ForbiddenException);
    });

    it('8. should throw ForbiddenException if a doctor tries to create a record for another doctor appointment', async () => {
      prisma.appointment.findUnique.mockResolvedValue(mockAppointment);
      prisma.medicalRecord.findUnique.mockResolvedValue(null);
      prisma.doctor.findUnique.mockResolvedValue({
        ...mockDoctor,
        id: 'doc-other',
      });

      await expect(
        service.createMedicalRecord(
          { appointmentId: 'apt-1' },
          otherDoctorCaller,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // =========================================================
  // 9-14. RETRIEVAL TESTS
  // =========================================================
  describe('getMedicalRecordById & getMedicalRecords', () => {
    it('9. should retrieve a medical record by ID', async () => {
      prisma.medicalRecord.findUnique.mockResolvedValue(mockMedicalRecord);

      const result = await service.getMedicalRecordById('mr-1', doctorCaller);

      expect(result).toEqual(mockMedicalRecord);
    });

    it('10. should list medical records filtered by hospital tenancy', async () => {
      prisma.medicalRecord.findMany.mockResolvedValue([mockMedicalRecord]);

      const result = await service.getMedicalRecords({}, doctorCaller);

      expect(result).toEqual([mockMedicalRecord]);
      expect(prisma.medicalRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            patient: { hospitalId: 'hosp-1' },
          }),
        }),
      );
    });

    it('11. should allow PATIENT to view their own record', async () => {
      prisma.medicalRecord.findUnique.mockResolvedValue(mockMedicalRecord);

      const result = await service.getMedicalRecordById('mr-1', patientCaller);

      expect(result).toEqual(mockMedicalRecord);
    });

    it('11b. should throw ForbiddenException if PATIENT tries to access another patient record', async () => {
      prisma.medicalRecord.findUnique.mockResolvedValue(mockMedicalRecord);

      await expect(
        service.getMedicalRecordById('mr-1', otherPatientCaller),
      ).rejects.toThrow(ForbiddenException);
    });

    it('12. should allow assigned DOCTOR to access record', async () => {
      prisma.medicalRecord.findUnique.mockResolvedValue(mockMedicalRecord);

      const result = await service.getMedicalRecordById('mr-1', doctorCaller);

      expect(result).toEqual(mockMedicalRecord);
    });

    it('13 & 14. should throw ForbiddenException if record belongs to another hospital', async () => {
      prisma.medicalRecord.findUnique.mockResolvedValue({
        ...mockMedicalRecord,
        patient: { ...mockPatient, hospitalId: 'hosp-other' },
      });

      await expect(
        service.getMedicalRecordById('mr-1', doctorCaller),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should retrieve record by appointment ID', async () => {
      prisma.medicalRecord.findUnique.mockResolvedValue(mockMedicalRecord);

      const result = await service.getMedicalRecordByAppointmentId(
        'apt-1',
        doctorCaller,
      );

      expect(result).toEqual(mockMedicalRecord);
      expect(prisma.medicalRecord.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { appointmentId: 'apt-1' },
        }),
      );
    });
  });

  // =========================================================
  // 15-17. UPDATE TESTS
  // =========================================================
  describe('updateMedicalRecord', () => {
    it('15. should allow treating DOCTOR to update medical record (append notes & treatment plan)', async () => {
      prisma.medicalRecord.findUnique.mockResolvedValue(mockMedicalRecord);
      prisma.doctor.findUnique.mockResolvedValue(mockDoctor);
      const updatedRecord = {
        ...mockMedicalRecord,
        treatmentPlan: 'Updated treatment plan',
      };
      prisma.medicalRecord.update.mockResolvedValue(updatedRecord);

      const result = await service.updateMedicalRecord(
        'mr-1',
        { treatmentPlan: 'Updated treatment plan' },
        doctorCaller,
      );

      expect(result.treatmentPlan).toBe('Updated treatment plan');
      expect(prisma.medicalRecord.update).toHaveBeenCalled();
    });

    it('16. should throw ForbiddenException if non-treating DOCTOR tries to update record', async () => {
      prisma.medicalRecord.findUnique.mockResolvedValue(mockMedicalRecord);
      prisma.doctor.findUnique.mockResolvedValue({
        ...mockDoctor,
        id: 'doc-other',
      });

      await expect(
        service.updateMedicalRecord(
          'mr-1',
          { notes: 'Unauthorized update' },
          otherDoctorCaller,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('17. should throw ForbiddenException if PATIENT attempts to update medical record', async () => {
      prisma.medicalRecord.findUnique.mockResolvedValue(mockMedicalRecord);

      await expect(
        service.updateMedicalRecord(
          'mr-1',
          { notes: 'Patient trying to edit' },
          patientCaller,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // =========================================================
  // 18-19. DELETION POLICY (NO PERMANENT DELETE)
  // =========================================================
  describe('Deletion Policy', () => {
    it('18 & 19. verify MedicalRecordService has no delete method and records are persistent', () => {
      expect((service as any).deleteMedicalRecord).toBeUndefined();
      expect((service as any).delete).toBeUndefined();
    });
  });
});
