import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class UpdateInvoiceStatusDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['DRAFT', 'ISSUED', 'PAID', 'CANCELLED'], {
    message: 'Status must be DRAFT, ISSUED, PAID, or CANCELLED',
  })
  status: string;
}
