import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreatePrescriptionItemDto {
  @IsUUID()
  @IsNotEmpty()
  medicineId: string;

  @IsString()
  @IsNotEmpty()
  dosage: string;

  @IsString()
  @IsNotEmpty()
  frequency: string;

  @IsInt()
  @Min(1)
  durationDays: number;

  @IsOptional()
  @IsString()
  specialInstructions?: string;
}
