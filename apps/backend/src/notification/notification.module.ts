import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationGateway } from './notification.gateway';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret:
        process.env.JWT_ACCESS_SECRET ||
        'test-jwt-secret-key-12345678901234567890',
    }),
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationGateway,
    EmailService,
    SmsService,
  ],
  exports: [
    NotificationService,
    EmailService,
    SmsService,
    NotificationGateway,
  ],
})
export class NotificationModule {}
