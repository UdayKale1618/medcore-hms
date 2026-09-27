import { IsOptional, IsString, IsUUID } from 'class-validator';

export class InvoiceQueryDto {
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID()
  hospitalId?: string;
}
