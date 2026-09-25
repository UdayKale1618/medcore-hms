import { IsOptional, IsString, IsUUID } from 'class-validator';

export class MedicineQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  form?: string;

  @IsOptional()
  @IsUUID('4', { message: 'hospitalId must be a valid UUID' })
  hospitalId?: string;
}
