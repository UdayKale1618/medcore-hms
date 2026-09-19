import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAvailabilityDto {
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  @Min(0, { message: 'dayOfWeek must be between 0 (Sunday) and 6 (Saturday)' })
  @Max(6, { message: 'dayOfWeek must be between 0 (Sunday) and 6 (Saturday)' })
  dayOfWeek: number;

  @IsNotEmpty()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'startTime must be in HH:mm 24-hour format (e.g. 09:00)',
  })
  startTime: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'endTime must be in HH:mm 24-hour format (e.g. 17:00)',
  })
  endTime: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5, { message: 'slotMinutes must be at least 5 minutes' })
  @Max(240, { message: 'slotMinutes cannot exceed 240 minutes' })
  slotMinutes?: number;
}
