import { Test, TestingModule } from '@nestjs/testing';
import { PrescriptionController } from './prescription.controller';
import { PrescriptionService } from './prescription.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthUser } from '../auth/auth-user.interface';
import type { Request } from 'express';

describe('PrescriptionController', () => {
  let controller: PrescriptionController;
  let service: {
    createPrescription: jest.Mock;
    getPrescriptions: jest.Mock;
    getPrescriptionById: jest.Mock;
    getPrescriptionsByMedicalRecordId: jest.Mock;
    getMyPrescriptions: jest.Mock;
    updatePrescription: jest.Mock;
  };

  const doctorUser: AuthUser = {
    userId: 'user-doc-1',
    email: 'doc@apollo.com',
    roleId: 'role-doc',
    role: 'DOCTOR',
    hospitalId: 'hosp-1',
  };

  const patientUser: AuthUser = {
    userId: 'user-pat-1',
    email: 'pat@apollo.com',
    roleId: 'role-pat',
    role: 'PATIENT',
    hospitalId: 'hosp-1',
  };

  const mockDoctorRequest = {
    user: doctorUser,
  } as unknown as Request;

  const mockPatientRequest = {
    user: patientUser,
  } as unknown as Request;

  beforeEach(async () => {
    service = {
      createPrescription: jest.fn(),
      getPrescriptions: jest.fn(),
      getPrescriptionById: jest.fn(),
      getPrescriptionsByMedicalRecordId: jest.fn(),
      getMyPrescriptions: jest.fn(),
      updatePrescription: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PrescriptionController],
      providers: [{ provide: PrescriptionService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PrescriptionController>(PrescriptionController);
  });

  it('createPrescription delegates to service', async () => {
    const mockCreated = { id: 'presc-1' };
    service.createPrescription.mockResolvedValue(mockCreated);

    const result = await controller.createPrescription(mockDoctorRequest, {
      medicalRecordId: 'rec-1',
      items: [
        {
          medicineId: 'med-1',
          dosage: '500mg',
          frequency: 'TID',
          durationDays: 5,
        },
      ],
    });

    expect(service.createPrescription).toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      message: 'Prescription created successfully',
      data: mockCreated,
    });
  });

  it('getMyPrescriptions delegates to service', async () => {
    service.getMyPrescriptions.mockResolvedValue([{ id: 'presc-1' }]);

    const result = await controller.getMyPrescriptions(mockPatientRequest);

    expect(service.getMyPrescriptions).toHaveBeenCalledWith(patientUser);
    expect(result.data).toHaveLength(1);
  });

  it('getPrescriptionsByMedicalRecordId delegates to service', async () => {
    service.getPrescriptionsByMedicalRecordId.mockResolvedValue([{ id: 'presc-1' }]);

    const result = await controller.getPrescriptionsByMedicalRecordId(
      'rec-1',
      mockDoctorRequest,
    );

    expect(service.getPrescriptionsByMedicalRecordId).toHaveBeenCalledWith(
      'rec-1',
      doctorUser,
    );
    expect(result.data).toHaveLength(1);
  });

  it('getPrescriptions delegates to service', async () => {
    service.getPrescriptions.mockResolvedValue([{ id: 'presc-1' }]);

    const result = await controller.getPrescriptions(mockDoctorRequest, {});

    expect(service.getPrescriptions).toHaveBeenCalledWith({}, doctorUser);
    expect(result.data).toHaveLength(1);
  });

  it('getPrescriptionById delegates to service', async () => {
    service.getPrescriptionById.mockResolvedValue({ id: 'presc-1' });

    const result = await controller.getPrescriptionById('presc-1', mockDoctorRequest);

    expect(service.getPrescriptionById).toHaveBeenCalledWith('presc-1', doctorUser);
    expect(result.data.id).toBe('presc-1');
  });

  it('updatePrescription delegates to service', async () => {
    service.updatePrescription.mockResolvedValue({ id: 'presc-1', digitalSignature: 'SIG' });

    const result = await controller.updatePrescription(
      'presc-1',
      mockDoctorRequest,
      { digitalSignature: 'SIG' },
    );

    expect(service.updatePrescription).toHaveBeenCalled();
    expect(result.data.digitalSignature).toBe('SIG');
  });
});
