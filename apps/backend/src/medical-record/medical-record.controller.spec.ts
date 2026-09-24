import { Test, TestingModule } from '@nestjs/testing';
import { MedicalRecordController } from './medical-record.controller';
import { MedicalRecordService } from './medical-record.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { Request } from 'express';

describe('MedicalRecordController', () => {
  let controller: MedicalRecordController;
  let service: {
    createMedicalRecord: jest.Mock;
    getMedicalRecords: jest.Mock;
    getMedicalRecordById: jest.Mock;
    getMedicalRecordByAppointmentId: jest.Mock;
    updateMedicalRecord: jest.Mock;
  };

  const mockRecord = {
    id: 'mr-1',
    appointmentId: 'apt-1',
    patientId: 'pat-1',
    doctorId: 'doc-1',
    diagnosis: 'Hypertension',
  };

  beforeEach(async () => {
    service = {
      createMedicalRecord: jest.fn(),
      getMedicalRecords: jest.fn(),
      getMedicalRecordById: jest.fn(),
      getMedicalRecordByAppointmentId: jest.fn(),
      updateMedicalRecord: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MedicalRecordController],
      providers: [
        {
          provide: MedicalRecordService,
          useValue: service,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<MedicalRecordController>(MedicalRecordController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createMedicalRecord', () => {
    it('should create a medical record', async () => {
      service.createMedicalRecord.mockResolvedValue(mockRecord);

      const req = {
        user: {
          userId: 'user-doc-1',
          role: 'DOCTOR',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.createMedicalRecord(req, {
        appointmentId: 'apt-1',
        diagnosis: 'Hypertension',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockRecord);
      expect(service.createMedicalRecord).toHaveBeenCalled();
    });
  });

  describe('getMedicalRecords', () => {
    it('should list medical records', async () => {
      service.getMedicalRecords.mockResolvedValue([mockRecord]);

      const req = {
        user: {
          userId: 'user-doc-1',
          role: 'DOCTOR',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.getMedicalRecords(req, {});

      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockRecord]);
    });
  });

  describe('getMedicalRecordByAppointmentId', () => {
    it('should return a record by appointment ID', async () => {
      service.getMedicalRecordByAppointmentId.mockResolvedValue(mockRecord);

      const req = {
        user: {
          userId: 'user-doc-1',
          role: 'DOCTOR',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.getMedicalRecordByAppointmentId(
        'apt-1',
        req,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockRecord);
    });
  });

  describe('getMedicalRecordById', () => {
    it('should return a record by ID', async () => {
      service.getMedicalRecordById.mockResolvedValue(mockRecord);

      const req = {
        user: {
          userId: 'user-doc-1',
          role: 'DOCTOR',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.getMedicalRecordById('mr-1', req);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockRecord);
    });
  });

  describe('updateMedicalRecord', () => {
    it('should update a medical record', async () => {
      service.updateMedicalRecord.mockResolvedValue({
        ...mockRecord,
        notes: 'Follow up in 1 month',
      });

      const req = {
        user: {
          userId: 'user-doc-1',
          role: 'DOCTOR',
          hospitalId: 'hosp-1',
        },
      } as unknown as Request;

      const result = await controller.updateMedicalRecord('mr-1', req, {
        notes: 'Follow up in 1 month',
      });

      expect(result.success).toBe(true);
      expect(result.data.notes).toBe('Follow up in 1 month');
    });
  });

  describe('Deletion Protection', () => {
    it('verify controller has no delete endpoint or delete method', () => {
      expect((controller as any).deleteMedicalRecord).toBeUndefined();
      expect((controller as any).delete).toBeUndefined();
    });
  });
});
