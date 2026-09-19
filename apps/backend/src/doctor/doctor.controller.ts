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
import { DoctorService } from './doctor.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { DoctorQueryDto } from './dto/doctor-query.dto';

@Controller('doctors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DoctorController {
  constructor(private readonly doctorService: DoctorService) {}

  // =========================================================
  // CREATE DOCTOR PROFILE (Admin onboarding)
  // =========================================================
  @Post()
  @Roles('HOSPITAL_ADMIN', 'SUPER_ADMIN')
  async createDoctor(
    @Req() request: Request,
    @Body() dto: CreateDoctorDto,
  ) {
    const user = request.user as AuthUser;

    const doctor = await this.doctorService.createDoctor(dto, user);

    return {
      success: true,
      message: 'Doctor profile created successfully',
      data: doctor,
    };
  }

  // =========================================================
  // LIST DOCTORS (PRD: GET /doctors?hospitalId=&specialisation=)
  // =========================================================
  @Get()
  async getDoctors(
    @Req() request: Request,
    @Query() query: DoctorQueryDto,
  ) {
    const user = request.user as AuthUser;

    const doctors = await this.doctorService.getDoctors(query, user);

    return {
      success: true,
      message: 'Doctors retrieved successfully',
      data: doctors,
    };
  }

  // =========================================================
  // GET DOCTOR BY ID
  // =========================================================
  @Get(':id')
  async getDoctorById(
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    const user = request.user as AuthUser;

    const doctor = await this.doctorService.getDoctorById(id, user);

    return {
      success: true,
      message: 'Doctor details retrieved successfully',
      data: doctor,
    };
  }

  // =========================================================
  // UPDATE DOCTOR PROFILE
  // =========================================================
  @Patch(':id')
  async updateDoctor(
    @Param('id') id: string,
    @Req() request: Request,
    @Body() dto: UpdateDoctorDto,
  ) {
    const user = request.user as AuthUser;

    const updated = await this.doctorService.updateDoctor(id, dto, user);

    return {
      success: true,
      message: 'Doctor profile updated successfully',
      data: updated,
    };
  }

  // =========================================================
  // DEACTIVATE / SOFT DELETE DOCTOR
  // =========================================================
  @Delete(':id')
  @Roles('HOSPITAL_ADMIN', 'SUPER_ADMIN')
  async deleteDoctor(
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    const user = request.user as AuthUser;

    const result = await this.doctorService.deleteDoctor(id, user);

    return {
      success: true,
      message: result.message,
    };
  }
}
