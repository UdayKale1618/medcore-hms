import {
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export enum AppointmentType {
  REGULAR = 'REGULAR',
  EMERGENCY = 'EMERGENCY',
  FOLLOW_UP = 'FOLLOW_UP',
}

export class CreateAppointmentDto {
  @IsNotEmpty({ message: 'doctorId is required' })
  @IsUUID('4', { message: 'doctorId must be a valid UUID' })
  doctorId: string;

  @IsOptional()
  @IsUUID('4', { message: 'patientId must be a valid UUID' })
  patientId?: string;

  @IsNotEmpty({ message: 'departmentId is required' })
  @IsUUID('4', { message: 'departmentId must be a valid UUID' })
  departmentId: string;

  @IsNotEmpty({ message: 'appointmentDate is required' })
  @IsISO8601({}, { message: 'appointmentDate must be a valid ISO8601 date string' })
  appointmentDate: string;

  @IsNotEmpty({ message: 'startTime is required' })
  @IsISO8601({}, { message: 'startTime must be a valid ISO8601 datetime string' })
  startTime: string;

  @IsNotEmpty({ message: 'endTime is required' })
  @IsISO8601({}, { message: 'endTime must be a valid ISO8601 datetime string' })
  endTime: string;

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

  @IsOptional()
  @IsUUID('4', { message: 'hospitalId must be a valid UUID' })
  hospitalId?: string;
}
