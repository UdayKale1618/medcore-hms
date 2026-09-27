import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateLabOrderStatusDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['ORDERED', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], {
    message: 'Status must be ORDERED, PENDING, IN_PROGRESS, COMPLETED, or CANCELLED',
  })
  status: string;

  @IsOptional()
  @IsString()
  result?: string;

  @IsOptional()
  @IsNumber()
  resultValue?: number;

  @IsOptional()
  @IsString()
  reportUrl?: string;
}
