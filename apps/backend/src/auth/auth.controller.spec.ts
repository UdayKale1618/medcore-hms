import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { Request, Response } from 'express';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    login: jest.Mock;
    refresh: jest.Mock;
    logout: jest.Mock;
  };

  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    delete process.env.NODE_ENV;
    delete process.env.COOKIE_SAME_SITE;
    delete process.env.COOKIE_SECURE;

    authService = {
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
      getPublicHospitals: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
        {
          provide: JwtService,
          useValue: { verify: jest.fn() },
        },
        JwtAuthGuard,
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /auth/hospitals (Public Hospital Discovery)', () => {
    it('delegates to authService.getPublicHospitals and returns active hospitals with address', async () => {
      const mockHospitals = [
        {
          id: 'hosp-1',
          name: 'MedCore Central Hospital',
          email: 'demo@medcore.com',
          phone: '+91 9876543210',
          addresses: [{ city: 'Bengaluru', state: 'Karnataka' }],
        },
        {
          id: 'hosp-2',
          name: 'Apollo Specialty Hospital',
          email: 'admin@apollo.com',
          phone: '+91 80 2630 4050',
          addresses: [{ city: 'Bengaluru', state: 'Karnataka' }],
        },
      ];

      authService.getPublicHospitals.mockResolvedValue(mockHospitals);

      const result = await controller.getPublicHospitals();

      expect(authService.getPublicHospitals).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockHospitals);
      expect(result[0]).toHaveProperty('id', 'hosp-1');
      expect(result[0].addresses[0]).toHaveProperty('city', 'Bengaluru');
    });
  });

  describe('Cookie Configuration & Lifecycle', () => {
    it('sets refreshToken cookie with httpOnly, lax and secure=false in development', async () => {
      process.env.NODE_ENV = 'development';
      const mockResponse = {
        cookie: jest.fn(),
      } as unknown as Response;

      authService.login.mockResolvedValue({
        message: 'Login successful',
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        user: { id: 'user-1', email: 'test@hospital.com' },
      });

      const result = await controller.login(
        { email: 'test@hospital.com', password: 'Password123!' },
        mockResponse,
      );

      expect(result.accessToken).toBe('access-token-123');
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'refresh-token-123',
        {
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        },
      );
    });

    it('sets cross-site cookie with sameSite=none and secure=true in production', async () => {
      process.env.NODE_ENV = 'production';
      const mockResponse = {
        cookie: jest.fn(),
      } as unknown as Response;

      authService.login.mockResolvedValue({
        message: 'Login successful',
        accessToken: 'access-token-456',
        refreshToken: 'refresh-token-456',
        user: { id: 'user-2', email: 'prod@hospital.com' },
      });

      await controller.login(
        { email: 'prod@hospital.com', password: 'Password123!' },
        mockResponse,
      );

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'refresh-token-456',
        {
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        },
      );
    });

    it('respects COOKIE_SAME_SITE environment variable override when provided', async () => {
      process.env.NODE_ENV = 'production';
      process.env.COOKIE_SAME_SITE = 'strict';
      const mockResponse = {
        cookie: jest.fn(),
      } as unknown as Response;

      authService.login.mockResolvedValue({
        message: 'Login successful',
        accessToken: 'access-token-789',
        refreshToken: 'refresh-token-789',
        user: { id: 'user-3', email: 'strict@hospital.com' },
      });

      await controller.login(
        { email: 'strict@hospital.com', password: 'Password123!' },
        mockResponse,
      );

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'refresh-token-789',
        {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        },
      );
    });

    it('reads refreshToken from cookies and updates cookie during token refresh', async () => {
      const mockRequest = {
        cookies: { refreshToken: 'existing-refresh-token' },
      } as unknown as Request;

      const mockResponse = {
        cookie: jest.fn(),
      } as unknown as Response;

      authService.refresh.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });

      const result = await controller.refresh(mockRequest, mockResponse);

      expect(authService.refresh).toHaveBeenCalledWith('existing-refresh-token');
      expect(result.accessToken).toBe('new-access-token');
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'new-refresh-token',
        expect.objectContaining({
          httpOnly: true,
          maxAge: 7 * 24 * 60 * 60 * 1000,
        }),
      );
    });

    it('clears refreshToken cookie with matching options upon logout', async () => {
      process.env.NODE_ENV = 'production';
      const mockRequest = {
        user: { userId: 'user-1' },
      } as unknown as Request;

      const mockResponse = {
        clearCookie: jest.fn(),
      } as unknown as Response;

      authService.logout.mockResolvedValue(undefined);

      const result = await controller.logout(mockRequest, mockResponse);

      expect(authService.logout).toHaveBeenCalledWith('user-1');
      expect(result.message).toBe('Logout successful');
      expect(mockResponse.clearCookie).toHaveBeenCalledWith(
        'refreshToken',
        {
          httpOnly: true,
          secure: true,
          sameSite: 'none',
        },
      );
    });
  });
});
