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
import { PrescriptionService } from './prescription.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { PrescriptionQueryDto } from './dto/prescription-query.dto';

@Controller('prescriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PrescriptionController {
  constructor(private readonly prescriptionService: PrescriptionService) {}

  // =========================================================
  // CREATE PRESCRIPTION (Doctor Encounter)
  // =========================================================
  @Post()
  @Roles('DOCTOR', 'SUPER_ADMIN')
  async createPrescription(
    @Req() request: Request,
    @Body() dto: CreatePrescriptionDto,
  ) {
    const user = request.user as AuthUser;
    const prescription = await this.prescriptionService.createPrescription(
      dto,
      user,
    );

    return {
      success: true,
      message: 'Prescription created successfully',
      data: prescription,
    };
  }

  // =========================================================
  // GET MY PRESCRIPTIONS (Patient convenience endpoint)
  // Must be placed BEFORE :id to avoid route collision
  // =========================================================
  @Get('me')
  @Roles('PATIENT')
  async getMyPrescriptions(@Req() request: Request) {
    const user = request.user as AuthUser;
    const prescriptions =
      await this.prescriptionService.getMyPrescriptions(user);

    return {
      success: true,
      message: 'My prescriptions retrieved successfully',
      data: prescriptions,
    };
  }

  // =========================================================
  // GET PRESCRIPTIONS BY MEDICAL RECORD ID
  // Must be placed BEFORE :id
  // =========================================================
  @Get('medical-record/:medicalRecordId')
  @Roles('DOCTOR', 'NURSE', 'PHARMACIST', 'HOSPITAL_ADMIN', 'PATIENT', 'SUPER_ADMIN')
  async getPrescriptionsByMedicalRecordId(
    @Param('medicalRecordId') medicalRecordId: string,
    @Req() request: Request,
  ) {
    const user = request.user as AuthUser;
    const prescriptions =
      await this.prescriptionService.getPrescriptionsByMedicalRecordId(
        medicalRecordId,
        user,
      );

    return {
      success: true,
      message: 'Medical record prescriptions retrieved successfully',
      data: prescriptions,
    };
  }

  // =========================================================
  // LIST PRESCRIPTIONS
  // =========================================================
  @Get()
  @Roles('DOCTOR', 'NURSE', 'PHARMACIST', 'HOSPITAL_ADMIN', 'PATIENT', 'SUPER_ADMIN')
  async getPrescriptions(
    @Req() request: Request,
    @Query() query: PrescriptionQueryDto,
  ) {
    const user = request.user as AuthUser;
    const prescriptions = await this.prescriptionService.getPrescriptions(
      query,
      user,
    );

    return {
      success: true,
      message: 'Prescriptions retrieved successfully',
      data: prescriptions,
    };
  }

  // =========================================================
  // GET PRESCRIPTION BY ID
  // =========================================================
  @Get(':id')
  @Roles('DOCTOR', 'NURSE', 'PHARMACIST', 'HOSPITAL_ADMIN', 'PATIENT', 'SUPER_ADMIN')
  async getPrescriptionById(
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    const user = request.user as AuthUser;
    const prescription = await this.prescriptionService.getPrescriptionById(
      id,
      user,
    );

    return {
      success: true,
      message: 'Prescription details retrieved successfully',
      data: prescription,
    };
  }

  // =========================================================
  // UPDATE PRESCRIPTION (Digital Signature)
  // =========================================================
  @Patch(':id')
  @Roles('DOCTOR', 'SUPER_ADMIN')
  async updatePrescription(
    @Param('id') id: string,
    @Req() request: Request,
    @Body() dto: UpdatePrescriptionDto,
  ) {
    const user = request.user as AuthUser;
    const prescription = await this.prescriptionService.updatePrescription(
      id,
      dto,
      user,
    );

    return {
      success: true,
      message: 'Prescription updated successfully',
      data: prescription,
    };
  }
}
