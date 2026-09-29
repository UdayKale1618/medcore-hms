import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { CreatePaymentOrderDto } from './dto/create-payment-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import type { AuthUser } from '../auth/auth-user.interface';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notificationService?: NotificationService,
  ) {
    this.keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder_key';
    this.keySecret =
      process.env.RAZORPAY_KEY_SECRET || 'rzp_test_placeholder_secret';
    this.webhookSecret =
      process.env.RAZORPAY_WEBHOOK_SECRET || 'rzp_webhook_placeholder_secret';
  }

  // =========================================================
  // 1. CREATE PAYMENT ORDER (Server-side Amount Verification)
  // =========================================================
  async createOrder(dto: CreatePaymentOrderDto, caller: AuthUser) {
    // 1. Fetch invoice with patient
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: dto.invoiceId },
      include: {
        patient: {
          include: {
            user: {
              select: { id: true, name: true, email: true, phone: true },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const hospitalId = invoice.patient.hospitalId;

    // 2. Tenancy validation
    if (caller.role !== 'SUPER_ADMIN' && hospitalId !== caller.hospitalId) {
      throw new ForbiddenException(
        'Access denied: Invoice belongs to another hospital',
      );
    }

    // 3. Patient role isolation: must be their own invoice
    if (caller.role === 'PATIENT') {
      const patient = await this.prisma.patient.findUnique({
        where: { userId: caller.userId },
      });

      if (!patient || patient.id !== invoice.patientId) {
        throw new ForbiddenException(
          'Access denied: You can only create payment orders for your own invoices',
        );
      }
    }

    // 4. Invoice status validation
    if (invoice.status === 'PAID') {
      throw new BadRequestException('Invoice is already paid');
    }

    if (invoice.status === 'CANCELLED') {
      throw new BadRequestException('Cannot pay a cancelled invoice');
    }

    const totalAmount = Number(invoice.total);
    if (totalAmount <= 0) {
      throw new BadRequestException(
        'Invoice total must be greater than zero to initiate payment',
      );
    }

    // Server-side amount conversion to smallest currency unit (paise for INR)
    const amountInPaise = Math.round(totalAmount * 100);

    // 5. Generate unique Razorpay Order ID
    const randomSuffix = crypto.randomBytes(6).toString('hex');
    const gatewayOrderId = `order_${Date.now()}_${randomSuffix}`;

    // 6. Record Payment entity in database
    const payment = await this.prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        hospitalId,
        amount: invoice.total,
        currency: 'INR',
        gateway: 'RAZORPAY',
        gatewayOrderId,
        status: 'CREATED',
      },
    });

    return {
      paymentId: payment.id,
      orderId: gatewayOrderId,
      amount: totalAmount,
      amountInPaise,
      currency: 'INR',
      keyId: this.keyId,
      invoiceNumber: invoice.invoiceNumber,
      patientName: invoice.patient.user.name,
      patientEmail: invoice.patient.user.email,
    };
  }

  // =========================================================
  // 2. VERIFY PAYMENT (HMAC SHA-256 Signature Verification)
  // =========================================================
  async verifyPayment(dto: VerifyPaymentDto, caller: AuthUser) {
    // 1. Fetch invoice and payment record
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: dto.invoiceId },
      include: {
        patient: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const hospitalId = invoice.patient.hospitalId;

    if (caller.role !== 'SUPER_ADMIN' && hospitalId !== caller.hospitalId) {
      throw new ForbiddenException(
        'Access denied: Invoice belongs to another hospital',
      );
    }

    if (caller.role === 'PATIENT') {
      const patient = await this.prisma.patient.findUnique({
        where: { userId: caller.userId },
      });
      if (!patient || patient.id !== invoice.patientId) {
        throw new ForbiddenException(
          'Access denied: You can only verify payments for your own invoices',
        );
      }
    }

    const payment = await this.prisma.payment.findFirst({
      where: {
        invoiceId: dto.invoiceId,
        gatewayOrderId: dto.razorpayOrderId,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment order record not found');
    }

    // 2. Verify Razorpay Signature
    const expectedSignature = crypto
      .createHmac('sha256', this.keySecret)
      .update(`${dto.razorpayOrderId}|${dto.razorpayPaymentId}`)
      .digest('hex');

    const signatureValid = this.safeCompare(
      expectedSignature,
      dto.razorpaySignature,
    );

    if (!signatureValid) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          gatewayPaymentId: dto.razorpayPaymentId,
          failureReason: 'Invalid signature',
        },
      });
      throw new BadRequestException('Invalid payment signature');
    }

    // 3. Atomically transition Payment to SUCCESS and Invoice to PAID
    const result = await this.prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'SUCCESS',
          gatewayPaymentId: dto.razorpayPaymentId,
          method: 'ONLINE',
          failureReason: null,
        },
      });

      const updatedInvoice = await tx.invoice.update({
        where: { id: dto.invoiceId },
        data: {
          status: 'PAID',
          paidAt: new Date(),
        },
      });

      return {
        message: 'Payment verified and captured successfully',
        payment: updatedPayment,
        invoice: updatedInvoice,
      };
    });

    if (this.notificationService && invoice.patient?.userId) {
      await this.notificationService.dispatch({
        userId: invoice.patient.userId,
        hospitalId,
        type: 'payment.success',
        title: 'Payment Successful',
        message: `Your payment of ₹${invoice.total} for invoice ${invoice.invoiceNumber} has been received.`,
        entityType: 'Invoice',
        entityId: invoice.id,
      });
    }

    return result;
  }

  // =========================================================
  // 3. RAZORPAY WEBHOOK (Idempotent & Signature Verified)
  // =========================================================
  async handleWebhook(rawBody: string | Buffer, signature: string) {
    if (!signature) {
      throw new BadRequestException('Missing webhook signature');
    }

    const bodyString =
      typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');

    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(bodyString)
      .digest('hex');

    if (!this.safeCompare(expectedSignature, signature)) {
      this.logger.warn('Rejected webhook: invalid signature');
      throw new BadRequestException('Invalid webhook signature');
    }

    interface RazorpayWebhookPayload {
      event?: string;
      payload?: {
        payment?: {
          entity?: {
            id?: string;
            order_id?: string;
            method?: string;
            error_description?: string;
          };
        };
      };
    }

    let payload: RazorpayWebhookPayload;
    try {
      payload = JSON.parse(bodyString) as RazorpayWebhookPayload;
    } catch {
      throw new BadRequestException('Invalid webhook JSON payload');
    }

    const event = payload.event;
    this.logger.log(`Processing Razorpay webhook event: ${event}`);

    if (event === 'payment.captured') {
      const paymentEntity = payload.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id;
      const paymentId = paymentEntity?.id;
      const method = paymentEntity?.method || 'ONLINE';

      if (!orderId) {
        return { received: true, status: 'ignored_missing_order_id' };
      }

      const payment = await this.prisma.payment.findFirst({
        where: { gatewayOrderId: orderId },
      });

      if (!payment) {
        this.logger.warn(`Webhook: Payment order not found for ${orderId}`);
        return { received: true, status: 'order_not_found' };
      }

      // IDEMPOTENCY CHECK: if already SUCCESS, do not re-process
      if (payment.status === 'SUCCESS') {
        this.logger.log(
          `Webhook: Payment ${payment.id} already processed. Idempotent return.`,
        );
        return { received: true, status: 'already_processed' };
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'SUCCESS',
            gatewayPaymentId: paymentId,
            method,
            failureReason: null,
          },
        });

        await tx.invoice.update({
          where: { id: payment.invoiceId },
          data: {
            status: 'PAID',
            paidAt: new Date(),
          },
        });
      });

      if (this.notificationService) {
        const fullInvoice = await this.prisma.invoice.findUnique({
          where: { id: payment.invoiceId },
          include: { patient: true },
        });
        if (fullInvoice?.patient?.userId) {
          await this.notificationService.dispatch({
            userId: fullInvoice.patient.userId,
            hospitalId: fullInvoice.patient.hospitalId,
            type: 'payment.success',
            title: 'Payment Successful',
            message: `Your payment of ₹${fullInvoice.total} for invoice ${fullInvoice.invoiceNumber} has been confirmed.`,
            entityType: 'Invoice',
            entityId: fullInvoice.id,
          });
        }
      }

      return { received: true, status: 'processed' };
    }

    if (event === 'payment.failed') {
      const paymentEntity = payload.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id;
      const paymentId = paymentEntity?.id;
      const reason =
        paymentEntity?.error_description || 'Payment capture failed';

      if (orderId) {
        const payment = await this.prisma.payment.findFirst({
          where: { gatewayOrderId: orderId },
        });

        if (payment && payment.status !== 'SUCCESS') {
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: 'FAILED',
              gatewayPaymentId: paymentId,
              failureReason: reason,
            },
          });
        }
      }

      return { received: true, status: 'marked_failed' };
    }

    return { received: true, status: 'unhandled_event' };
  }

  // =========================================================
  // 4. GET PAYMENTS FOR INVOICE
  // =========================================================
  async getInvoicePayments(invoiceId: string, caller: AuthUser) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { patient: true },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (
      caller.role !== 'SUPER_ADMIN' &&
      invoice.patient.hospitalId !== caller.hospitalId
    ) {
      throw new ForbiddenException(
        'Access denied: Invoice belongs to another hospital',
      );
    }

    if (caller.role === 'PATIENT') {
      const patient = await this.prisma.patient.findUnique({
        where: { userId: caller.userId },
      });
      if (!patient || patient.id !== invoice.patientId) {
        throw new ForbiddenException(
          'Access denied: You can only view payments for your own invoices',
        );
      }
    }

    return this.prisma.payment.findMany({
      where: { invoiceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private safeCompare(a: string, b: string): boolean {
    if (!a || !b || a.length !== b.length) {
      return false;
    }
    return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  }
}
