import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateLabTestDto {
  @IsString()
  @IsNotEmpty()
  name: string;

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

  @IsOptional()
  @IsUUID()
  hospitalId?: string;
}
