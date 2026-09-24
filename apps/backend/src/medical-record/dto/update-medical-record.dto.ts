import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateMedicalRecordDto {
  @IsOptional()
  @IsString()
  chiefComplaint?: string;

  @IsOptional()
  @IsString()
  symptoms?: string;

  @IsOptional()
  @IsString()
  diagnosis?: string;

  @IsOptional()
  @IsString()
  icd10Code?: string;

  @IsOptional()
  @IsString()
  treatmentPlan?: string;

  @IsOptional()
  @IsString()
  allergies?: string;

  @IsOptional()
  @IsString()
  adverseDrugReactions?: string;

  @IsOptional()
  @IsString()
  bloodPressure?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30, { message: 'pulse must be at least 30 bpm' })
  @Max(250, { message: 'pulse cannot exceed 250 bpm' })
  pulse?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(30, { message: 'temperature must be at least 30 C' })
  @Max(45, { message: 'temperature cannot exceed 45 C' })
  temperature?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(50, { message: 'spo2 must be at least 50%' })
  @Max(100, { message: 'spo2 cannot exceed 100%' })
  spo2?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(20, { message: 'height must be at least 20 cm' })
  @Max(300, { message: 'height cannot exceed 300 cm' })
  height?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'weight must be at least 1 kg' })
  @Max(500, { message: 'weight cannot exceed 500 kg' })
  weight?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  bmi?: number;

  @IsOptional()
  @IsString()
  familyHistory?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
