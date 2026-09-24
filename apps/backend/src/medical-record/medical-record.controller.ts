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
import { MedicalRecordService } from './medical-record.service';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';
import { MedicalRecordQueryDto } from './dto/medical-record-query.dto';

@Controller('medical-records')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MedicalRecordController {
  constructor(private readonly medicalRecordService: MedicalRecordService) {}

  // =========================================================
  // CREATE MEDICAL RECORD (Doctor Encounter)
  // =========================================================
  @Post()
  @Roles('DOCTOR', 'HOSPITAL_ADMIN', 'SUPER_ADMIN')
  async createMedicalRecord(
    @Req() request: Request,
    @Body() dto: CreateMedicalRecordDto,
  ) {
    const user = request.user as AuthUser;
    const record = await this.medicalRecordService.createMedicalRecord(
      dto,
      user,
    );

    return {
      success: true,
      message: 'Medical record created successfully',
      data: record,
    };
  }

  // =========================================================
  // LIST MEDICAL RECORDS (Filtered & Scoped)
  // =========================================================
  @Get()
  @Roles(
    'SUPER_ADMIN',
    'HOSPITAL_ADMIN',
    'DOCTOR',
    'NURSE',
    'PATIENT',
    'LAB_TECHNICIAN',
    'PHARMACIST',
  )
  async getMedicalRecords(
    @Req() request: Request,
    @Query() query: MedicalRecordQueryDto,
  ) {
    const user = request.user as AuthUser;
    const records = await this.medicalRecordService.getMedicalRecords(
      query,
      user,
    );

    return {
      success: true,
      message: 'Medical records retrieved successfully',
      data: records,
    };
  }

  // =========================================================
  // GET MEDICAL RECORD BY APPOINTMENT ID
  // =========================================================
  @Get('appointment/:appointmentId')
  @Roles(
    'SUPER_ADMIN',
    'HOSPITAL_ADMIN',
    'DOCTOR',
    'NURSE',
    'PATIENT',
    'LAB_TECHNICIAN',
    'PHARMACIST',
  )
  async getMedicalRecordByAppointmentId(
    @Param('appointmentId') appointmentId: string,
    @Req() request: Request,
  ) {
    const user = request.user as AuthUser;
    const record =
      await this.medicalRecordService.getMedicalRecordByAppointmentId(
        appointmentId,
        user,
      );

    return {
      success: true,
      message: 'Medical record retrieved successfully',
      data: record,
    };
  }

  // =========================================================
  // GET MEDICAL RECORD BY ID
  // =========================================================
  @Get(':id')
  @Roles(
    'SUPER_ADMIN',
    'HOSPITAL_ADMIN',
    'DOCTOR',
    'NURSE',
    'PATIENT',
    'LAB_TECHNICIAN',
    'PHARMACIST',
  )
  async getMedicalRecordById(
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    const user = request.user as AuthUser;
    const record = await this.medicalRecordService.getMedicalRecordById(
      id,
      user,
    );

    return {
      success: true,
      message: 'Medical record details retrieved successfully',
      data: record,
    };
  }

  // =========================================================
  // UPDATE MEDICAL RECORD
  // =========================================================
  @Patch(':id')
  @Roles('DOCTOR', 'HOSPITAL_ADMIN', 'SUPER_ADMIN')
  async updateMedicalRecord(
    @Param('id') id: string,
    @Req() request: Request,
    @Body() dto: UpdateMedicalRecordDto,
  ) {
    const user = request.user as AuthUser;
    const record = await this.medicalRecordService.updateMedicalRecord(
      id,
      dto,
      user,
    );

    return {
      success: true,
      message: 'Medical record updated successfully',
      data: record,
    };
  }
}
