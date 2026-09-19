import {
  Body,
  Controller,
  Delete,
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
import type { AuthUser } from '../auth/auth-user.interface';
import { AvailabilityService } from './availability.service';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  // =========================================================
  // CREATE DOCTOR AVAILABILITY
  // =========================================================
  @Post('doctors/:doctorId/availability')
  async createAvailability(
    @Param('doctorId') doctorId: string,
    @Req() request: Request,
    @Body() dto: CreateAvailabilityDto,
  ) {
    const user = request.user as AuthUser;

    const availability = await this.availabilityService.createAvailability(
      doctorId,
      dto,
      user,
    );

    return {
      success: true,
      message: 'Doctor availability created successfully',
      data: availability,
    };
  }

  // =========================================================
  // GET DOCTOR AVAILABILITY SCHEDULE
  // =========================================================
  @Get('doctors/:doctorId/availability')
  async getDoctorAvailability(
    @Param('doctorId') doctorId: string,
    @Req() request: Request,
  ) {
    const user = request.user as AuthUser;

    const availability =
      await this.availabilityService.getDoctorAvailability(doctorId, user);

    return {
      success: true,
      message: 'Doctor availability retrieved successfully',
      data: availability,
    };
  }

  // =========================================================
  // GET AVAILABILITY BY ID
  // =========================================================
  @Get('availability/:id')
  async getAvailabilityById(
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    const user = request.user as AuthUser;

    const availability = await this.availabilityService.getAvailabilityById(
      id,
      user,
    );

    return {
      success: true,
      message: 'Availability schedule retrieved successfully',
      data: availability,
    };
  }

  // =========================================================
  // UPDATE AVAILABILITY
  // =========================================================
  @Patch('availability/:id')
  async updateAvailability(
    @Param('id') id: string,
    @Req() request: Request,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    const user = request.user as AuthUser;

    const updated = await this.availabilityService.updateAvailability(
      id,
      dto,
      user,
    );

    return {
      success: true,
      message: 'Availability schedule updated successfully',
      data: updated,
    };
  }

  // =========================================================
  // DELETE AVAILABILITY
  // =========================================================
  @Delete('availability/:id')
  async deleteAvailability(
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    const user = request.user as AuthUser;

    const result = await this.availabilityService.deleteAvailability(
      id,
      user,
    );

    return {
      success: true,
      message: result.message,
    };
  }
}
