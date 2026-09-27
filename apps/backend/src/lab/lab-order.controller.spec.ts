import { Test, TestingModule } from '@nestjs/testing';
import { LabOrderController } from './lab-order.controller';
import { LabOrderService } from './lab-order.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthUser } from '../auth/auth-user.interface';
import type { Request } from 'express';

describe('LabOrderController', () => {
  let controller: LabOrderController;
  let service: {
    createLabOrder: jest.Mock;
    getLabOrders: jest.Mock;
    getLabOrderById: jest.Mock;
    getLabOrdersByMedicalRecordId: jest.Mock;
    updateLabOrder: jest.Mock;
    updateLabOrderStatus: jest.Mock;
  };

  const doctorUser: AuthUser = {
    userId: 'user-doc-1',
    email: 'doc@apollo.com',
    roleId: 'role-doc',
    role: 'DOCTOR',
    hospitalId: 'hosp-1',
  };

  const mockRequest = {
    user: doctorUser,
  } as unknown as Request;

  beforeEach(async () => {
    service = {
      createLabOrder: jest.fn(),
      getLabOrders: jest.fn(),
      getLabOrderById: jest.fn(),
      getLabOrdersByMedicalRecordId: jest.fn(),
      updateLabOrder: jest.fn(),
      updateLabOrderStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LabOrderController],
      providers: [{ provide: LabOrderService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<LabOrderController>(LabOrderController);
  });

  it('createLabOrder delegates to service', async () => {
    const mockCreated = { id: 'order-1' };
    service.createLabOrder.mockResolvedValue(mockCreated);

    const result = await controller.createLabOrder(mockRequest, {
      medicalRecordId: 'rec-1',
      labTestId: 'test-1',
    });

    expect(service.createLabOrder).toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      message: 'Lab order created successfully',
      data: mockCreated,
    });
  });

  it('getLabOrders delegates to service', async () => {
    service.getLabOrders.mockResolvedValue([{ id: 'order-1' }]);

    const result = await controller.getLabOrders(mockRequest, {});

    expect(service.getLabOrders).toHaveBeenCalledWith({}, doctorUser);
    expect(result.data).toHaveLength(1);
  });

  it('getLabOrderById delegates to service', async () => {
    service.getLabOrderById.mockResolvedValue({ id: 'order-1' });

    const result = await controller.getLabOrderById('order-1', mockRequest);

    expect(service.getLabOrderById).toHaveBeenCalledWith('order-1', doctorUser);
    expect(result.data.id).toBe('order-1');
  });

  it('updateLabOrderStatus delegates to service', async () => {
    service.updateLabOrderStatus.mockResolvedValue({ id: 'order-1', status: 'IN_PROGRESS' });

    const result = await controller.updateLabOrderStatus(
      'order-1',
      mockRequest,
      { status: 'IN_PROGRESS' },
    );

    expect(service.updateLabOrderStatus).toHaveBeenCalled();
    expect(result.data.status).toBe('IN_PROGRESS');
  });
});
