import { Module } from '@nestjs/common';
import { LabTestService } from './lab-test.service';
import { LabTestController } from './lab-test.controller';
import { LabOrderService } from './lab-order.service';
import { LabOrderController } from './lab-order.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [LabTestController, LabOrderController],
  providers: [LabTestService, LabOrderService],
  exports: [LabTestService, LabOrderService],
})
export class LabModule {}
