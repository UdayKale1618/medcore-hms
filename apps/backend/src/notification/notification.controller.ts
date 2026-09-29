import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/auth-user.interface';
import { NotificationQueryDto } from './dto/notification-query.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async getUserNotifications(
    @Req() request: Request,
    @Query() query: NotificationQueryDto,
  ) {
    const caller = request.user as AuthUser;
    return this.notificationService.getUserNotifications(query, caller);
  }

  @Get('unread-count')
  async getUnreadCount(@Req() request: Request) {
    const caller = request.user as AuthUser;
    return this.notificationService.getUnreadCount(caller);
  }

  @Patch('read-all')
  async markAllAsRead(@Req() request: Request) {
    const caller = request.user as AuthUser;
    return this.notificationService.markAllAsRead(caller);
  }

  @Patch(':id/read')
  async markAsRead(
    @Req() request: Request,
    @Param('id') id: string,
  ) {
    const caller = request.user as AuthUser;
    return this.notificationService.markAsRead(id, caller);
  }
}
