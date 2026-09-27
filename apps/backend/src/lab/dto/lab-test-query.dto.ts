import { IsOptional, IsString, IsUUID } from 'class-validator';

export class LabTestQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  hospitalId?: string;
}
