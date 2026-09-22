import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentController } from './appointment.controller';
import { AppointmentService } from './appointment.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { Request } from 'express';
import { AppointmentStatus } from './dto/update-appointment-status.dto';

describe('AppointmentController', () => {
  let controller: AppointmentController;
  let service: {
    createAppointment: jest.Mock;
    getCurrentUserAppointments: jest.Mock;
    getAppointments: jest.Mock;
    getAppointmentById: jest.Mock;
    updateAppointment: jest.Mock;
    updateAppointmentStatus: jest.Mock;
    deleteAppointment: jest.Mock;
  };

  const mockAppointment = {
    id: 'apt-1',
    doctorId: 'doc-1',
    patientId: 'pat-1',
    departmentId: 'dept-1',
    status: AppointmentStatus.PENDING,
  };

  beforeEach(async () => {
    service = {
      createAppointment: jest.fn(),
      getCurrentUserAppointments: jest.fn(),
      getAppointments: jest.fn(),
      getAppointmentById: jest.fn(),
      updateAppointment: jest.fn(),
      updateAppointmentStatus: jest.fn(),
      deleteAppointment: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppointmentController],
      providers: [
        {
          provide: AppointmentService,
          useValue: service,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AppointmentController>(AppointmentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createAppointment', () => {
    it('should book an appointment', async () => {
      service.createAppointment.mockResolvedValue(mockAppointment);

      const req = {
        user: {
          userId: 'user-pat-1',
          role: 'PATIENT',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.createAppointment(req, {
        doctorId: 'doc-1',
        departmentId: 'dept-1',
        appointmentDate: '2026-10-15',
        startTime: '2026-10-15T09:00:00.000Z',
        endTime: '2026-10-15T09:30:00.000Z',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAppointment);
      expect(service.createAppointment).toHaveBeenCalled();
    });
  });

  describe('getCurrentUserAppointments', () => {
    it('should return appointments for the current user', async () => {
      service.getCurrentUserAppointments.mockResolvedValue([mockAppointment]);

      const req = {
        user: {
          userId: 'user-pat-1',
          role: 'PATIENT',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.getCurrentUserAppointments(req);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockAppointment]);
    });
  });

  describe('getAppointments', () => {
    it('should list appointments with filters', async () => {
      service.getAppointments.mockResolvedValue([mockAppointment]);

      const req = {
        user: {
          userId: 'admin-1',
          role: 'HOSPITAL_ADMIN',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.getAppointments(req, {});

      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockAppointment]);
    });
  });

  describe('getAppointmentById', () => {
    it('should return appointment details', async () => {
      service.getAppointmentById.mockResolvedValue(mockAppointment);

      const req = {
        user: {
          userId: 'admin-1',
          role: 'HOSPITAL_ADMIN',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.getAppointmentById('apt-1', req);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAppointment);
    });
  });

  describe('updateAppointment', () => {
    it('should update appointment details', async () => {
      service.updateAppointment.mockResolvedValue({
        ...mockAppointment,
        reason: 'New reason',
      });

      const req = {
        user: {
          userId: 'admin-1',
          role: 'HOSPITAL_ADMIN',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.updateAppointment('apt-1', req, {
        reason: 'New reason',
      });

      expect(result.success).toBe(true);
      expect(result.data.reason).toBe('New reason');
    });
  });

  describe('updateAppointmentStatus', () => {
    it('should update appointment status', async () => {
      service.updateAppointmentStatus.mockResolvedValue({
        ...mockAppointment,
        status: AppointmentStatus.CONFIRMED,
      });

      const req = {
        user: {
          userId: 'recep-1',
          role: 'RECEPTIONIST',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.updateAppointmentStatus('apt-1', req, {
        status: AppointmentStatus.CONFIRMED,
      });

      expect(result.success).toBe(true);
      expect(result.data.status).toBe(AppointmentStatus.CONFIRMED);
    });
  });

  describe('deleteAppointment', () => {
    it('should cancel and remove appointment', async () => {
      service.deleteAppointment.mockResolvedValue({
        message: 'Appointment cancelled and removed successfully',
      });

      const req = {
        user: {
          userId: 'admin-1',
          role: 'HOSPITAL_ADMIN',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.deleteAppointment('apt-1', req);

      expect(result.success).toBe(true);
      expect(result.message).toContain('cancelled');
    });
  });
});
