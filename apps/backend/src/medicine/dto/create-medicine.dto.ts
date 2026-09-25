import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum MedicineForm {
  TABLET = 'TABLET',
  CAPSULE = 'CAPSULE',
  SYRUP = 'SYRUP',
  INJECTION = 'INJECTION',
  TOPICAL = 'TOPICAL',
  DROPS = 'DROPS',
  INHALER = 'INHALER',
  OTHER = 'OTHER',
}

export class CreateMedicineDto {
  @IsNotEmpty({ message: 'name is required' })
  @IsString()
  name: string;

  @IsNotEmpty({ message: 'form is required' })
  @IsString()
  form: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0, { message: 'reorderLevel must be 0 or greater' })
  reorderLevel?: number;

  @IsOptional()
  @IsUUID('4', { message: 'hospitalId must be a valid UUID' })
  hospitalId?: string;
}
