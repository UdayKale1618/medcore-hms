import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthUser } from '../auth/auth-user.interface';
import { InvoiceService } from './invoice.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { UpdateInvoiceStatusDto } from './dto/update-invoice-status.dto';
import { InvoiceQueryDto } from './dto/invoice-query.dto';

@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  // =========================================================
  // CREATE INVOICE
  // =========================================================
  @Post()
  @Roles('ACCOUNTANT', 'HOSPITAL_ADMIN', 'RECEPTIONIST', 'SUPER_ADMIN')
  async createInvoice(
    @Req() request: Request,
    @Body() dto: CreateInvoiceDto,
  ) {
    const user = request.user as AuthUser;
    const invoice = await this.invoiceService.createInvoice(dto, user);

    return {
      success: true,
      message: 'Invoice created successfully',
      data: invoice,
    };
  }

  // =========================================================
  // GET INVOICES BY PATIENT ID
  // Must be placed before :id
  // =========================================================
  @Get('patient/:patientId')
  @Roles(
    'ACCOUNTANT',
    'HOSPITAL_ADMIN',
    'RECEPTIONIST',
    'DOCTOR',
    'NURSE',
    'PATIENT',
    'SUPER_ADMIN',
  )
  async getInvoicesByPatientId(
    @Param('patientId') patientId: string,
    @Req() request: Request,
  ) {
    const user = request.user as AuthUser;
    const invoices = await this.invoiceService.getInvoicesByPatientId(
      patientId,
      user,
    );

    return {
      success: true,
      message: 'Patient invoices retrieved successfully',
      data: invoices,
    };
  }

  // =========================================================
  // GET INVOICE BY APPOINTMENT ID
  // Must be placed before :id
  // =========================================================
  @Get('appointment/:appointmentId')
  @Roles(
    'ACCOUNTANT',
    'HOSPITAL_ADMIN',
    'RECEPTIONIST',
    'DOCTOR',
    'NURSE',
    'PATIENT',
    'SUPER_ADMIN',
  )
  async getInvoiceByAppointmentId(
    @Param('appointmentId') appointmentId: string,
    @Req() request: Request,
  ) {
    const user = request.user as AuthUser;
    const invoice = await this.invoiceService.getInvoiceByAppointmentId(
      appointmentId,
      user,
    );

    return {
      success: true,
      message: 'Appointment invoice retrieved successfully',
      data: invoice,
    };
  }

  // =========================================================
  // LIST INVOICES
  // =========================================================
  @Get()
  @Roles(
    'ACCOUNTANT',
    'HOSPITAL_ADMIN',
    'RECEPTIONIST',
    'DOCTOR',
    'NURSE',
    'PATIENT',
    'SUPER_ADMIN',
  )
  async getInvoices(
    @Req() request: Request,
    @Query() query: InvoiceQueryDto,
  ) {
    const user = request.user as AuthUser;
    const invoices = await this.invoiceService.getInvoices(query, user);

    return {
      success: true,
      message: 'Invoices retrieved successfully',
      data: invoices,
    };
  }

  // =========================================================
  // GET INVOICE BY ID
  // =========================================================
  @Get(':id')
  @Roles(
    'ACCOUNTANT',
    'HOSPITAL_ADMIN',
    'RECEPTIONIST',
    'DOCTOR',
    'NURSE',
    'PATIENT',
    'SUPER_ADMIN',
  )
  async getInvoiceById(
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    const user = request.user as AuthUser;
    const invoice = await this.invoiceService.getInvoiceById(id, user);

    return {
      success: true,
      message: 'Invoice details retrieved successfully',
      data: invoice,
    };
  }

  // =========================================================
  // UPDATE INVOICE STATUS (Workflow)
  // Must be placed before :id or explicit route
  // =========================================================
  @Patch(':id/status')
  @Roles('ACCOUNTANT', 'HOSPITAL_ADMIN', 'RECEPTIONIST', 'SUPER_ADMIN')
  async updateInvoiceStatus(
    @Param('id') id: string,
    @Req() request: Request,
    @Body() dto: UpdateInvoiceStatusDto,
  ) {
    const user = request.user as AuthUser;
    const invoice = await this.invoiceService.updateInvoiceStatus(
      id,
      dto,
      user,
    );

    return {
      success: true,
      message: 'Invoice status updated successfully',
      data: invoice,
    };
  }

  // =========================================================
  // UPDATE INVOICE (Tax / Discount adjustment)
  // =========================================================
  @Patch(':id')
  @Roles('ACCOUNTANT', 'HOSPITAL_ADMIN', 'SUPER_ADMIN')
  async updateInvoice(
    @Param('id') id: string,
    @Req() request: Request,
    @Body() dto: UpdateInvoiceDto,
  ) {
    const user = request.user as AuthUser;
    const invoice = await this.invoiceService.updateInvoice(id, dto, user);

    return {
      success: true,
      message: 'Invoice updated successfully',
      data: invoice,
    };
  }
}
