import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationGateway } from './notification.gateway';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import type { AuthUser } from '../auth/auth-user.interface';

describe('NotificationService', () => {
  let service: NotificationService;
  let prisma: any;
  let gateway: any;
  let emailService: any;
  let smsService: any;

  const userCaller: AuthUser = {
    userId: 'u-user-1',
    email: 'user1@apollo.com',
    roleId: 'role-pat',
    role: 'PATIENT',
    hospitalId: 'hosp-1',
  };

  const otherUserCaller: AuthUser = {
    userId: 'u-user-2',
    email: 'user2@apollo.com',
    roleId: 'role-pat',
    role: 'PATIENT',
    hospitalId: 'hosp-1',
  };

  beforeEach(async () => {
    prisma = {
      notification: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
    };

    gateway = {
      emitToUser: jest.fn(),
      emitToHospital: jest.fn(),
    };

    emailService = {
      sendEmail: jest.fn().mockResolvedValue({ success: true }),
    };

    smsService = {
      sendSms: jest.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationGateway, useValue: gateway },
        { provide: EmailService, useValue: emailService },
        { provide: SmsService, useValue: smsService },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  describe('dispatch', () => {
    it('persists notification, emits real-time event, and calls email/SMS services', async () => {
      prisma.notification.create.mockResolvedValue({
        id: 'notif-1',
        userId: 'u-user-1',
        type: 'appointment.confirmed',
        title: 'Appointment Confirmed',
        message: 'Your appointment is confirmed',
        createdAt: new Date(),
      });

      const res = await service.dispatch({
        userId: 'u-user-1',
        hospitalId: 'hosp-1',
        type: 'appointment.confirmed',
        title: 'Appointment Confirmed',
        message: 'Your appointment is confirmed',
        email: {
          to: 'patient@example.com',
          subject: 'Appointment Confirmed',
          html: '<p>Confirmed</p>',
        },
        sms: {
          to: '+919876543210',
          message: 'Appointment confirmed',
        },
      });

      expect(res).toBeDefined();
      expect(prisma.notification.create).toHaveBeenCalled();
      expect(gateway.emitToUser).toHaveBeenCalledWith('u-user-1', 'notification', expect.any(Object));
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'patient@example.com' }),
      );
      expect(smsService.sendSms).toHaveBeenCalledWith(
        expect.objectContaining({ to: '+919876543210' }),
      );
    });

    it('does not throw when notification delivery fails (non-blocking safety)', async () => {
      prisma.notification.create.mockRejectedValue(new Error('DB failure'));

      const res = await service.dispatch({
        userId: 'u-user-1',
        type: 'test.event',
        title: 'Test',
        message: 'Test message',
      });

      expect(res).toBeNull(); // Gracefully handles error without throwing
    });
  });

  describe('getUserNotifications', () => {
    it('retrieves notifications filtered by authenticated caller userId', async () => {
      prisma.notification.findMany.mockResolvedValue([
        { id: 'n-1', userId: 'u-user-1', title: 'Test 1' },
      ]);

      const res = await service.getUserNotifications({}, userCaller);
      expect(res).toHaveLength(1);
      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'u-user-1' }),
        }),
      );
    });
  });

  describe('markAsRead', () => {
    it('marks notification read for owner', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 'n-1',
        userId: 'u-user-1',
        isRead: false,
      });
      prisma.notification.update.mockResolvedValue({
        id: 'n-1',
        isRead: true,
      });

      const res = await service.markAsRead('n-1', userCaller);
      expect(res.isRead).toBe(true);
    });

    it('prevents another user from marking notification as read', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 'n-1',
        userId: 'u-user-1',
        isRead: false,
      });

      await expect(
        service.markAsRead('n-1', otherUserCaller),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
