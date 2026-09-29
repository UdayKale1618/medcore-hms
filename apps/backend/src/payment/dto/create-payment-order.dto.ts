import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreatePaymentOrderDto {
  @IsNotEmpty({ message: 'invoiceId is required' })
  @IsUUID('4', { message: 'invoiceId must be a valid UUID' })
  invoiceId: string;
}
