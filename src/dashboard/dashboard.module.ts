import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Routine } from '../routines/entities/routine.entity';
import { RoutineDay } from '../routines/entities/routine-day.entity';
import { WorkoutPersonalRecord } from './entities/workout-personal-record.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Routine, RoutineDay, WorkoutPersonalRecord])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}

