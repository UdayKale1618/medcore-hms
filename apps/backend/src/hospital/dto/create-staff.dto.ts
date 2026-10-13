import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsIn,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export const ALLOWED_STAFF_ROLES = [
  'DOCTOR',
  'NURSE',
  'RECEPTIONIST',
  'LAB_TECHNICIAN',
  'PHARMACIST',
  'ACCOUNTANT',
  'HOSPITAL_ADMIN',
] as const;

export type AllowedStaffRole = (typeof ALLOWED_STAFF_ROLES)[number];

export class CreateStaffDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsNotEmpty()
  @IsString()
  @IsIn(ALLOWED_STAFF_ROLES, {
    message: `Role must be one of: ${ALLOWED_STAFF_ROLES.join(', ')}`,
  })
  role: AllowedStaffRole;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  specialization?: string;

  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  consultationFee?: number;
}
