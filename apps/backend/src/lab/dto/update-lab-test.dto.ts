import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateLabTestDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  referenceMin?: number;

  @IsOptional()
  @IsNumber()
  referenceMax?: number;
}
