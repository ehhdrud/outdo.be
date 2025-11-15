import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoutinesController } from './routines.controller';
import { RoutinesService } from './routines.service';
import { Routine } from './entities/routine.entity';
import { RoutineDay } from './entities/routine-day.entity';
import { RoutineDayWorkout } from './entities/routine-day-workout.entity';
import { RoutineDaySet } from './entities/routine-day-set.entity';
import { WorkoutPersonalRecord } from '../dashboard/entities/workout-personal-record.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Routine,
      RoutineDay,
      RoutineDayWorkout,
      RoutineDaySet,
      WorkoutPersonalRecord,
    ]),
  ],
  controllers: [RoutinesController],
  providers: [RoutinesService],
  exports: [RoutinesService],
})
export class RoutinesModule {}

