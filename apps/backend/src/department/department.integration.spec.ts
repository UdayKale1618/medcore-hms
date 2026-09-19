import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { DepartmentController } from './department.controller';
import { DepartmentService } from './department.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

describe('DepartmentModule Integration & RBAC Tests', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let departmentService: {
    createDepartment: jest.Mock;
    getDepartments: jest.Mock;
    getDepartmentById: jest.Mock;
    updateDepartment: jest.Mock;
    deleteDepartment: jest.Mock;
  };

  const JWT_SECRET = 'test-jwt-secret-key-12345678901234567890';
  process.env.JWT_ACCESS_SECRET = JWT_SECRET;

  const mockDepartment = {
    id: 'dept-10',
    name: 'Orthopedics',
    hospitalId: 'hosp-100',
    createdAt: new Date(),
    updatedAt: new Date(),
    hospital: {
      id: 'hosp-100',
      name: 'Apollo Hospital',
    },
    _count: {
      doctors: 2,
      appointments: 5,
    },
  };

  beforeAll(async () => {
    departmentService = {
      createDepartment: jest.fn(),
      getDepartments: jest.fn(),
      getDepartmentById: jest.fn(),
      updateDepartment: jest.fn(),
      deleteDepartment: jest.fn(),
    };

    jwtService = new JwtService({ secret: JWT_SECRET });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [DepartmentController],
      providers: [
        {
          provide: DepartmentService,
          useValue: departmentService,
        },
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
        JwtAuthGuard,
        RolesGuard,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const generateToken = (user: {
    sub: string;
    email: string;
    role: string;
    hospitalId?: string | null;
  }) => {
    return jwtService.sign({
      sub: user.sub,
      email: user.email,
      role: user.role,
      roleId: 'role-1',
      hospitalId: user.hospitalId !== undefined ? user.hospitalId : 'hosp-100',
    });
  };

  // =========================================================
  // POST /departments
  // =========================================================
  describe('POST /departments', () => {
    it('should allow HOSPITAL_ADMIN to create department for their hospital', async () => {
      departmentService.createDepartment.mockResolvedValue(mockDepartment);

      const token = generateToken({
        sub: 'admin-1',
        email: 'admin@apollo.com',
        role: 'HOSPITAL_ADMIN',
        hospitalId: 'hosp-100',
      });

      const res = await request(app.getHttpServer())
        .post('/departments')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Orthopedics' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Orthopedics');
      expect(departmentService.createDepartment).toHaveBeenCalledWith(
        'hosp-100',
        { name: 'Orthopedics' },
      );
    });

    it('should reject PATIENT role with 403 Forbidden', async () => {
      const token = generateToken({
        sub: 'pat-1',
        email: 'patient@apollo.com',
        role: 'PATIENT',
        hospitalId: 'hosp-100',
      });

      const res = await request(app.getHttpServer())
        .post('/departments')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Radiology' });

      expect(res.status).toBe(403);
    });

    it('should reject when name is missing (400 Bad Request)', async () => {
      const token = generateToken({
        sub: 'admin-1',
        email: 'admin@apollo.com',
        role: 'HOSPITAL_ADMIN',
        hospitalId: 'hosp-100',
      });

      const res = await request(app.getHttpServer())
        .post('/departments')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 409 Conflict when duplicate department in same hospital', async () => {
      departmentService.createDepartment.mockRejectedValue(
        new ConflictException(
          'Department with this name already exists in this hospital',
        ),
      );

      const token = generateToken({
        sub: 'admin-1',
        email: 'admin@apollo.com',
        role: 'HOSPITAL_ADMIN',
        hospitalId: 'hosp-100',
      });

      const res = await request(app.getHttpServer())
        .post('/departments')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Orthopedics' });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('already exists');
    });
  });

  // =========================================================
  // GET /departments
  // =========================================================
  describe('GET /departments', () => {
    it('should return departments isolated to user hospital', async () => {
      departmentService.getDepartments.mockResolvedValue([mockDepartment]);

      const token = generateToken({
        sub: 'doc-1',
        email: 'doc@apollo.com',
        role: 'DOCTOR',
        hospitalId: 'hosp-100',
      });

      const res = await request(app.getHttpServer())
        .get('/departments')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(departmentService.getDepartments).toHaveBeenCalledWith('hosp-100');
    });
  });

  // =========================================================
  // GET /departments/:id
  // =========================================================
  describe('GET /departments/:id', () => {
    it('should return department by id', async () => {
      departmentService.getDepartmentById.mockResolvedValue(mockDepartment);

      const token = generateToken({
        sub: 'doc-1',
        email: 'doc@apollo.com',
        role: 'DOCTOR',
        hospitalId: 'hosp-100',
      });

      const res = await request(app.getHttpServer())
        .get('/departments/dept-10')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('dept-10');
    });

    it('should return 403 when user belongs to another hospital (Tenant Isolation)', async () => {
      departmentService.getDepartmentById.mockRejectedValue(
        new ForbiddenException(
          'Access denied: You do not have permission to view departments from another hospital',
        ),
      );

      const token = generateToken({
        sub: 'doc-other',
        email: 'doc@other.com',
        role: 'DOCTOR',
        hospitalId: 'hosp-200',
      });

      const res = await request(app.getHttpServer())
        .get('/departments/dept-10')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('should return 404 when department not found', async () => {
      departmentService.getDepartmentById.mockRejectedValue(
        new NotFoundException('Department not found'),
      );

      const token = generateToken({
        sub: 'admin-1',
        email: 'admin@apollo.com',
        role: 'HOSPITAL_ADMIN',
        hospitalId: 'hosp-100',
      });

      const res = await request(app.getHttpServer())
        .get('/departments/dept-non-existent')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  // =========================================================
  // PATCH /departments/:id
  // =========================================================
  describe('PATCH /departments/:id', () => {
    it('should allow HOSPITAL_ADMIN to update department', async () => {
      departmentService.updateDepartment.mockResolvedValue({
        ...mockDepartment,
        name: 'Pediatrics',
      });

      const token = generateToken({
        sub: 'admin-1',
        email: 'admin@apollo.com',
        role: 'HOSPITAL_ADMIN',
        hospitalId: 'hosp-100',
      });

      const res = await request(app.getHttpServer())
        .patch('/departments/dept-10')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Pediatrics' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Pediatrics');
    });

    it('should reject non-admin roles (e.g. NURSE) with 403 Forbidden', async () => {
      const token = generateToken({
        sub: 'nurse-1',
        email: 'nurse@apollo.com',
        role: 'NURSE',
        hospitalId: 'hosp-100',
      });

      const res = await request(app.getHttpServer())
        .patch('/departments/dept-10')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Name' });

      expect(res.status).toBe(403);
    });
  });

  // =========================================================
  // DELETE /departments/:id
  // =========================================================
  describe('DELETE /departments/:id', () => {
    it('should allow HOSPITAL_ADMIN to delete department when safe', async () => {
      departmentService.deleteDepartment.mockResolvedValue({
        message: 'Department deleted successfully',
      });

      const token = generateToken({
        sub: 'admin-1',
        email: 'admin@apollo.com',
        role: 'HOSPITAL_ADMIN',
        hospitalId: 'hosp-100',
      });

      const res = await request(app.getHttpServer())
        .delete('/departments/dept-10')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Department deleted successfully');
    });

    it('should return 400 when department has active doctors', async () => {
      departmentService.deleteDepartment.mockRejectedValue(
        new BadRequestException(
          'Cannot delete department because active doctors are assigned to it',
        ),
      );

      const token = generateToken({
        sub: 'admin-1',
        email: 'admin@apollo.com',
        role: 'HOSPITAL_ADMIN',
        hospitalId: 'hosp-100',
      });

      const res = await request(app.getHttpServer())
        .delete('/departments/dept-10')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('active doctors');
    });
  });
});
