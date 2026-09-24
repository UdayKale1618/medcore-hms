import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentService } from './appointment.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.interface';
import { AppointmentType } from './dto/create-appointment.dto';
import { AppointmentStatus } from './dto/update-appointment-status.dto';

describe('AppointmentService', () => {
  let service: AppointmentService;
  let prisma: {
    doctor: {
      findUnique: jest.Mock;
    };
    patient: {
      findUnique: jest.Mock;
    };
    department: {
      findUnique: jest.Mock;
    };
    doctorAvailability: {
      findMany: jest.Mock;
    };
    appointment: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
    $queryRaw: jest.Mock;
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

  const doctorCaller: AuthUser = {
    userId: 'user-doc-1',
    email: 'doctor@apollo.com',
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
    specialization: 'Cardiology',
    licenseNumber: 'DOC-12345',
    consultationFee: 500,
    deletedAt: null,
    user: {
      id: 'user-doc-1',
      name: 'Dr. House',
      email: 'doctor@apollo.com',
      phone: '+91 9999999999',
      hospitalId: 'hosp-1',
    },
    department: {
      id: 'dept-1',
      name: 'Cardiology Dept',
      hospitalId: 'hosp-1',
    },
  };

  const mockPatient = {
    id: 'pat-1',
    userId: 'user-pat-1',
    hospitalId: 'hosp-1',
    dateOfBirth: new Date('1990-01-01'),
    gender: 'MALE',
    bloodGroup: 'O+',
    deletedAt: null,
    user: {
      id: 'user-pat-1',
      name: 'Alice Patient',
      email: 'patient@apollo.com',
      phone: '+91 9888877777',
      hospitalId: 'hosp-1',
    },
  };

  const mockDepartment = {
    id: 'dept-1',
    name: 'Cardiology Dept',
    hospitalId: 'hosp-1',
  };

  const mockAvailability = {
    id: 'avail-1',
    doctorId: 'doc-1',
    dayOfWeek: 4, // Thursday
    startTime: '09:00',
    endTime: '17:00',
    slotMinutes: 30,
  };

  // Thursday 2026-10-15: 10:00 to 10:30 UTC (dayOfWeek = 4)
  const validStartTime = '2026-10-15T10:00:00.000Z';
  const validEndTime = '2026-10-15T10:30:00.000Z';
  const validDate = '2026-10-15T00:00:00.000Z';

  const mockAppointment = {
    id: 'apt-1',
    doctorId: 'doc-1',
    patientId: 'pat-1',
    departmentId: 'dept-1',
    appointmentDate: new Date(validDate),
    startTime: new Date(validStartTime),
    endTime: new Date(validEndTime),
    status: AppointmentStatus.PENDING,
    type: AppointmentType.REGULAR,
    reason: 'Routine checkup',
    notes: 'No specific notes',
    deletedAt: null,
    doctor: mockDoctor,
    patient: mockPatient,
    department: mockDepartment,
  };

  beforeEach(async () => {
    prisma = {
      doctor: {
        findUnique: jest.fn(),
      },
      patient: {
        findUnique: jest.fn(),
      },
      department: {
        findUnique: jest.fn(),
      },
      doctorAvailability: {
        findMany: jest.fn(),
      },
      appointment: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => cb(prisma)),
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'mock-id' }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<AppointmentService>(AppointmentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =========================================================
  // 1-12. CREATION TESTS
  // =========================================================
  describe('createAppointment', () => {
    it('1. should create an appointment successfully', async () => {
      prisma.patient.findUnique.mockResolvedValue(mockPatient);
      prisma.doctor.findUnique.mockResolvedValue(mockDoctor);
      prisma.department.findUnique.mockResolvedValue(mockDepartment);
      prisma.doctorAvailability.findMany.mockResolvedValue([mockAvailability]);
      prisma.appointment.findFirst.mockResolvedValue(null); // No conflict
      prisma.appointment.create.mockResolvedValue(mockAppointment);

      const result = await service.createAppointment(
        {
          doctorId: 'doc-1',
          patientId: 'pat-1',
          departmentId: 'dept-1',
          appointmentDate: validDate,
          startTime: validStartTime,
          endTime: validEndTime,
          reason: 'Routine checkup',
        },
        receptionistCaller,
      );

      expect(result).toEqual(mockAppointment);
      expect(prisma.appointment.create).toHaveBeenCalled();
    });

    it('should derive patientId from caller if caller is PATIENT', async () => {
      prisma.patient.findUnique.mockResolvedValue(mockPatient);
      prisma.doctor.findUnique.mockResolvedValue(mockDoctor);
      prisma.department.findUnique.mockResolvedValue(mockDepartment);
      prisma.doctorAvailability.findMany.mockResolvedValue([mockAvailability]);
      prisma.appointment.findFirst.mockResolvedValue(null);
      prisma.appointment.create.mockResolvedValue(mockAppointment);

      const result = await service.createAppointment(
        {
          doctorId: 'doc-1',
          departmentId: 'dept-1',
          appointmentDate: validDate,
          startTime: validStartTime,
          endTime: validEndTime,
        },
        patientCaller,
      );

      expect(result).toEqual(mockAppointment);
      expect(prisma.patient.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-pat-1' },
      });
    });

    it('2. should throw NotFoundException if doctor does not exist', async () => {
      prisma.patient.findUnique.mockResolvedValue(mockPatient);
      prisma.doctor.findUnique.mockResolvedValue(null);

      await expect(
        service.createAppointment(
          {
            doctorId: 'non-existent',
            patientId: 'pat-1',
            departmentId: 'dept-1',
            appointmentDate: validDate,
            startTime: validStartTime,
            endTime: validEndTime,
          },
          adminCaller,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('3. should throw NotFoundException if patient does not exist', async () => {
      prisma.patient.findUnique.mockResolvedValue(null);

      await expect(
        service.createAppointment(
          {
            doctorId: 'doc-1',
            patientId: 'non-existent',
            departmentId: 'dept-1',
            appointmentDate: validDate,
            startTime: validStartTime,
            endTime: validEndTime,
          },
          adminCaller,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('4. should throw NotFoundException if department does not exist', async () => {
      prisma.patient.findUnique.mockResolvedValue(mockPatient);
      prisma.doctor.findUnique.mockResolvedValue(mockDoctor);
      prisma.department.findUnique.mockResolvedValue(null);

      await expect(
        service.createAppointment(
          {
            doctorId: 'doc-1',
            patientId: 'pat-1',
            departmentId: 'non-existent',
            appointmentDate: validDate,
            startTime: validStartTime,
            endTime: validEndTime,
          },
          adminCaller,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('5. should throw BadRequestException if doctor does not belong to department', async () => {
      prisma.patient.findUnique.mockResolvedValue(mockPatient);
      prisma.doctor.findUnique.mockResolvedValue(mockDoctor);
      prisma.department.findUnique.mockResolvedValue({
        id: 'dept-2',
        name: 'Neurology',
        hospitalId: 'hosp-1',
      });

      await expect(
        service.createAppointment(
          {
            doctorId: 'doc-1',
            patientId: 'pat-1',
            departmentId: 'dept-2',
            appointmentDate: validDate,
            startTime: validStartTime,
            endTime: validEndTime,
          },
          adminCaller,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('6. should throw ForbiddenException if patient belongs to another hospital', async () => {
      prisma.patient.findUnique.mockResolvedValue({
        ...mockPatient,
        hospitalId: 'hosp-2',
      });
      prisma.doctor.findUnique.mockResolvedValue(mockDoctor);
      prisma.department.findUnique.mockResolvedValue(mockDepartment);

      await expect(
        service.createAppointment(
          {
            doctorId: 'doc-1',
            patientId: 'pat-1',
            departmentId: 'dept-1',
            appointmentDate: validDate,
            startTime: validStartTime,
            endTime: validEndTime,
          },
          adminCaller,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('7. should throw NotFoundException if doctor is soft-deleted', async () => {
      prisma.patient.findUnique.mockResolvedValue(mockPatient);
      prisma.doctor.findUnique.mockResolvedValue({
        ...mockDoctor,
        deletedAt: new Date(),
      });

      await expect(
        service.createAppointment(
          {
            doctorId: 'doc-1',
            patientId: 'pat-1',
            departmentId: 'dept-1',
            appointmentDate: validDate,
            startTime: validStartTime,
            endTime: validEndTime,
          },
          adminCaller,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('8. should throw NotFoundException if patient is soft-deleted', async () => {
      prisma.patient.findUnique.mockResolvedValue({
        ...mockPatient,
        deletedAt: new Date(),
      });

      await expect(
        service.createAppointment(
          {
            doctorId: 'doc-1',
            patientId: 'pat-1',
            departmentId: 'dept-1',
            appointmentDate: validDate,
            startTime: validStartTime,
            endTime: validEndTime,
          },
          adminCaller,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('9. should throw BadRequestException if appointment time is outside doctor availability', async () => {
      prisma.patient.findUnique.mockResolvedValue(mockPatient);
      prisma.doctor.findUnique.mockResolvedValue(mockDoctor);
      prisma.department.findUnique.mockResolvedValue(mockDepartment);
      prisma.doctorAvailability.findMany.mockResolvedValue([mockAvailability]); // 09:00 - 17:00

      // 18:00 is outside availability
      const lateStart = '2026-10-15T18:00:00.000Z';
      const lateEnd = '2026-10-15T18:30:00.000Z';

      await expect(
        service.createAppointment(
          {
            doctorId: 'doc-1',
            patientId: 'pat-1',
            departmentId: 'dept-1',
            appointmentDate: validDate,
            startTime: lateStart,
            endTime: lateEnd,
          },
          adminCaller,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should bypass availability schedule for EMERGENCY type', async () => {
      prisma.patient.findUnique.mockResolvedValue(mockPatient);
      prisma.doctor.findUnique.mockResolvedValue(mockDoctor);
      prisma.department.findUnique.mockResolvedValue(mockDepartment);
      prisma.appointment.findFirst.mockResolvedValue(null);
      prisma.appointment.create.mockResolvedValue({
        ...mockAppointment,
        type: AppointmentType.EMERGENCY,
      });

      const lateStart = '2026-10-15T23:00:00.000Z';
      const lateEnd = '2026-10-15T23:30:00.000Z';

      const result = await service.createAppointment(
        {
          doctorId: 'doc-1',
          patientId: 'pat-1',
          departmentId: 'dept-1',
          appointmentDate: validDate,
          startTime: lateStart,
          endTime: lateEnd,
          type: AppointmentType.EMERGENCY,
        },
        receptionistCaller,
      );

      expect(result.type).toBe(AppointmentType.EMERGENCY);
      expect(prisma.doctorAvailability.findMany).not.toHaveBeenCalled();
    });

    it('10. should throw BadRequestException if startTime >= endTime', async () => {
      prisma.patient.findUnique.mockResolvedValue(mockPatient);
      prisma.doctor.findUnique.mockResolvedValue(mockDoctor);
      prisma.department.findUnique.mockResolvedValue(mockDepartment);

      await expect(
        service.createAppointment(
          {
            doctorId: 'doc-1',
            patientId: 'pat-1',
            departmentId: 'dept-1',
            appointmentDate: validDate,
            startTime: validEndTime,
            endTime: validStartTime, // inverted
          },
          adminCaller,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('11. should throw ConflictException if doctor has overlapping appointment', async () => {
      prisma.patient.findUnique.mockResolvedValue(mockPatient);
      prisma.doctor.findUnique.mockResolvedValue(mockDoctor);
      prisma.department.findUnique.mockResolvedValue(mockDepartment);
      prisma.doctorAvailability.findMany.mockResolvedValue([mockAvailability]);
      prisma.appointment.findFirst
        .mockResolvedValueOnce(mockAppointment) // Doctor conflict found!
        .mockResolvedValueOnce(null);

      await expect(
        service.createAppointment(
          {
            doctorId: 'doc-1',
            patientId: 'pat-1',
            departmentId: 'dept-1',
            appointmentDate: validDate,
            startTime: validStartTime,
            endTime: validEndTime,
          },
          adminCaller,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('11b. should throw ConflictException if patient has overlapping appointment', async () => {
      prisma.patient.findUnique.mockResolvedValue(mockPatient);
      prisma.doctor.findUnique.mockResolvedValue(mockDoctor);
      prisma.department.findUnique.mockResolvedValue(mockDepartment);
      prisma.doctorAvailability.findMany.mockResolvedValue([mockAvailability]);
      prisma.appointment.findFirst
        .mockResolvedValueOnce(null) // No doctor conflict
        .mockResolvedValueOnce(mockAppointment); // Patient conflict found!

      await expect(
        service.createAppointment(
          {
            doctorId: 'doc-1',
            patientId: 'pat-1',
            departmentId: 'dept-1',
            appointmentDate: validDate,
            startTime: validStartTime,
            endTime: validEndTime,
          },
          adminCaller,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  // =========================================================
  // 13-17. RETRIEVAL TESTS
  // =========================================================
  describe('getAppointments & getAppointmentById', () => {
    it('13. should list appointments filtered by tenant and deletedAt: null', async () => {
      prisma.appointment.findMany.mockResolvedValue([mockAppointment]);

      const result = await service.getAppointments({}, adminCaller);

      expect(result).toEqual([mockAppointment]);
      expect(prisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            department: { hospitalId: 'hosp-1' },
            deletedAt: null,
          }),
        }),
      );
    });

    it('14. should get appointment by id', async () => {
      prisma.appointment.findUnique.mockResolvedValue(mockAppointment);

      const result = await service.getAppointmentById('apt-1', adminCaller);

      expect(result).toEqual(mockAppointment);
    });

    it('15. should throw ForbiddenException if appointment belongs to another hospital', async () => {
      prisma.appointment.findUnique.mockResolvedValue({
        ...mockAppointment,
        department: { ...mockDepartment, hospitalId: 'hosp-other' },
      });

      await expect(
        service.getAppointmentById('apt-1', adminCaller),
      ).rejects.toThrow(ForbiddenException);
    });

    it('16. should throw ForbiddenException if PATIENT tries to view another patient appointment', async () => {
      prisma.appointment.findUnique.mockResolvedValue(mockAppointment);

      await expect(
        service.getAppointmentById('apt-1', otherPatientCaller),
      ).rejects.toThrow(ForbiddenException);
    });

    it('16b. should restrict PATIENT to their own appointments when listing', async () => {
      prisma.patient.findUnique.mockResolvedValue(mockPatient);
      prisma.appointment.findMany.mockResolvedValue([mockAppointment]);

      const result = await service.getAppointments({}, patientCaller);

      expect(result).toEqual([mockAppointment]);
      expect(prisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            patientId: 'pat-1',
            deletedAt: null,
          }),
        }),
      );
    });

    it('17. should allow DOCTOR to retrieve their own appointments', async () => {
      prisma.doctor.findUnique.mockResolvedValue(mockDoctor);
      prisma.appointment.findMany.mockResolvedValue([mockAppointment]);

      const result = await service.getAppointments({}, doctorCaller);

      expect(result).toEqual([mockAppointment]);
      expect(prisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            doctorId: 'doc-1',
          }),
        }),
      );
    });
  });

  // =========================================================
  // 18-21. UPDATE TESTS
  // =========================================================
  describe('updateAppointment & updateAppointmentStatus', () => {
    it('18. should update appointment details (notes / reason)', async () => {
      prisma.appointment.findUnique.mockResolvedValue(mockAppointment);
      prisma.appointment.update.mockResolvedValue({
        ...mockAppointment,
        reason: 'Updated reason',
      });

      const result = await service.updateAppointment(
        'apt-1',
        { reason: 'Updated reason' },
        adminCaller,
      );

      expect(result.reason).toBe('Updated reason');
      expect(prisma.appointment.update).toHaveBeenCalled();
    });

    it('should allow valid status transition (PENDING -> CONFIRMED)', async () => {
      prisma.appointment.findUnique.mockResolvedValue(mockAppointment);
      prisma.appointment.update.mockResolvedValue({
        ...mockAppointment,
        status: AppointmentStatus.CONFIRMED,
      });

      const result = await service.updateAppointmentStatus(
        'apt-1',
        { status: AppointmentStatus.CONFIRMED },
        receptionistCaller,
      );

      expect(result.status).toBe(AppointmentStatus.CONFIRMED);
    });

    it('19. should reject invalid status transition (PENDING -> COMPLETED)', async () => {
      prisma.appointment.findUnique.mockResolvedValue(mockAppointment);

      await expect(
        service.updateAppointmentStatus(
          'apt-1',
          { status: AppointmentStatus.COMPLETED },
          adminCaller,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('20. should block cross-hospital appointment update (403)', async () => {
      prisma.appointment.findUnique.mockResolvedValue({
        ...mockAppointment,
        department: { ...mockDepartment, hospitalId: 'hosp-other' },
      });

      await expect(
        service.updateAppointment('apt-1', { reason: 'Test' }, adminCaller),
      ).rejects.toThrow(ForbiddenException);
    });

    it('21. should reject PATIENT updating status to anything other than CANCELLED', async () => {
      prisma.appointment.findUnique.mockResolvedValue(mockAppointment);

      await expect(
        service.updateAppointmentStatus(
          'apt-1',
          { status: AppointmentStatus.CONFIRMED },
          patientCaller,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow PATIENT to cancel their own PENDING appointment', async () => {
      prisma.appointment.findUnique.mockResolvedValue(mockAppointment);
      prisma.appointment.update.mockResolvedValue({
        ...mockAppointment,
        status: AppointmentStatus.CANCELLED,
      });

      const result = await service.updateAppointmentStatus(
        'apt-1',
        { status: AppointmentStatus.CANCELLED },
        patientCaller,
      );

      expect(result.status).toBe(AppointmentStatus.CANCELLED);
    });
  });

  // =========================================================
  // 22-25. DELETE / CANCEL TESTS
  // =========================================================
  describe('deleteAppointment', () => {
    it('22 & 23. should soft delete and cancel appointment', async () => {
      prisma.appointment.findUnique.mockResolvedValue(mockAppointment);
      prisma.appointment.update.mockResolvedValue({
        ...mockAppointment,
        status: AppointmentStatus.CANCELLED,
        deletedAt: new Date(),
      });

      const result = await service.deleteAppointment('apt-1', adminCaller);

      expect(result.message).toContain('cancelled');
      expect(prisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'apt-1' },
          data: expect.objectContaining({
            status: AppointmentStatus.CANCELLED,
            deletedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('24. should throw NotFoundException when retrieving soft-deleted appointment', async () => {
      prisma.appointment.findUnique.mockResolvedValue({
        ...mockAppointment,
        deletedAt: new Date(),
      });

      await expect(
        service.getAppointmentById('apt-1', adminCaller),
      ).rejects.toThrow(NotFoundException);
    });

    it('25. should block cross-hospital deletion (403)', async () => {
      prisma.appointment.findUnique.mockResolvedValue({
        ...mockAppointment,
        department: { ...mockDepartment, hospitalId: 'hosp-other' },
      });

      await expect(
        service.deleteAppointment('apt-1', adminCaller),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
