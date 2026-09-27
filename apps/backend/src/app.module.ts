import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { RedisModule } from './redis/redis.module';
import { HospitalModule } from './hospital/hospital.module';
import { DepartmentModule } from './department/department.module';
import { DoctorModule } from './doctor/doctor.module';
import { AvailabilityModule } from './availability/availability.module';
import { PatientModule } from './patient/patient.module';
import { AppointmentModule } from './appointment/appointment.module';
import { MedicalRecordModule } from './medical-record/medical-record.module';
import { MedicineModule } from './medicine/medicine.module';
import { PrescriptionModule } from './prescription/prescription.module';
import { LabModule } from './lab/lab.module';
import { InvoiceModule } from './invoice/invoice.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    AuthModule,
    HospitalModule,
    DepartmentModule,
    DoctorModule,
    AvailabilityModule,
    PatientModule,
    AppointmentModule,
    MedicalRecordModule,
    MedicineModule,
    PrescriptionModule,
    LabModule,
    InvoiceModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}