import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Routine } from './entities/routine.entity';
import { RoutineDay } from './entities/routine-day.entity';
import { RoutineDayWorkout } from './entities/routine-day-workout.entity';
import { RoutineDaySet } from './entities/routine-day-set.entity';
import { WorkoutPersonalRecord } from '../dashboard/entities/workout-personal-record.entity';
import {
  CreateRoutineDto,
  SaveRoutineDayDto,
  SaveRoutineDayWithDateDto,
  UpdateRoutineNameDto,
} from './dto/create-routine.dto';

@Injectable()
export class RoutinesService {
  constructor(private readonly dataSource: DataSource) {}

  async createRoutine(userPk: number, dto: CreateRoutineDto) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const routineRepository = manager.getRepository(Routine);
        const routineDayRepository = manager.getRepository(RoutineDay);
        const routineDayWorkoutRepository = manager.getRepository(RoutineDayWorkout);
        const routineDaySetRepository = manager.getRepository(RoutineDaySet);

        const existingRoutine = await routineRepository.findOne({
          where: { user_pk: userPk, routine_name: dto.routine_name },
        });

        if (existingRoutine) {
          throw new ConflictException('이미 존재하는 루틴 이름입니다');
        }

        const today = this.getToday();

        const trimmedName = dto.routine_name.trim();

        if (!trimmedName) {
          throw new BadRequestException('루틴 이름은 비어 있을 수 없습니다');
        }

        const routine = await routineRepository.save({
          user_pk: userPk,
          routine_name: trimmedName,
        });

        const routineDay = await routineDayRepository.save({
          routine_pk: routine.routine_pk,
          user_pk: userPk,
          session_date: today,
        });

        const workoutsWithSets = [];

        for (const workout of dto.workouts ?? []) {
          const savedWorkout = await routineDayWorkoutRepository.save({
            routine_day_pk: routineDay.routine_day_pk,
            workout_name: workout.workout_name,
            order: workout.order ?? 0,
            notes: workout.notes ?? null,
          });

          const sets = [];

          let setOrder = 0;
          for (const set of workout.sets ?? []) {
            const savedSet = await routineDaySetRepository.save({
              routine_day_workout_pk: savedWorkout.routine_day_workout_pk,
              set_order: setOrder,
              weight: set.weight ?? null,
              reps: set.reps,
            });
            sets.push({
              routine_day_set_pk: savedSet.routine_day_set_pk,
              set_order: savedSet.set_order,
              weight: savedSet.weight,
              reps: savedSet.reps,
            });
            setOrder++;
          }

          workoutsWithSets.push({
            routine_day_workout_pk: savedWorkout.routine_day_workout_pk,
            workout_name: savedWorkout.workout_name,
            order: savedWorkout.order,
            notes: savedWorkout.notes,
            sets,
          });

          // 최고 무게 체크 및 업데이트
          if (workout.sets && workout.sets.length > 0) {
            const currentMaxWeight = Math.max(...workout.sets.map((s) => (s.weight ?? 0)));
            if (currentMaxWeight > 0) {
              await this.checkAndUpdateMaxWeight(
                manager,
                userPk,
                workout.workout_name,
                workout.order ?? 0,
                currentMaxWeight,
                today,
                routineDay.routine_day_pk,
              );
            }
          }
        }

