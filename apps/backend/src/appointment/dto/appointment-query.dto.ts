import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { AppointmentType } from './create-appointment.dto';
import { AppointmentStatus } from './update-appointment-status.dto';

export class AppointmentQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'doctorId must be a valid UUID' })
  doctorId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'patientId must be a valid UUID' })
  patientId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'departmentId must be a valid UUID' })
  departmentId?: string;

  @IsOptional()
  @IsEnum(AppointmentStatus, {
    message:
      'status must be one of: PENDING, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW',
  })
  status?: AppointmentStatus;

  @IsOptional()
  @IsEnum(AppointmentType, {
    message: 'type must be REGULAR, EMERGENCY, or FOLLOW_UP',
  })
  type?: AppointmentType;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
  date?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'startDate must be a valid ISO8601 string' })
  startDate?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'endDate must be a valid ISO8601 string' })
  endDate?: string;

  @IsOptional()
  @IsUUID('4', { message: 'hospitalId must be a valid UUID' })
  hospitalId?: string;
}
