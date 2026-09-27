import { IsOptional, IsString, IsUUID } from 'class-validator';

export class LabOrderQueryDto {
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
  labTestId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID()
  hospitalId?: string;
}
