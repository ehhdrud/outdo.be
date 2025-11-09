import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateSetDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  weight?: number | null;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  reps: number;
}

export class CreateWorkoutDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  workout_name: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSetDto)
  sets: CreateSetDto[];
}

export class CreateRoutineDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  routine_name: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkoutDto)
  workouts: CreateWorkoutDto[];
}

export class SaveRoutineDayDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkoutDto)
  workouts?: CreateWorkoutDto[];
}

export class SaveRoutineDayWithDateDto extends SaveRoutineDayDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  session_date: string;
}

export class UpdateRoutineNameDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  routine_name: string;
}

