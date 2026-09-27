import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthUser } from '../auth/auth-user.interface';
import type { Request } from 'express';

describe('InvoiceController', () => {
  let controller: InvoiceController;
  let service: {
    createInvoice: jest.Mock;
    getInvoices: jest.Mock;
    getInvoiceById: jest.Mock;
    getInvoicesByPatientId: jest.Mock;
    getInvoiceByAppointmentId: jest.Mock;
    updateInvoice: jest.Mock;
    updateInvoiceStatus: jest.Mock;
  };

  const accountantUser: AuthUser = {
    userId: 'user-acc-1',
    email: 'acc@apollo.com',
    roleId: 'role-acc',
    role: 'ACCOUNTANT',
    hospitalId: 'hosp-1',
  };

  const mockRequest = {
    user: accountantUser,
  } as unknown as Request;

  beforeEach(async () => {
    service = {
      createInvoice: jest.fn(),
      getInvoices: jest.fn(),
      getInvoiceById: jest.fn(),
      getInvoicesByPatientId: jest.fn(),
      getInvoiceByAppointmentId: jest.fn(),
      updateInvoice: jest.fn(),
      updateInvoiceStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvoiceController],
      providers: [{ provide: InvoiceService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<InvoiceController>(InvoiceController);
  });

  it('createInvoice delegates to service', async () => {
    const mockCreated = { id: 'inv-1', total: 200 };
    service.createInvoice.mockResolvedValue(mockCreated);

    const result = await controller.createInvoice(mockRequest, {
      patientId: 'pat-1',
      items: [
        {
          description: 'Consultation',
          category: 'CONSULTATION',
          quantity: 1,
          unitPrice: 200,
        },
      ],
    });

    expect(service.createInvoice).toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      message: 'Invoice created successfully',
      data: mockCreated,
    });
  });

  it('getInvoices delegates to service', async () => {
    service.getInvoices.mockResolvedValue([{ id: 'inv-1' }]);

    const result = await controller.getInvoices(mockRequest, {});

    expect(service.getInvoices).toHaveBeenCalledWith({}, accountantUser);
    expect(result.data).toHaveLength(1);
  });

  it('getInvoiceById delegates to service', async () => {
    service.getInvoiceById.mockResolvedValue({ id: 'inv-1' });

    const result = await controller.getInvoiceById('inv-1', mockRequest);

    expect(service.getInvoiceById).toHaveBeenCalledWith('inv-1', accountantUser);
    expect(result.data.id).toBe('inv-1');
  });

  it('updateInvoiceStatus delegates to service', async () => {
    service.updateInvoiceStatus.mockResolvedValue({ id: 'inv-1', status: 'PAID' });

    const result = await controller.updateInvoiceStatus(
      'inv-1',
      mockRequest,
      { status: 'PAID' },
    );

    expect(service.updateInvoiceStatus).toHaveBeenCalled();
    expect(result.data.status).toBe('PAID');
  });
});
