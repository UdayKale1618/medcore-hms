import { IsOptional, IsString } from 'class-validator';

export class UpdatePrescriptionDto {
  @IsOptional()
  @IsString()
  digitalSignature?: string;
}
