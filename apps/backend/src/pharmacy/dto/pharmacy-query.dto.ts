import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class PharmacyInventoryQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  form?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  lowStock?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsUUID('4', { message: 'hospitalId must be a valid UUID' })
  hospitalId?: string;
}

export class PharmacyBatchQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'medicineId must be a valid UUID' })
  medicineId?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  expired?: boolean;

  @IsOptional()
  @IsUUID('4', { message: 'hospitalId must be a valid UUID' })
  hospitalId?: string;
}

export class PharmacyPrescriptionQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID('4', { message: 'patientId must be a valid UUID' })
  patientId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'hospitalId must be a valid UUID' })
  hospitalId?: string;
}
