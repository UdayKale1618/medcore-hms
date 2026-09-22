import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { AppointmentType } from './create-appointment.dto';

export class UpdateAppointmentDto {
  @IsOptional()
  @IsUUID('4', { message: 'doctorId must be a valid UUID' })
  doctorId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'departmentId must be a valid UUID' })
  departmentId?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'appointmentDate must be a valid ISO8601 date string' })
  appointmentDate?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'startTime must be a valid ISO8601 datetime string' })
  startTime?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'endTime must be a valid ISO8601 datetime string' })
  endTime?: string;

  @IsOptional()
  @IsEnum(AppointmentType, {
    message: 'type must be REGULAR, EMERGENCY, or FOLLOW_UP',
  })
  type?: AppointmentType;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
