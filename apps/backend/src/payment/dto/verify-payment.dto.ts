import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class VerifyPaymentDto {
  @IsNotEmpty({ message: 'invoiceId is required' })
  @IsUUID('4', { message: 'invoiceId must be a valid UUID' })
  invoiceId: string;

  @IsNotEmpty({ message: 'razorpayOrderId is required' })
  @IsString()
  razorpayOrderId: string;

  @IsNotEmpty({ message: 'razorpayPaymentId is required' })
  @IsString()
  razorpayPaymentId: string;

  @IsNotEmpty({ message: 'razorpaySignature is required' })
  @IsString()
  razorpaySignature: string;
}
