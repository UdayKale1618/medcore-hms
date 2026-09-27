import { Test, TestingModule } from '@nestjs/testing';
import { LabTestController } from './lab-test.controller';
import { LabTestService } from './lab-test.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthUser } from '../auth/auth-user.interface';
import type { Request } from 'express';

describe('LabTestController', () => {
  let controller: LabTestController;
  let service: {
    createLabTest: jest.Mock;
    getLabTests: jest.Mock;
    getLabTestById: jest.Mock;
    updateLabTest: jest.Mock;
  };

  const labTechUser: AuthUser = {
    userId: 'user-tech-1',
    email: 'tech@apollo.com',
    roleId: 'role-tech',
    role: 'LAB_TECHNICIAN',
    hospitalId: 'hosp-1',
  };

  const mockRequest = {
    user: labTechUser,
  } as unknown as Request;

  beforeEach(async () => {
    service = {
      createLabTest: jest.fn(),
      getLabTests: jest.fn(),
      getLabTestById: jest.fn(),
      updateLabTest: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LabTestController],
      providers: [{ provide: LabTestService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<LabTestController>(LabTestController);
  });

  it('createLabTest delegates to service', async () => {
    const mockCreated = { id: 'test-1', name: 'CBC' };
    service.createLabTest.mockResolvedValue(mockCreated);

    const result = await controller.createLabTest(mockRequest, {
      name: 'CBC',
    });

    expect(service.createLabTest).toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      message: 'Lab test created successfully',
      data: mockCreated,
    });
  });

  it('getLabTests delegates to service', async () => {
    service.getLabTests.mockResolvedValue([{ id: 'test-1' }]);

    const result = await controller.getLabTests(mockRequest, {});

    expect(service.getLabTests).toHaveBeenCalledWith({}, labTechUser);
    expect(result.data).toHaveLength(1);
  });

  it('getLabTestById delegates to service', async () => {
    service.getLabTestById.mockResolvedValue({ id: 'test-1' });

    const result = await controller.getLabTestById('test-1', mockRequest);

    expect(service.getLabTestById).toHaveBeenCalledWith('test-1', labTechUser);
    expect(result.data.id).toBe('test-1');
  });

  it('updateLabTest delegates to service', async () => {
    service.updateLabTest.mockResolvedValue({ id: 'test-1', unit: 'g/dL' });

    const result = await controller.updateLabTest(
      'test-1',
      mockRequest,
      { unit: 'g/dL' },
    );

    expect(service.updateLabTest).toHaveBeenCalled();
    expect(result.data.unit).toBe('g/dL');
  });
});
