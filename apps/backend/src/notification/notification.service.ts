import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationGateway } from './notification.gateway';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import { NotificationQueryDto } from './dto/notification-query.dto';
import type { AuthUser } from '../auth/auth-user.interface';

export interface CreateNotificationParams {
  userId: string;
  hospitalId?: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  email?: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  };
  sms?: {
    to: string;
    message: string;
  };
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationGateway,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
  ) {}

  // =========================================================
  // 1. DISPATCH NOTIFICATION (Persistence + Socket + Email + SMS)
  // =========================================================
  async dispatch(params: CreateNotificationParams) {
    try {
      // 1. Database persistence
      const notification = await this.prisma.notification.create({
        data: {
          userId: params.userId,
          type: params.type,
          title: params.title,
          message: params.message,
          entityType: params.entityType || null,
          entityId: params.entityId || null,
          isRead: false,
        },
      });

      // 2. Real-time in-app delivery via Socket.IO
      try {
        this.gateway.emitToUser(params.userId, 'notification', notification);
        this.gateway.emitToUser(params.userId, params.type, {
          id: notification.id,
          title: params.title,
          message: params.message,
          entityType: params.entityType,
          entityId: params.entityId,
          createdAt: notification.createdAt,
        });

        if (params.hospitalId) {
          this.gateway.emitToHospital(params.hospitalId, `hospital.${params.type}`, {
            notificationId: notification.id,
            userId: params.userId,
            title: params.title,
            entityType: params.entityType,
            entityId: params.entityId,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to emit socket notification: ${message}`);
      }

      // 3. Email delivery (non-blocking)
      if (params.email) {
        this.emailService
          .sendEmail(params.email)
          .catch((err) =>
            this.logger.warn(`Async email dispatch failed: ${err.message}`),
          );
      }

      // 4. SMS delivery (non-blocking)
      if (params.sms) {
        this.smsService
          .sendSms(params.sms)
          .catch((err) =>
            this.logger.warn(`Async SMS dispatch failed: ${err.message}`),
          );
      }

      return notification;
    } catch (err) {
      // Safe error logging: notification failures must never break calling operations
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Notification persistence failed: ${message}`);
      return null;
    }
  }

  // =========================================================
  // 2. RETRIEVE USER NOTIFICATIONS
  // =========================================================
  async getUserNotifications(
    query: NotificationQueryDto,
    caller: AuthUser,
  ) {
    const where: Prisma.NotificationWhereInput = {
      userId: caller.userId,
    };

    if (query.isRead !== undefined) {
      where.isRead = query.isRead;
    }

    if (query.type) {
      where.type = query.type;
    }

    return this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // =========================================================
  // 3. MARK NOTIFICATION AS READ
  // =========================================================
  async markAsRead(id: string, caller: AuthUser) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (caller.role !== 'SUPER_ADMIN' && notification.userId !== caller.userId) {
      throw new ForbiddenException(
        'Access denied: You can only update your own notifications',
      );
    }

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  // =========================================================
  // 4. MARK ALL USER NOTIFICATIONS AS READ
  // =========================================================
  async markAllAsRead(caller: AuthUser) {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId: caller.userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return {
      message: 'All notifications marked as read',
      count: result.count,
    };
  }

  // =========================================================
  // 5. UNREAD COUNT
  // =========================================================
  async getUnreadCount(caller: AuthUser) {
    const count = await this.prisma.notification.count({
      where: {
        userId: caller.userId,
        isRead: false,
      },
    });

    return { unreadCount: count };
  }
}
