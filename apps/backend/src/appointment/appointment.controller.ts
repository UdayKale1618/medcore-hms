import {
  Body,
  Controller,
  Delete,
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
import { AppointmentService } from './appointment.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
import { AppointmentQueryDto } from './dto/appointment-query.dto';

@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  // =========================================================
  // BOOK / CREATE APPOINTMENT
  // =========================================================
  @Post()
  @Roles('PATIENT', 'RECEPTIONIST', 'HOSPITAL_ADMIN', 'SUPER_ADMIN')
  async createAppointment(
    @Req() request: Request,
    @Body() dto: CreateAppointmentDto,
  ) {
    const user = request.user as AuthUser;
    const appointment = await this.appointmentService.createAppointment(
      dto,
      user,
    );

    return {
      success: true,
      message: 'Appointment booked successfully',
      data: appointment,
    };
  }

  // =========================================================
  // GET CURRENT USER'S APPOINTMENTS (/appointments/me)
  // =========================================================
  @Get('me')
  async getCurrentUserAppointments(@Req() request: Request) {
    const user = request.user as AuthUser;
    const appointments =
      await this.appointmentService.getCurrentUserAppointments(user);

    return {
      success: true,
      message: 'User appointments retrieved successfully',
      data: appointments,
    };
  }

  // =========================================================
  // LIST APPOINTMENTS (Filtered, Tenant-isolated, Role-scoped)
  // =========================================================
  @Get()
  @Roles(
    'SUPER_ADMIN',
    'HOSPITAL_ADMIN',
    'DOCTOR',
    'NURSE',
    'RECEPTIONIST',
    'PATIENT',
    'LAB_TECHNICIAN',
    'PHARMACIST',
    'ACCOUNTANT',
  )
  async getAppointments(
    @Req() request: Request,
    @Query() query: AppointmentQueryDto,
  ) {
    const user = request.user as AuthUser;
    const appointments = await this.appointmentService.getAppointments(
      query,
      user,
    );

    return {
      success: true,
      message: 'Appointments retrieved successfully',
      data: appointments,
    };
  }

  // =========================================================
  // GET APPOINTMENT BY ID
  // =========================================================
  @Get(':id')
  async getAppointmentById(
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    const user = request.user as AuthUser;
    const appointment = await this.appointmentService.getAppointmentById(
      id,
      user,
    );

    return {
      success: true,
      message: 'Appointment details retrieved successfully',
      data: appointment,
    };
  }

  // =========================================================
  // UPDATE APPOINTMENT DETAILS (Reschedule / Edit)
  // =========================================================
  @Patch(':id')
  @Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'RECEPTIONIST', 'PATIENT')
  async updateAppointment(
    @Param('id') id: string,
    @Req() request: Request,
    @Body() dto: UpdateAppointmentDto,
  ) {
    const user = request.user as AuthUser;
    const appointment = await this.appointmentService.updateAppointment(
      id,
      dto,
      user,
    );

    return {
      success: true,
      message: 'Appointment updated successfully',
      data: appointment,
    };
  }

  // =========================================================
  // UPDATE APPOINTMENT STATUS (State Transitions)
  // =========================================================
  @Patch(':id/status')
  @Roles(
    'SUPER_ADMIN',
    'HOSPITAL_ADMIN',
    'DOCTOR',
    'RECEPTIONIST',
    'PATIENT',
  )
  async updateAppointmentStatus(
    @Param('id') id: string,
    @Req() request: Request,
    @Body() dto: UpdateAppointmentStatusDto,
  ) {
    const user = request.user as AuthUser;
    const appointment = await this.appointmentService.updateAppointmentStatus(
      id,
      dto,
      user,
    );

    return {
      success: true,
      message: 'Appointment status updated successfully',
      data: appointment,
    };
  }

  // =========================================================
  // DELETE / CANCEL APPOINTMENT
  // =========================================================
  @Delete(':id')
  @Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'RECEPTIONIST', 'PATIENT')
  async deleteAppointment(
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    const user = request.user as AuthUser;
    const result = await this.appointmentService.deleteAppointment(id, user);

    return {
      success: true,
      message: result.message,
    };
  }
}
