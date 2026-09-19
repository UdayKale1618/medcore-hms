import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthUser } from '../auth/auth-user.interface';
import { HospitalService } from './hospital.service';
import { CreateHospitalDto } from './dto/create-hospital.dto';
import { UpdateHospitalDto } from './dto/update-hospital.dto';

@Controller('hospitals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HospitalController {
  constructor(private readonly hospitalService: HospitalService) {}

  // =========================================================
  // GET CURRENT USER'S HOSPITAL (Derived from JWT hospitalId)
  // =========================================================
  @Get('me')
  async getMyHospital(@Req() request: Request) {
    const user = request.user as AuthUser;

    if (!user?.hospitalId) {
      throw new BadRequestException('No hospital associated with this user');
    }

    const hospital = await this.hospitalService.getHospitalById(user.hospitalId);

    return {
      success: true,
      message: 'Hospital details retrieved successfully',
      data: hospital,
    };
  }

  // =========================================================
  // UPDATE CURRENT USER'S HOSPITAL (Derived from JWT hospitalId)
  // =========================================================
  @Patch('me')
  @Roles('HOSPITAL_ADMIN', 'SUPER_ADMIN')
  async updateMyHospital(
    @Req() request: Request,
    @Body() updateHospitalDto: UpdateHospitalDto,
  ) {
    const user = request.user as AuthUser;

    if (!user?.hospitalId) {
      throw new BadRequestException('No hospital associated with this user');
    }

    const hospital = await this.hospitalService.updateHospital(
      user.hospitalId,
      updateHospitalDto,
    );

    return {
      success: true,
      message: 'Hospital updated successfully',
      data: hospital,
    };
  }

  // =========================================================
  // GET ALL HOSPITALS (SUPER_ADMIN cross-tenant)
  // =========================================================
  @Get()
  @Roles('SUPER_ADMIN')
  async getAllHospitals() {
    const hospitals = await this.hospitalService.getAllHospitals();

    return {
      success: true,
      message: 'All hospitals retrieved successfully',
      data: hospitals,
    };
  }

  // =========================================================
  // CREATE HOSPITAL (SUPER_ADMIN onboarding)
  // =========================================================
  @Post()
  @Roles('SUPER_ADMIN')
  async createHospital(@Body() createHospitalDto: CreateHospitalDto) {
    const hospital =
      await this.hospitalService.createHospital(createHospitalDto);

    return {
      success: true,
      message: 'Hospital created successfully',
      data: hospital,
    };
  }

  // =========================================================
  // GET HOSPITAL BY ID (With tenant isolation)
  // =========================================================
  @Get(':id')
  async getHospitalById(
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    const user = request.user as AuthUser;

    // Enforce tenant isolation: non-super-admins can only access their own hospital
    if (user.role !== 'SUPER_ADMIN' && user.hospitalId !== id) {
      throw new ForbiddenException(
        'Access denied: You can only access your own hospital',
      );
    }

    const hospital = await this.hospitalService.getHospitalById(id);

    return {
      success: true,
      message: 'Hospital details retrieved successfully',
      data: hospital,
    };
  }

  // =========================================================
  // UPDATE HOSPITAL BY ID (With tenant isolation & RBAC)
  // =========================================================
  @Patch(':id')
  @Roles('HOSPITAL_ADMIN', 'SUPER_ADMIN')
  async updateHospitalById(
    @Param('id') id: string,
    @Req() request: Request,
    @Body() updateHospitalDto: UpdateHospitalDto,
  ) {
    const user = request.user as AuthUser;

    // Enforce tenant isolation: HOSPITAL_ADMIN can only update their own hospital
    if (user.role !== 'SUPER_ADMIN' && user.hospitalId !== id) {
      throw new ForbiddenException(
        'Access denied: You can only update your own hospital',
      );
    }

    const hospital = await this.hospitalService.updateHospital(
      id,
      updateHospitalDto,
    );

    return {
      success: true,
      message: 'Hospital updated successfully',
      data: hospital,
    };
  }

  // =========================================================
  // GET HOSPITAL DEPARTMENTS (PRD: GET /hospitals/:id/departments)
  // =========================================================
  @Get(':id/departments')
  async getHospitalDepartments(
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    const user = request.user as AuthUser;

    if (user.role !== 'SUPER_ADMIN' && user.hospitalId !== id) {
      throw new ForbiddenException(
        'Access denied: You can only access departments of your own hospital',
      );
    }

    const departments =
      await this.hospitalService.getHospitalDepartments(id);

    return {
      success: true,
      message: 'Hospital departments retrieved successfully',
      data: departments,
    };
  }
}
