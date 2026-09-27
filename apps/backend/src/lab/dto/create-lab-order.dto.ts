import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateLabOrderDto {
  @IsUUID()
  @IsNotEmpty()
  medicalRecordId: string;

  @IsUUID()
  @IsNotEmpty()
  labTestId: string;
}
