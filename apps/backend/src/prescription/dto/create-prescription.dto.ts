import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreatePrescriptionItemDto } from './create-prescription-item.dto';

export class CreatePrescriptionDto {
  @IsUUID()
  @IsNotEmpty()
  medicalRecordId: string;

  @IsOptional()
  @IsString()
  digitalSignature?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Prescription must contain at least one medicine item' })
  @ValidateNested({ each: true })
  @Type(() => CreatePrescriptionItemDto)
  items: CreatePrescriptionItemDto[];
}
