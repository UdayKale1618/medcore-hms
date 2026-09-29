import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

describe('Notification Module Integration Tests', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let notificationService: {
    getUserNotifications: jest.Mock;
    getUnreadCount: jest.Mock;
    markAsRead: jest.Mock;
    markAllAsRead: jest.Mock;
  };

  const JWT_SECRET = 'test-jwt-secret-key-12345678901234567890';
  process.env.JWT_ACCESS_SECRET = JWT_SECRET;

  beforeAll(async () => {
    notificationService = {
      getUserNotifications: jest.fn(),
      getUnreadCount: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        { provide: NotificationService, useValue: notificationService },
        { provide: PrismaService, useValue: {} },
        JwtService,
        JwtAuthGuard,
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    jwtService = module.get<JwtService>(JwtService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  function createToken(userId = 'u-user-1') {
    return jwtService.sign(
      {
        userId,
        email: 'user1@apollo.com',
        roleId: 'role-pat',
        role: 'PATIENT',
        hospitalId: 'hosp-1',
      },
      { secret: JWT_SECRET },
    );
  }

  it('GET /notifications returns authenticated user notifications', async () => {
    notificationService.getUserNotifications.mockResolvedValue([
      { id: 'notif-1', title: 'Welcome', isRead: false },
    ]);

    const token = createToken();
    const res = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Welcome');
  });

  it('GET /notifications/unread-count returns unread count', async () => {
    notificationService.getUnreadCount.mockResolvedValue({ unreadCount: 3 });

    const token = createToken();
    const res = await request(app.getHttpServer())
      .get('/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.unreadCount).toBe(3);
  });

  it('PATCH /notifications/:id/read marks notification as read', async () => {
    notificationService.markAsRead.mockResolvedValue({ id: 'n-1', isRead: true });

    const token = createToken();
    const res = await request(app.getHttpServer())
      .patch('/notifications/n-1/read')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.isRead).toBe(true);
  });
});
