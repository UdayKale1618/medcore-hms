import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthUser } from '../auth/auth-user.interface';
import { CreatePaymentOrderDto } from './dto/create-payment-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('create-order')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT', 'ACCOUNTANT', 'HOSPITAL_ADMIN', 'SUPER_ADMIN')
  async createOrder(
    @Req() request: Request,
    @Body() dto: CreatePaymentOrderDto,
  ) {
    const caller = request.user as AuthUser;
    return this.paymentService.createOrder(dto, caller);
  }

  @Post('verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT', 'ACCOUNTANT', 'HOSPITAL_ADMIN', 'SUPER_ADMIN')
  async verifyPayment(
    @Req() request: Request,
    @Body() dto: VerifyPaymentDto,
  ) {
    const caller = request.user as AuthUser;
    return this.paymentService.verifyPayment(dto, caller);
  }

  @Post('webhook/razorpay')
  async handleWebhook(
    @Req() req: Request,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    const rawBody =
      (req as Request & { rawBody?: Buffer | string }).rawBody ||
      (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    return this.paymentService.handleWebhook(rawBody, signature);
  }

  @Get('invoice/:invoiceId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT', 'ACCOUNTANT', 'HOSPITAL_ADMIN', 'SUPER_ADMIN')
  async getInvoicePayments(
    @Req() request: Request,
    @Param('invoiceId') invoiceId: string,
  ) {
    const caller = request.user as AuthUser;
    return this.paymentService.getInvoicePayments(invoiceId, caller);
  }
}
