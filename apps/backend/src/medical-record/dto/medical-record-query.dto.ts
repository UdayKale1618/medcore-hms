import { IsOptional, IsString, IsUUID } from 'class-validator';

export class MedicalRecordQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'patientId must be a valid UUID' })
  patientId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'doctorId must be a valid UUID' })
  doctorId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'appointmentId must be a valid UUID' })
  appointmentId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID('4', { message: 'hospitalId must be a valid UUID' })
  hospitalId?: string;
}