        return {
          routine: {
            routine_pk: routine.routine_pk,
            routine_name: routine.routine_name,
          },
          routine_day: {
            routine_day_pk: routineDay.routine_day_pk,
            session_date: routineDay.session_date,
            workouts: workoutsWithSets,
          },
        };
      });
    } catch (error: any) {
      if (error?.code === 'ER_DUP_ENTRY' || error?.code === '23505') {
        throw new ConflictException('이미 존재하는 루틴 이름입니다');
      }
      throw error;
    }
  }

  async getRoutinesWithLatestInfo(userPk: number) {
    const routineRepository = this.dataSource.getRepository(Routine);

    // N+1 쿼리 최적화: 루틴과 모든 routineDays를 한 번에 조회
    const routines = await routineRepository.find({
      where: { user_pk: userPk },
      relations: ['routineDays', 'routineDays.workouts', 'routineDays.workouts.sets'],
      order: { created_at: 'ASC' },
    });

    return routines.map((routine) => {
      // 가장 최근 routineDay 찾기 (session_date 기준 내림차순 정렬 후 첫 번째)
      const sortedDays = (routine.routineDays ?? []).sort(
        (a, b) => b.session_date.localeCompare(a.session_date),
      );
      const latestRoutineDay = sortedDays[0] ?? null;

      return {
        routine_pk: routine.routine_pk,
        routine_name: routine.routine_name,
        last_session_date: latestRoutineDay?.session_date ?? null,
        workouts: this.mapRoutineDayWorkouts(latestRoutineDay),
      };
    });
  }

  async getTodayRoutine(userPk: number, routinePk: number) {
    const { routine, routineDay } = await this.getRoutineDayByDateInternal(userPk, routinePk, this.getToday());

    if (!routineDay) {
      return {
        routine_pk: routine.routine_pk,
        routine_name: routine.routine_name,
        workouts: [],
      };
    }

    return {
      routine_day_pk: routineDay.routine_day_pk,
      session_date: routineDay.session_date,
      workouts: this.mapRoutineDayWorkouts(routineDay),
    };
  }

  async getRoutineByDate(userPk: number, routinePk: number, sessionDate: string) {
    if (!this.isValidDate(sessionDate)) {
      throw new BadRequestException('올바르지 않은 날짜 형식입니다 (YYYY-MM-DD)');
    }

    const { routineDay } = await this.getRoutineDayByDateInternal(userPk, routinePk, sessionDate);

    if (!routineDay) {
      throw new NotFoundException('해당 날짜의 루틴 기록이 없습니다');
    }

    return {
      routine_day_pk: routineDay.routine_day_pk,
      session_date: routineDay.session_date,
      workouts: this.mapRoutineDayWorkouts(routineDay),
    };
  }

  async saveTodayRoutine(userPk: number, routinePk: number, dto: SaveRoutineDayDto) {
    return this.saveRoutineDayInternal(userPk, routinePk, this.getToday(), dto);
  }

  async saveRoutineDay(userPk: number, routinePk: number, dto: SaveRoutineDayWithDateDto) {
    const { session_date: sessionDate } = dto;

    if (!this.isValidDate(sessionDate)) {
      throw new BadRequestException('올바르지 않은 날짜 형식입니다 (YYYY-MM-DD)');
    }

    return this.saveRoutineDayInternal(userPk, routinePk, sessionDate, dto);
  }

  private async saveRoutineDayInternal(
    userPk: number,
    routinePk: number,
    sessionDate: string,
    dto: SaveRoutineDayDto,
  ) {
    const { routine } = await this.getRoutineDayByDateInternal(userPk, routinePk, sessionDate);

    return this.dataSource.transaction(async (manager) => {
      const routineDayRepository = manager.getRepository(RoutineDay);
      const routineDayWorkoutRepository = manager.getRepository(RoutineDayWorkout);
      const routineDaySetRepository = manager.getRepository(RoutineDaySet);

      let routineDay = await routineDayRepository.findOne({
        where: { routine_pk: routine.routine_pk, session_date: sessionDate },
      });

      if (!routineDay) {
        routineDay = await routineDayRepository.save({
          routine_pk: routine.routine_pk,
          user_pk: userPk,
          session_date: sessionDate,
        });
      }

      await routineDayWorkoutRepository.delete({ routine_day_pk: routineDay.routine_day_pk });

      const workoutsWithSets = [];

      for (const workout of dto.workouts ?? []) {
        const savedWorkout = await routineDayWorkoutRepository.save({
          routine_day_pk: routineDay.routine_day_pk,
          workout_name: workout.workout_name,
          order: workout.order ?? 0,
          notes: workout.notes ?? null,
        });

        const sets = [];

        let setOrder = 0;
        for (const set of workout.sets ?? []) {
          const savedSet = await routineDaySetRepository.save({
            routine_day_workout_pk: savedWorkout.routine_day_workout_pk,
            set_order: setOrder,
            weight: set.weight ?? null,
            reps: set.reps,
          });
          sets.push({
            routine_day_set_pk: savedSet.routine_day_set_pk,
            set_order: savedSet.set_order,
            weight: savedSet.weight,
            reps: savedSet.reps,
          });
          setOrder++;
        }

        workoutsWithSets.push({
          routine_day_workout_pk: savedWorkout.routine_day_workout_pk,
          workout_name: savedWorkout.workout_name,
          order: savedWorkout.order,
          notes: savedWorkout.notes,
          sets,
        });

        // 최고 무게 체크 및 업데이트
        if (workout.sets && workout.sets.length > 0) {
          const currentMaxWeight = Math.max(...workout.sets.map((s) => (s.weight ?? 0)));
          if (currentMaxWeight > 0) {
            await this.checkAndUpdateMaxWeight(
              manager,
              userPk,
              workout.workout_name,
              workout.order ?? 0,
              currentMaxWeight,
              sessionDate,
              routineDay.routine_day_pk,
            );
          }
        }
      }

      return {
        routine_day_pk: routineDay.routine_day_pk,
        session_date: routineDay.session_date,
        workouts: workoutsWithSets.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      };
    });
  }

  private async getRoutineDayByDateInternal(userPk: number, routinePk: number, sessionDate: string) {
    const routineRepository = this.dataSource.getRepository(Routine);
    const routineDayRepository = this.dataSource.getRepository(RoutineDay);

    const routine = await routineRepository.findOne({
      where: { routine_pk: routinePk, user_pk: userPk },
    });

    if (!routine) {
      throw new NotFoundException('루틴을 찾을 수 없습니다');
    }

    const routineDay = await routineDayRepository.findOne({
      where: { routine_pk: routinePk, session_date: sessionDate },
      relations: ['workouts', 'workouts.sets'],
      order: { session_date: 'DESC' },
    });

    return { routine, routineDay };
  }

  private mapRoutineDayWorkouts(routineDay?: RoutineDay | null) {
    if (!routineDay?.workouts) {
      return [];
    }

    return routineDay.workouts
      .map((workout) => ({
        routine_day_workout_pk: workout.routine_day_workout_pk,
        workout_name: workout.workout_name,
        order: workout.order,
        notes: workout.notes,
        sets:
          workout.sets
            ?.map((set) => ({
              routine_day_set_pk: set.routine_day_set_pk,
              set_order: set.set_order,
              weight: set.weight,
              reps: set.reps,
            }))
            .sort((a, b) => (a.set_order ?? 0) - (b.set_order ?? 0)) ?? [],
      }))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  private getToday() {
    return this.formatDateToLocal(new Date());
  }

  private formatDateToLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private isValidDate(date: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(date);
  }

  private async checkAndUpdateMaxWeight(
    manager: any,
    userId: number,
    workoutName: string,
    order: number,
    currentMaxWeight: number,
    sessionDate: string,
    routineDayPk: number,
  ) {
    const workoutPersonalRecordRepository = manager.getRepository(WorkoutPersonalRecord);

    // 기존 최고 무게 기록 조회
    const existingRecord = await workoutPersonalRecordRepository.findOne({
      where: {
        user_pk: userId,
        workout_name: workoutName,
        order: order,
      },
    });

    if (!existingRecord || currentMaxWeight > existingRecord.max_weight) {
      // 최고 무게 달성 또는 갱신
      if (existingRecord) {
        // 기존 레코드 업데이트
        existingRecord.max_weight = currentMaxWeight;
        existingRecord.achieved_at = sessionDate;
        existingRecord.routine_day_pk = routineDayPk;
        await workoutPersonalRecordRepository.save(existingRecord);
      } else {
        // 새 레코드 생성
        await workoutPersonalRecordRepository.save({
          user_pk: userId,
          workout_name: workoutName,
          order: order,
          max_weight: currentMaxWeight,
          achieved_at: sessionDate,
          routine_day_pk: routineDayPk,
        });
      }
    }
  }

  async updateRoutineName(userPk: number, routinePk: number, dto: UpdateRoutineNameDto) {
    return this.dataSource.transaction(async (manager) => {
      const routineRepository = manager.getRepository(Routine);

      const routine = await routineRepository.findOne({
        where: { routine_pk: routinePk, user_pk: userPk },
      });

      if (!routine) {
        throw new NotFoundException('루틴을 찾을 수 없습니다');
      }

      const trimmedName = dto.routine_name.trim();

      if (!trimmedName) {
        throw new BadRequestException('루틴 이름은 비어 있을 수 없습니다');
      }

      if (trimmedName === routine.routine_name) {
        return {
          routine_pk: routine.routine_pk,
          routine_name: routine.routine_name,
        };
      }

      const duplicate = await routineRepository.findOne({
        where: { user_pk: userPk, routine_name: trimmedName },
      });

      if (duplicate) {
        throw new ConflictException('이미 존재하는 루틴 이름입니다');
      }

      routine.routine_name = trimmedName;
      const savedRoutine = await routineRepository.save(routine);

      return {
        routine_pk: savedRoutine.routine_pk,
        routine_name: savedRoutine.routine_name,
      };
    });
  }

  async deleteRoutine(userPk: number, routinePk: number) {
    const routineRepository = this.dataSource.getRepository(Routine);

    const routine = await routineRepository.findOne({
      where: { routine_pk: routinePk, user_pk: userPk },
    });

    if (!routine) {
      throw new NotFoundException('루틴을 찾을 수 없습니다');
    }

    await routineRepository.delete({ routine_pk: routine.routine_pk });

    return {
      routine_pk: routine.routine_pk,
      deleted: true,
    };
  }
}

