import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Routine } from './entities/routine.entity';
import { RoutineDay } from './entities/routine-day.entity';
import { RoutineDayWorkout } from './entities/routine-day-workout.entity';
import { RoutineDaySet } from './entities/routine-day-set.entity';
import { RoutinesService } from './routines.service';
import { RoutinesController } from './routines.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Routine, RoutineDay, RoutineDayWorkout, RoutineDaySet])],
  controllers: [RoutinesController],
  providers: [RoutinesService],
})
export class RoutinesModule {}

