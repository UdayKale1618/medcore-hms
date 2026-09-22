import { IsEnum, IsNotEmpty } from 'class-validator';

export enum AppointmentStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export class UpdateAppointmentStatusDto {
  @IsNotEmpty({ message: 'status is required' })
  @IsEnum(AppointmentStatus, {
    message:
      'status must be one of: PENDING, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW',
  })
  status: AppointmentStatus;
}
