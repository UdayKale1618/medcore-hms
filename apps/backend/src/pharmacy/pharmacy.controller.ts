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
import { PharmacyService } from './pharmacy.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthUser } from '../auth/auth-user.interface';
import { DispenseMedicineDto } from './dto/dispense-medicine.dto';
import {
  PharmacyBatchQueryDto,
  PharmacyInventoryQueryDto,
  PharmacyPrescriptionQueryDto,
} from './dto/pharmacy-query.dto';

@Controller('pharmacy')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PharmacyController {
  constructor(private readonly pharmacyService: PharmacyService) {}

  @Get('inventory')
  @Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PHARMACIST', 'DOCTOR', 'NURSE')
  async getInventory(
    @Req() request: Request,
    @Query() query: PharmacyInventoryQueryDto,
  ) {
    const caller = request.user as AuthUser;
    return this.pharmacyService.getInventory(query, caller);
  }

  @Get('inventory/:medicineId')
  @Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PHARMACIST', 'DOCTOR', 'NURSE')
  async getMedicineInventory(
    @Req() request: Request,
    @Param('medicineId') medicineId: string,
  ) {
    const caller = request.user as AuthUser;
    return this.pharmacyService.getMedicineInventory(medicineId, caller);
  }

  @Get('batches')
  @Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PHARMACIST')
  async getBatches(
    @Req() request: Request,
    @Query() query: PharmacyBatchQueryDto,
  ) {
    const caller = request.user as AuthUser;
    return this.pharmacyService.getBatches(query, caller);
  }

  @Get('batches/:id')
  @Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PHARMACIST')
  async getBatchById(
    @Req() request: Request,
    @Param('id') id: string,
  ) {
    const caller = request.user as AuthUser;
    return this.pharmacyService.getBatchById(id, caller);
  }

  @Get('prescriptions')
  @Roles(
    'SUPER_ADMIN',
    'HOSPITAL_ADMIN',
    'PHARMACIST',
    'DOCTOR',
    'NURSE',
    'PATIENT',
  )
  async getPrescriptions(
    @Req() request: Request,
    @Query() query: PharmacyPrescriptionQueryDto,
  ) {
    const caller = request.user as AuthUser;
    return this.pharmacyService.getPrescriptions(query, caller);
  }

  @Get('prescriptions/:id')
  @Roles(
    'SUPER_ADMIN',
    'HOSPITAL_ADMIN',
    'PHARMACIST',
    'DOCTOR',
    'NURSE',
    'PATIENT',
  )
  async getPrescriptionById(
    @Req() request: Request,
    @Param('id') id: string,
  ) {
    const caller = request.user as AuthUser;
    return this.pharmacyService.getPrescriptionById(id, caller);
  }

  @Post('dispense')
  @Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PHARMACIST')
  async dispense(
    @Req() request: Request,
    @Body() dto: DispenseMedicineDto,
  ) {
    const caller = request.user as AuthUser;
    return this.pharmacyService.dispense(dto, caller);
  }

  @Patch('prescriptions/:id/status')
  @Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PHARMACIST')
  async updatePrescriptionStatus(
    @Req() request: Request,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    const caller = request.user as AuthUser;
    return this.pharmacyService.updatePrescriptionStatus(id, status, caller);
  }
}
