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
import { LabTestService } from './lab-test.service';
import { CreateLabTestDto } from './dto/create-lab-test.dto';
import { UpdateLabTestDto } from './dto/update-lab-test.dto';
import { LabTestQueryDto } from './dto/lab-test-query.dto';

@Controller('lab-tests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LabTestController {
  constructor(private readonly labTestService: LabTestService) {}

  // =========================================================
  // CREATE LAB TEST
  // =========================================================
  @Post()
  @Roles('HOSPITAL_ADMIN', 'LAB_TECHNICIAN', 'SUPER_ADMIN')
  async createLabTest(
    @Req() request: Request,
    @Body() dto: CreateLabTestDto,
  ) {
    const user = request.user as AuthUser;
    const test = await this.labTestService.createLabTest(dto, user);

    return {
      success: true,
      message: 'Lab test created successfully',
      data: test,
    };
  }

  // =========================================================
  // LIST LAB TESTS
  // =========================================================
  @Get()
  @Roles('DOCTOR', 'NURSE', 'LAB_TECHNICIAN', 'HOSPITAL_ADMIN', 'SUPER_ADMIN')
  async getLabTests(
    @Req() request: Request,
    @Query() query: LabTestQueryDto,
  ) {
    const user = request.user as AuthUser;
    const tests = await this.labTestService.getLabTests(query, user);

    return {
      success: true,
      message: 'Lab tests retrieved successfully',
      data: tests,
    };
  }

  // =========================================================
  // GET LAB TEST BY ID
  // =========================================================
  @Get(':id')
  @Roles('DOCTOR', 'NURSE', 'LAB_TECHNICIAN', 'HOSPITAL_ADMIN', 'SUPER_ADMIN')
  async getLabTestById(
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    const user = request.user as AuthUser;
    const test = await this.labTestService.getLabTestById(id, user);

    return {
      success: true,
      message: 'Lab test retrieved successfully',
      data: test,
    };
  }

  // =========================================================
  // UPDATE LAB TEST
  // =========================================================
  @Patch(':id')
  @Roles('HOSPITAL_ADMIN', 'LAB_TECHNICIAN', 'SUPER_ADMIN')
  async updateLabTest(
    @Param('id') id: string,
    @Req() request: Request,
    @Body() dto: UpdateLabTestDto,
  ) {
    const user = request.user as AuthUser;
    const test = await this.labTestService.updateLabTest(id, dto, user);

    return {
      success: true,
      message: 'Lab test updated successfully',
      data: test,
    };
  }
}
