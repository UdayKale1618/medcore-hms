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
import { LabOrderService } from './lab-order.service';
import { CreateLabOrderDto } from './dto/create-lab-order.dto';
import { UpdateLabOrderDto } from './dto/update-lab-order.dto';
import { UpdateLabOrderStatusDto } from './dto/update-lab-order-status.dto';
import { LabOrderQueryDto } from './dto/lab-order-query.dto';

@Controller('lab-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LabOrderController {
  constructor(private readonly labOrderService: LabOrderService) {}

  // =========================================================
  // CREATE LAB ORDER (Doctor Encounter)
  // =========================================================
  @Post()
  @Roles('DOCTOR', 'SUPER_ADMIN')
  async createLabOrder(
    @Req() request: Request,
    @Body() dto: CreateLabOrderDto,
  ) {
    const user = request.user as AuthUser;
    const order = await this.labOrderService.createLabOrder(dto, user);

    return {
      success: true,
      message: 'Lab order created successfully',
      data: order,
    };
  }

  // =========================================================
  // GET LAB ORDERS BY MEDICAL RECORD ID
  // Placed before :id to prevent collision
  // =========================================================
  @Get('medical-record/:medicalRecordId')
  @Roles('DOCTOR', 'NURSE', 'LAB_TECHNICIAN', 'HOSPITAL_ADMIN', 'PATIENT', 'SUPER_ADMIN')
  async getLabOrdersByMedicalRecordId(
    @Param('medicalRecordId') medicalRecordId: string,
    @Req() request: Request,
  ) {
    const user = request.user as AuthUser;
    const orders =
      await this.labOrderService.getLabOrdersByMedicalRecordId(
        medicalRecordId,
        user,
      );

    return {
      success: true,
      message: 'Medical record lab orders retrieved successfully',
      data: orders,
    };
  }

  // =========================================================
  // LIST LAB ORDERS
  // =========================================================
  @Get()
  @Roles('DOCTOR', 'NURSE', 'LAB_TECHNICIAN', 'HOSPITAL_ADMIN', 'PATIENT', 'SUPER_ADMIN')
  async getLabOrders(
    @Req() request: Request,
    @Query() query: LabOrderQueryDto,
  ) {
    const user = request.user as AuthUser;
    const orders = await this.labOrderService.getLabOrders(query, user);

    return {
      success: true,
      message: 'Lab orders retrieved successfully',
      data: orders,
    };
  }

  // =========================================================
  // GET LAB ORDER BY ID
  // =========================================================
  @Get(':id')
  @Roles('DOCTOR', 'NURSE', 'LAB_TECHNICIAN', 'HOSPITAL_ADMIN', 'PATIENT', 'SUPER_ADMIN')
  async getLabOrderById(
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    const user = request.user as AuthUser;
    const order = await this.labOrderService.getLabOrderById(id, user);

    return {
      success: true,
      message: 'Lab order retrieved successfully',
      data: order,
    };
  }

  // =========================================================
  // UPDATE LAB ORDER STATUS (Workflow)
  // Must be placed before :id or specific route
  // =========================================================
  @Patch(':id/status')
  @Roles('LAB_TECHNICIAN', 'DOCTOR', 'HOSPITAL_ADMIN', 'SUPER_ADMIN')
  async updateLabOrderStatus(
    @Param('id') id: string,
    @Req() request: Request,
    @Body() dto: UpdateLabOrderStatusDto,
  ) {
    const user = request.user as AuthUser;
    const order = await this.labOrderService.updateLabOrderStatus(
      id,
      dto,
      user,
    );

    return {
      success: true,
      message: 'Lab order status updated successfully',
      data: order,
    };
  }

  // =========================================================
  // UPDATE LAB ORDER (Results / Findings)
  // =========================================================
  @Patch(':id')
  @Roles('LAB_TECHNICIAN', 'DOCTOR', 'HOSPITAL_ADMIN', 'SUPER_ADMIN')
  async updateLabOrder(
    @Param('id') id: string,
    @Req() request: Request,
    @Body() dto: UpdateLabOrderDto,
  ) {
    const user = request.user as AuthUser;
    const order = await this.labOrderService.updateLabOrder(id, dto, user);

    return {
      success: true,
      message: 'Lab order updated successfully',
      data: order,
    };
  }
}
