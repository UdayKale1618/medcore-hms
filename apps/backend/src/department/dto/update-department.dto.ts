import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateDepartmentDto {
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  name?: string;
}
