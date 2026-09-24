import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MedicalRecordController } from './medical-record.controller';
import { MedicalRecordService } from './medical-record.service';

@Module({
  imports: [AuthModule],
  controllers: [MedicalRecordController],
  providers: [MedicalRecordService],
  exports: [MedicalRecordService],
})
export class MedicalRecordModule {}
