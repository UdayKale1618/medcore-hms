import { Test, TestingModule } from '@nestjs/testing';
import { HospitalService } from './hospital.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('HospitalService', () => {
  let service: HospitalService;
  let prisma: {
    hospital: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    address: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  const mockHospital = {
    id: 'hosp-123',
    name: 'General Hospital',
    email: 'admin@generalhospital.com',
    phone: '+91 9876543210',
    createdAt: new Date(),
    updatedAt: new Date(),
    addresses: [],
    _count: {
      departments: 5,
      rooms: 20,
      patients: 100,
      users: 50,
    },
  };

  beforeEach(async () => {
    prisma = {
      hospital: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      address: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HospitalService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<HospitalService>(HospitalService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHospitalById', () => {
    it('should return hospital when found', async () => {
      prisma.hospital.findUnique.mockResolvedValue(mockHospital);

      const result = await service.getHospitalById('hosp-123');
      expect(result).toEqual(mockHospital);
      expect(prisma.hospital.findUnique).toHaveBeenCalledWith({
        where: { id: 'hosp-123' },
        include: {
          addresses: true,
          _count: {
            select: {
              departments: true,
              rooms: true,
              patients: true,
              users: true,
            },
          },
        },
      });
    });

    it('should throw NotFoundException when hospital does not exist', async () => {
      prisma.hospital.findUnique.mockResolvedValue(null);

      await expect(service.getHospitalById('unknown-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateHospital', () => {
    it('should update hospital scalar fields and return updated hospital', async () => {
      prisma.hospital.findUnique
        .mockResolvedValueOnce(mockHospital) // existing check
        .mockResolvedValueOnce({
          ...mockHospital,
          name: 'Updated General Hospital',
        }); // getHospitalById
      prisma.hospital.update.mockResolvedValue({
        ...mockHospital,
        name: 'Updated General Hospital',
      });

      const result = await service.updateHospital('hosp-123', {
        name: 'Updated General Hospital',
      });

      expect(prisma.hospital.update).toHaveBeenCalledWith({
        where: { id: 'hosp-123' },
        data: { name: 'Updated General Hospital' },
      });
      expect(result.name).toBe('Updated General Hospital');
    });

    it('should throw ConflictException if new email is taken by another hospital', async () => {
      prisma.hospital.findUnique.mockResolvedValue(mockHospital);
      prisma.hospital.findFirst.mockResolvedValue({
        id: 'hosp-456',
        email: 'other@hospital.com',
      });

      await expect(
        service.updateHospital('hosp-123', {
          email: 'other@hospital.com',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should update existing address if address fields are provided', async () => {
      const existingAddress = {
        id: 'addr-1',
        hospitalId: 'hosp-123',
        addressLine1: 'Old Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001',
        country: 'India',
      };

      prisma.hospital.findUnique
        .mockResolvedValueOnce(mockHospital)
        .mockResolvedValueOnce(mockHospital);
      prisma.address.findFirst.mockResolvedValue(existingAddress);
      prisma.address.update.mockResolvedValue({
        ...existingAddress,
        city: 'Pune',
      });

      await service.updateHospital('hosp-123', { city: 'Pune' });

      expect(prisma.address.update).toHaveBeenCalledWith({
        where: { id: 'addr-1' },
        data: expect.objectContaining({ city: 'Pune' }),
      });
    });

    it('should create address if address fields are provided but no address exists yet', async () => {
      prisma.hospital.findUnique
        .mockResolvedValueOnce(mockHospital)
        .mockResolvedValueOnce(mockHospital);
      prisma.address.findFirst.mockResolvedValue(null);
      prisma.address.create.mockResolvedValue({
        id: 'addr-new',
        hospitalId: 'hosp-123',
        addressLine1: 'New Street',
        city: 'Pune',
        state: 'MH',
        postalCode: '411001',
        country: 'India',
      });

      await service.updateHospital('hosp-123', {
        addressLine1: 'New Street',
        city: 'Pune',
        state: 'MH',
        postalCode: '411001',
      });

      expect(prisma.address.create).toHaveBeenCalledWith({
        data: {
          hospitalId: 'hosp-123',
          addressLine1: 'New Street',
          addressLine2: undefined,
          city: 'Pune',
          state: 'MH',
          postalCode: '411001',
          country: 'India',
        },
      });
    });

    it('should throw NotFoundException if hospital to update is not found', async () => {
      prisma.hospital.findUnique.mockResolvedValue(null);

      await expect(
        service.updateHospital('nonexistent', { name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAllHospitals', () => {
    it('should return all hospitals', async () => {
      prisma.hospital.findMany.mockResolvedValue([mockHospital]);

      const result = await service.getAllHospitals();
      expect(result).toEqual([mockHospital]);
      expect(prisma.hospital.findMany).toHaveBeenCalled();
    });
  });

  describe('createHospital', () => {
    it('should create and return a new hospital without address', async () => {
      prisma.hospital.findUnique.mockResolvedValue(null);
      prisma.hospital.create.mockResolvedValue(mockHospital);

      const result = await service.createHospital({
        name: 'General Hospital',
        email: 'admin@generalhospital.com',
        phone: '+91 9876543210',
      });

      expect(result).toEqual(mockHospital);
      expect(prisma.hospital.create).toHaveBeenCalled();
    });

    it('should create hospital with nested address when address fields are provided', async () => {
      prisma.hospital.findUnique.mockResolvedValue(null);
      prisma.hospital.create.mockResolvedValue(mockHospital);

      await service.createHospital({
        name: 'General Hospital',
        email: 'admin@generalhospital.com',
        phone: '+91 9876543210',
        addressLine1: '123 Main St',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001',
      });

      expect(prisma.hospital.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            addresses: {
              create: {
                addressLine1: '123 Main St',
                addressLine2: undefined,
                city: 'Mumbai',
                state: 'Maharashtra',
                postalCode: '400001',
                country: 'India',
              },
            },
          }),
        }),
      );
    });

    it('should throw ConflictException if hospital email already exists', async () => {
      prisma.hospital.findUnique.mockResolvedValue(mockHospital);

      await expect(
        service.createHospital({
          name: 'Duplicate Hospital',
          email: 'admin@generalhospital.com',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
