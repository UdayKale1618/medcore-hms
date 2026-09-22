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
import { PatientService } from './patient.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { PatientQueryDto } from './dto/patient-query.dto';

@Controller('patients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  // =========================================================
  // REGISTER / CREATE PATIENT
  // =========================================================
  @Post()
  @Roles('HOSPITAL_ADMIN', 'RECEPTIONIST', 'SUPER_ADMIN')
  async createPatient(
    @Req() request: Request,
    @Body() dto: CreatePatientDto,
  ) {
    const user = request.user as AuthUser;

    const patient = await this.patientService.createPatient(dto, user);

    return {
      success: true,
      message: 'Patient registered successfully',
      data: patient,
    };
  }

  // =========================================================
  // GET CURRENT PATIENT PROFILE (Self-service portal)
  // =========================================================
  @Get('me')
  async getCurrentPatient(@Req() request: Request) {
    const user = request.user as AuthUser;

    const patient = await this.patientService.getCurrentPatient(user);

    return {
      success: true,
      message: 'Patient profile retrieved successfully',
      data: patient,
    };
  }

  // =========================================================
  // UPDATE CURRENT PATIENT PROFILE (Self-service portal)
  // =========================================================
  @Patch('me')
  async updateCurrentPatient(
    @Req() request: Request,
    @Body() dto: UpdatePatientDto,
  ) {
    const user = request.user as AuthUser;

    const patient = await this.patientService.getCurrentPatient(user);
    const updated = await this.patientService.updatePatient(
      patient.id,
      dto,
      user,
    );

    return {
      success: true,
      message: 'Patient profile updated successfully',
      data: updated,
    };
  }

  // =========================================================
  // LIST PATIENTS (Restricted to Hospital Staff & Admins)
  // =========================================================
  @Get()
  @Roles(
    'SUPER_ADMIN',
    'HOSPITAL_ADMIN',
    'RECEPTIONIST',
    'DOCTOR',
    'NURSE',
    'LAB_TECHNICIAN',
    'PHARMACIST',
    'ACCOUNTANT',
  )
  async getPatients(
    @Req() request: Request,
    @Query() query: PatientQueryDto,
  ) {
    const user = request.user as AuthUser;

    const patients = await this.patientService.getPatients(query, user);

    return {
      success: true,
      message: 'Patients retrieved successfully',
      data: patients,
    };
  }

  // =========================================================
  // GET PATIENT BY ID
  // =========================================================
  @Get(':id')
  async getPatientById(
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    const user = request.user as AuthUser;

    const patient = await this.patientService.getPatientById(id, user);

    return {
      success: true,
      message: 'Patient details retrieved successfully',
      data: patient,
    };
  }

  // =========================================================
  // UPDATE PATIENT BY ID
  // =========================================================
  @Patch(':id')
  @Roles(
    'HOSPITAL_ADMIN',
    'RECEPTIONIST',
    'NURSE',
    'SUPER_ADMIN',
    'PATIENT',
  )
  async updatePatient(
    @Param('id') id: string,
    @Req() request: Request,
    @Body() dto: UpdatePatientDto,
  ) {
    const user = request.user as AuthUser;

    const updated = await this.patientService.updatePatient(id, dto, user);

    return {
      success: true,
      message: 'Patient details updated successfully',
      data: updated,
    };
  }

  // =========================================================
  // SOFT DELETE PATIENT
  // =========================================================
  @Delete(':id')
  @Roles('HOSPITAL_ADMIN', 'SUPER_ADMIN')
  async deletePatient(
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    const user = request.user as AuthUser;

    const result = await this.patientService.deletePatient(id, user);

    return {
      success: true,
      message: result.message,
    };
  }
}
