import { IsOptional, IsString } from 'class-validator';

export class DoctorQueryDto {
  @IsOptional()
  @IsString()
  hospitalId?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  specialization?: string;
}
