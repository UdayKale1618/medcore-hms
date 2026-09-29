import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DispenseItemDto {
  @IsNotEmpty({ message: 'prescriptionItemId is required' })
  @IsUUID('4', { message: 'prescriptionItemId must be a valid UUID' })
  prescriptionItemId: string;

  @IsNotEmpty({ message: 'batchId is required' })
  @IsUUID('4', { message: 'batchId must be a valid UUID' })
  batchId: string;

  @Type(() => Number)
  @IsInt({ message: 'quantity must be an integer' })
  @Min(1, { message: 'quantity must be at least 1' })
  quantity: number;
}

export class DispenseMedicineDto {
  @IsNotEmpty({ message: 'prescriptionId is required' })
  @IsUUID('4', { message: 'prescriptionId must be a valid UUID' })
  prescriptionId: string;

  @IsArray({ message: 'items must be an array' })
  @ValidateNested({ each: true })
  @Type(() => DispenseItemDto)
  items: DispenseItemDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}
