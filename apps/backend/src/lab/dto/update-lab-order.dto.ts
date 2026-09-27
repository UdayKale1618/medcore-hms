import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateLabOrderDto {
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
