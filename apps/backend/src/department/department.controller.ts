import {
  BadRequestException,
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
import { DepartmentService } from './department.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Controller('departments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  // =========================================================
  // CREATE DEPARTMENT
  // =========================================================
  @Post()
  @Roles('HOSPITAL_ADMIN', 'SUPER_ADMIN')
  async createDepartment(
    @Req() request: Request,
    @Body() dto: CreateDepartmentDto,
  ) {
    const user = request.user as AuthUser;

    const hospitalId =
      user.role === 'SUPER_ADMIN'
        ? dto.hospitalId || user.hospitalId
        : user.hospitalId;

    if (!hospitalId) {
      throw new BadRequestException('Hospital ID is required');
    }

    const department = await this.departmentService.createDepartment(
      hospitalId,
      dto,
    );

    return {
      success: true,
      message: 'Department created successfully',
      data: department,
    };
  }

  // =========================================================
  // LIST DEPARTMENTS (Tenant-isolated for non-super-admins)
  // =========================================================
  @Get()
  async getDepartments(
    @Req() request: Request,
    @Query('hospitalId') queryHospitalId?: string,
  ) {
    const user = request.user as AuthUser;

    let hospitalId: string | undefined;

    if (user.role === 'SUPER_ADMIN') {
      hospitalId = queryHospitalId || user.hospitalId || undefined;
    } else {
      hospitalId = user.hospitalId;
      if (!hospitalId) {
        throw new BadRequestException('No hospital associated with this user');
      }
    }

    const departments =
      await this.departmentService.getDepartments(hospitalId);

    return {
      success: true,
      message: 'Departments retrieved successfully',
      data: departments,
    };
  }

  // =========================================================
  // GET DEPARTMENT BY ID (With tenant isolation)
  // =========================================================
  @Get(':id')
  async getDepartmentById(
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    const user = request.user as AuthUser;

    const department = await this.departmentService.getDepartmentById(
      id,
      user,
    );

    return {
      success: true,
      message: 'Department details retrieved successfully',
      data: department,
    };
  }

  // =========================================================
  // UPDATE DEPARTMENT (With tenant isolation & RBAC)
  // =========================================================
  @Patch(':id')
  @Roles('HOSPITAL_ADMIN', 'SUPER_ADMIN')
  async updateDepartment(
    @Param('id') id: string,
    @Req() request: Request,
    @Body() dto: UpdateDepartmentDto,
  ) {
    const user = request.user as AuthUser;

    const updated = await this.departmentService.updateDepartment(
      id,
      dto,
      user,
    );

    return {
      success: true,
      message: 'Department updated successfully',
      data: updated,
    };
  }

  // =========================================================
  // DELETE DEPARTMENT (With tenant isolation & RBAC)
  // =========================================================
  @Delete(':id')
  @Roles('HOSPITAL_ADMIN', 'SUPER_ADMIN')
  async deleteDepartment(
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    const user = request.user as AuthUser;

    const result = await this.departmentService.deleteDepartment(id, user);

    return {
      success: true,
      message: result.message,
    };
  }
}
