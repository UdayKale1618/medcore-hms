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
import { MedicineService } from './medicine.service';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';
import { CreateMedicineBatchDto } from './dto/create-medicine-batch.dto';
import { MedicineQueryDto } from './dto/medicine-query.dto';

@Controller('medicines')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MedicineController {
  constructor(private readonly medicineService: MedicineService) {}

  // =========================================================
  // CREATE MEDICINE
  // =========================================================
  @Post()
  @Roles('HOSPITAL_ADMIN', 'PHARMACIST', 'SUPER_ADMIN')
  async createMedicine(
    @Req() request: Request,
    @Body() dto: CreateMedicineDto,
  ) {
    const user = request.user as AuthUser;
    const medicine = await this.medicineService.createMedicine(dto, user);

    return {
      success: true,
      message: 'Medicine created successfully',
      data: medicine,
    };
  }

  // =========================================================
  // LIST MEDICINES
  // =========================================================
  @Get()
  @Roles('DOCTOR', 'PHARMACIST', 'NURSE', 'HOSPITAL_ADMIN', 'SUPER_ADMIN')
  async getMedicines(
    @Req() request: Request,
    @Query() query: MedicineQueryDto,
  ) {
    const user = request.user as AuthUser;
    const medicines = await this.medicineService.getMedicines(query, user);

    return {
      success: true,
      message: 'Medicines retrieved successfully',
      data: medicines,
    };
  }

  // =========================================================
  // GET MEDICINE BY ID
  // =========================================================
  @Get(':id')
  @Roles('DOCTOR', 'PHARMACIST', 'NURSE', 'HOSPITAL_ADMIN', 'SUPER_ADMIN')
  async getMedicineById(
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    const user = request.user as AuthUser;
    const medicine = await this.medicineService.getMedicineById(id, user);

    return {
      success: true,
      message: 'Medicine details retrieved successfully',
      data: medicine,
    };
  }

  // =========================================================
  // UPDATE MEDICINE
  // =========================================================
  @Patch(':id')
  @Roles('HOSPITAL_ADMIN', 'PHARMACIST', 'SUPER_ADMIN')
  async updateMedicine(
    @Param('id') id: string,
    @Req() request: Request,
    @Body() dto: UpdateMedicineDto,
  ) {
    const user = request.user as AuthUser;
    const medicine = await this.medicineService.updateMedicine(
      id,
      dto,
      user,
    );

    return {
      success: true,
      message: 'Medicine updated successfully',
      data: medicine,
    };
  }

  // =========================================================
  // CREATE MEDICINE BATCH
  // =========================================================
  @Post(':id/batches')
  @Roles('HOSPITAL_ADMIN', 'PHARMACIST', 'SUPER_ADMIN')
  async createBatch(
    @Param('id') id: string,
    @Req() request: Request,
    @Body() dto: CreateMedicineBatchDto,
  ) {
    const user = request.user as AuthUser;
    const batch = await this.medicineService.createBatch(id, dto, user);

    return {
      success: true,
      message: 'Medicine batch created successfully',
      data: batch,
    };
  }

  // =========================================================
  // GET BATCHES FOR MEDICINE
  // =========================================================
  @Get(':id/batches')
  @Roles('DOCTOR', 'PHARMACIST', 'HOSPITAL_ADMIN', 'SUPER_ADMIN')
  async getBatches(
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    const user = request.user as AuthUser;
    const batches = await this.medicineService.getBatches(id, user);

    return {
      success: true,
      message: 'Medicine batches retrieved successfully',
      data: batches,
    };
  }
}
