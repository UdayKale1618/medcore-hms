import {
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMedicineBatchDto {
  @IsNotEmpty({ message: 'batchNumber is required' })
  @IsString()
  batchNumber: string;

  @IsOptional()
  @IsISO8601({}, { message: 'manufacturingDate must be a valid ISO8601 string' })
  manufacturingDate?: string;

  @IsNotEmpty({ message: 'expiryDate is required' })
  @IsISO8601({}, { message: 'expiryDate must be a valid ISO8601 string' })
  expiryDate: string;

  @IsNotEmpty({ message: 'quantity is required' })
  @Type(() => Number)
  @IsInt()
  @Min(0, { message: 'quantity must be 0 or greater' })
  quantity: number;

  @IsNotEmpty({ message: 'unitCost is required' })
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'unitCost must be 0 or greater' })
  unitCost: number;

  @IsNotEmpty({ message: 'mrp is required' })
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'mrp must be 0 or greater' })
  mrp: number;
}
