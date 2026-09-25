import { IsOptional, IsUUID } from 'class-validator';

export class PrescriptionQueryDto {
  @IsOptional()
  @IsUUID()
  medicalRecordId?: string;

  @IsOptional()
  @IsUUID()
  patientId?: string;

  @IsOptional()
  @IsUUID()
  doctorId?: string;

  @IsOptional()
  @IsUUID()
  hospitalId?: string;
}
