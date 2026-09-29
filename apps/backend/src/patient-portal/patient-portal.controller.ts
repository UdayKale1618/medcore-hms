import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { PatientPortalService } from './patient-portal.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthUser } from '../auth/auth-user.interface';

@Controller('patient-portal')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PATIENT')
export class PatientPortalController {
  constructor(private readonly patientPortalService: PatientPortalService) {}

  @Get('profile')
  async getProfile(@Req() request: Request) {
    const caller = request.user as AuthUser;
    return this.patientPortalService.getProfile(caller);
  }

  @Get('appointments')
  async getAppointments(@Req() request: Request) {
    const caller = request.user as AuthUser;
    return this.patientPortalService.getAppointments(caller);
  }

  @Get('appointments/:id')
  async getAppointmentById(
    @Req() request: Request,
    @Param('id') id: string,
  ) {
    const caller = request.user as AuthUser;
    return this.patientPortalService.getAppointmentById(id, caller);
  }

  @Patch('appointments/:id/cancel')
  async cancelAppointment(
    @Req() request: Request,
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    const caller = request.user as AuthUser;
    return this.patientPortalService.cancelAppointment(id, reason, caller);
  }

  @Get('medical-records')
  async getMedicalRecords(@Req() request: Request) {
    const caller = request.user as AuthUser;
    return this.patientPortalService.getMedicalRecords(caller);
  }

  @Get('medical-records/:id')
  async getMedicalRecordById(
    @Req() request: Request,
    @Param('id') id: string,
  ) {
    const caller = request.user as AuthUser;
    return this.patientPortalService.getMedicalRecordById(id, caller);
  }

  @Get('prescriptions')
  async getPrescriptions(@Req() request: Request) {
    const caller = request.user as AuthUser;
    return this.patientPortalService.getPrescriptions(caller);
  }

  @Get('prescriptions/:id')
  async getPrescriptionById(
    @Req() request: Request,
    @Param('id') id: string,
  ) {
    const caller = request.user as AuthUser;
    return this.patientPortalService.getPrescriptionById(id, caller);
  }

  @Get('lab-orders')
  async getLabOrders(@Req() request: Request) {
    const caller = request.user as AuthUser;
    return this.patientPortalService.getLabOrders(caller);
  }

  @Get('lab-orders/:id')
  async getLabOrderById(
    @Req() request: Request,
    @Param('id') id: string,
  ) {
    const caller = request.user as AuthUser;
    return this.patientPortalService.getLabOrderById(id, caller);
  }

  @Get('invoices')
  async getInvoices(@Req() request: Request) {
    const caller = request.user as AuthUser;
    return this.patientPortalService.getInvoices(caller);
  }

  @Get('invoices/:id')
  async getInvoiceById(
    @Req() request: Request,
    @Param('id') id: string,
  ) {
    const caller = request.user as AuthUser;
    return this.patientPortalService.getInvoiceById(id, caller);
  }
}
