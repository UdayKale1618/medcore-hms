import { Test, TestingModule } from '@nestjs/testing';
import { MedicineController } from './medicine.controller';
import { MedicineService } from './medicine.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthUser } from '../auth/auth-user.interface';
import type { Request } from 'express';

describe('MedicineController', () => {
  let controller: MedicineController;
  let service: {
    createMedicine: jest.Mock;
    getMedicines: jest.Mock;
    getMedicineById: jest.Mock;
    updateMedicine: jest.Mock;
    createBatch: jest.Mock;
    getBatches: jest.Mock;
  };

  const pharmacistUser: AuthUser = {
    userId: 'user-pharm-1',
    email: 'pharm@apollo.com',
    roleId: 'role-pharm',
    role: 'PHARMACIST',
    hospitalId: 'hosp-1',
  };

  const mockRequest = {
    user: pharmacistUser,
  } as unknown as Request;

  beforeEach(async () => {
    service = {
      createMedicine: jest.fn(),
      getMedicines: jest.fn(),
      getMedicineById: jest.fn(),
      updateMedicine: jest.fn(),
      createBatch: jest.fn(),
      getBatches: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MedicineController],
      providers: [{ provide: MedicineService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<MedicineController>(MedicineController);
  });

  it('createMedicine delegates to service and returns wrapped response', async () => {
    const mockCreated = { id: 'med-1', name: 'Paracetamol' };
    service.createMedicine.mockResolvedValue(mockCreated);

    const result = await controller.createMedicine(mockRequest, {
      name: 'Paracetamol',
      form: 'TABLET',
    });

    expect(service.createMedicine).toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      message: 'Medicine created successfully',
      data: mockCreated,
    });
  });

  it('getMedicines delegates to service and returns wrapped list', async () => {
    service.getMedicines.mockResolvedValue([{ id: 'med-1' }]);

    const result = await controller.getMedicines(mockRequest, {});

    expect(service.getMedicines).toHaveBeenCalledWith({}, pharmacistUser);
    expect(result.data).toHaveLength(1);
  });

  it('getMedicineById delegates to service and returns medicine', async () => {
    service.getMedicineById.mockResolvedValue({ id: 'med-1' });

    const result = await controller.getMedicineById('med-1', mockRequest);

    expect(service.getMedicineById).toHaveBeenCalledWith('med-1', pharmacistUser);
    expect(result.data.id).toBe('med-1');
  });

  it('updateMedicine delegates to service', async () => {
    service.updateMedicine.mockResolvedValue({ id: 'med-1', description: 'Updated' });

    const result = await controller.updateMedicine(
      'med-1',
      mockRequest,
      { description: 'Updated' },
    );

    expect(service.updateMedicine).toHaveBeenCalled();
    expect(result.data.description).toBe('Updated');
  });

  it('createBatch delegates to service', async () => {
    service.createBatch.mockResolvedValue({ id: 'batch-1' });

    const result = await controller.createBatch(
      'med-1',
      mockRequest,
      {
        batchNumber: 'B1',
        expiryDate: '2026-12-31T00:00:00.000Z',
        quantity: 100,
        unitCost: 1,
        mrp: 2,
      },
    );

    expect(service.createBatch).toHaveBeenCalled();
    expect(result.data.id).toBe('batch-1');
  });

  it('getBatches delegates to service', async () => {
    service.getBatches.mockResolvedValue([{ id: 'batch-1' }]);

    const result = await controller.getBatches('med-1', mockRequest);

    expect(service.getBatches).toHaveBeenCalledWith('med-1', pharmacistUser);
    expect(result.data).toHaveLength(1);
  });
});
