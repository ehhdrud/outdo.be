import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Routine } from '../routines/entities/routine.entity';
import { RoutineDay } from '../routines/entities/routine-day.entity';
import { WorkoutPersonalRecord } from './entities/workout-personal-record.entity';

export interface DayActivity {
  date: string;
  activity: number;
  routine_name: string | null;
  routine_pk: number | null;
  routine_day_pk: number | null;
  achievement: number | null;
  has_max_weight_achieved: boolean;
  max_weight_records: MaxWeightRecord[] | null;
  is_new_routine: boolean;
}

export interface MaxWeightRecord {
  workout_name: string;
  order: number;
  max_weight: number;
}

export interface AchievementDetail {
  date: string;
  routine_name: string;
  routine_pk: number;
  routine_day_pk: number;
  achievement: number;
  workouts: AchievementWorkout[];
}

export interface AchievementWorkout {
  workout_name: string;
  order: number;
  weight_increase: number;
  previous_max_weight: number;
  current_max_weight: number;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Routine)
    private readonly routineRepository: Repository<Routine>,
    @InjectRepository(RoutineDay)
    private readonly routineDayRepository: Repository<RoutineDay>,
    @InjectRepository(WorkoutPersonalRecord)
    private readonly workoutPersonalRecordRepository: Repository<WorkoutPersonalRecord>,
    private readonly dataSource: DataSource,
  ) {}

  async getActivities(userPk: number, startDate: string, endDate: string): Promise<DayActivity[]> {
    // Step 9-1: 날짜 범위 검증 및 기본 구조 생성
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate와 endDate는 필수 파라미터입니다');
    }

    if (!this.isValidDate(startDate) || !this.isValidDate(endDate)) {
      throw new BadRequestException('날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)');
    }

    if (startDate > endDate) {
      throw new BadRequestException('startDate는 endDate보다 작거나 같아야 합니다');
    }

    // 모든 날짜 배열 생성
    const dates = this.generateDateRange(startDate, endDate);
    const dayActivities: DayActivity[] = dates.map((date) => ({
      date,
      activity: 0,
      routine_name: null,
      routine_pk: null,
      routine_day_pk: null,
      achievement: null,
      has_max_weight_achieved: false,
      max_weight_records: null,
      is_new_routine: false,
    }));

    // Step 9-2: routine_days 데이터 조회 및 병합
    const routineDays = await this.routineDayRepository.find({
      where: {
        user_pk: userPk,
      },
      relations: ['routine', 'workouts', 'workouts.sets'],
      order: {
        session_date: 'ASC',
      },
    });

    // 날짜 범위 내의 routine_days만 필터링
    const filteredRoutineDays = routineDays.filter(
      (rd) => rd.session_date >= startDate && rd.session_date <= endDate,
    );

    // 같은 날짜에 여러 루틴이 있을 수 있으므로, 각 routine_day를 별도의 DayActivity로 추가
    const activitiesWithRoutines: DayActivity[] = [];

    for (const routineDay of filteredRoutineDays) {
      const dateIndex = dates.indexOf(routineDay.session_date);
      if (dateIndex === -1) continue;

      activitiesWithRoutines.push({
        date: routineDay.session_date,
        activity: 1, // 기본값 1
        routine_name: routineDay.routine.routine_name,
        routine_pk: routineDay.routine.routine_pk,
        routine_day_pk: routineDay.routine_day_pk,
        achievement: null, // 나중에 계산
        has_max_weight_achieved: false,
        max_weight_records: null,
        is_new_routine: false,
      });
    }

    // Step 9-3: Achievement 계산 및 Activity 업데이트
    for (const activity of activitiesWithRoutines) {
      if (!activity.routine_day_pk) continue;

      const routineDay = filteredRoutineDays.find((rd) => rd.routine_day_pk === activity.routine_day_pk);
      if (!routineDay) continue;

      // 이전 기록 조회 (현재 날짜보다 이전, 같은 routine_pk의 가장 최근 기록)
      const earlierDays = await this.routineDayRepository.find({
        where: {
          routine_pk: routineDay.routine_pk,
          user_pk: userPk,
        },
        relations: ['workouts', 'workouts.sets'],
        order: {
          session_date: 'DESC',
        },
      });

      // 현재 날짜보다 이전인 가장 최근 기록 찾기
      const previousRoutineDay = earlierDays.find((rd) => rd.session_date < routineDay.session_date);

      if (previousRoutineDay) {
        await this.calculateAchievement(activity, routineDay, previousRoutineDay, userPk);
      } else {
        // 이전 기록이 없음
        activity.achievement = null;
      }

      // 최고 무게 달성 체크
      await this.checkMaxWeightAchievement(activity, routineDay, userPk);

      // 새로운 루틴 생성 체크
      await this.checkNewRoutine(activity, routineDay, userPk);

      // activity 업데이트
      if (
        (activity.achievement !== null && activity.achievement > 0) ||
        activity.has_max_weight_achieved ||
        activity.is_new_routine
      ) {
        activity.activity = 2;
      } else {
        activity.activity = 1;
      }
    }

    // 빈 날짜와 루틴이 있는 날짜를 합쳐서 반환 (날짜순 정렬)
    const result: DayActivity[] = [];
    const activityMap = new Map<string, DayActivity[]>();
    
    // 루틴이 있는 날짜들을 날짜별로 그룹화
    for (const activity of activitiesWithRoutines) {
      if (!activityMap.has(activity.date)) {
        activityMap.set(activity.date, []);
      }
      activityMap.get(activity.date)!.push(activity);
    }

    // 모든 날짜에 대해 처리
    for (const date of dates) {
      const activities = activityMap.get(date);
      if (activities && activities.length > 0) {
        // 같은 날짜에 여러 루틴이 있으면 모두 추가 (routine_pk 순으로 정렬하여 일관성 유지)
        activities.sort((a, b) => (a.routine_pk ?? 0) - (b.routine_pk ?? 0));
        result.push(...activities);
      } else {
        // 루틴이 없는 날짜
        result.push({
          date,
          activity: 0,
          routine_name: null,
          routine_pk: null,
          routine_day_pk: null,
          achievement: null,
          has_max_weight_achieved: false,
          max_weight_records: null,
          is_new_routine: false,
        });
      }
    }

    return result;
  }

  async getAchievements(userPk: number): Promise<AchievementDetail[]> {
    // 모든 routine_days 조회 (최신순)
    const routineDays = await this.routineDayRepository.find({
      where: {
        user_pk: userPk,
      },
      relations: ['routine', 'workouts', 'workouts.sets'],
      order: {
        session_date: 'DESC',
      },
    });

    const achievements: AchievementDetail[] = [];

    for (const routineDay of routineDays) {
      // 이전 기록 조회
      const earlierDays = await this.routineDayRepository.find({
        where: {
          routine_pk: routineDay.routine_pk,
          user_pk: userPk,
        },
        relations: ['workouts', 'workouts.sets'],
        order: {
          session_date: 'DESC',
        },
      });

      const previousRoutineDay = earlierDays.find((rd) => rd.session_date < routineDay.session_date);

      if (!previousRoutineDay) {
        continue; // 이전 기록이 없으면 스킵
      }

      // achievement 계산
      const achievementWorkouts: AchievementWorkout[] = [];
      let totalAchievement = 0;

      for (const currentWorkout of routineDay.workouts || []) {
        const previousWorkout = previousRoutineDay.workouts?.find(
          (w) => w.workout_name === currentWorkout.workout_name && w.order === currentWorkout.order,
        );

        if (!previousWorkout) continue;

        const currentTotalVolume = (currentWorkout.sets || []).reduce(
          (sum, set) => sum + (set.weight ?? 0) * set.reps,
          0,
        );
        const previousTotalVolume = (previousWorkout.sets || []).reduce(
          (sum, set) => sum + (set.weight ?? 0) * set.reps,
          0,
        );

        if (currentTotalVolume > previousTotalVolume) {
          const weightIncrease = currentTotalVolume - previousTotalVolume;
          totalAchievement += weightIncrease;

          achievementWorkouts.push({
            workout_name: currentWorkout.workout_name,
            order: currentWorkout.order,
            weight_increase: weightIncrease,
            previous_max_weight: previousTotalVolume,
            current_max_weight: currentTotalVolume,
          });
        }
      }

      if (totalAchievement > 0) {
        achievements.push({
          date: routineDay.session_date,
          routine_name: routineDay.routine.routine_name,
          routine_pk: routineDay.routine_pk,
          routine_day_pk: routineDay.routine_day_pk,
          achievement: totalAchievement,
          workouts: achievementWorkouts,
        });
      }
    }

    // 최대 5개만 반환
    return achievements.slice(0, 5);
  }

  private async calculateAchievement(
    activity: DayActivity,
    currentRoutineDay: RoutineDay,
    previousRoutineDay: RoutineDay,
    userPk: number,
  ) {
    activity.achievement = 0; // 이전 기록이 있으면 0으로 초기화

    for (const currentWorkout of currentRoutineDay.workouts || []) {
      const previousWorkout = previousRoutineDay.workouts?.find(
        (w) => w.workout_name === currentWorkout.workout_name && w.order === currentWorkout.order,
      );

      if (previousWorkout) {
        const currentTotalVolume = (currentWorkout.sets || []).reduce(
          (sum, set) => sum + (set.weight ?? 0) * set.reps,
          0,
        );
        const previousTotalVolume = (previousWorkout.sets || []).reduce(
          (sum, set) => sum + (set.weight ?? 0) * set.reps,
          0,
        );

        if (currentTotalVolume > previousTotalVolume) {
          activity.achievement! += currentTotalVolume - previousTotalVolume;
        }
      }
    }
  }

  private async checkMaxWeightAchievement(
    activity: DayActivity,
    routineDay: RoutineDay,
    userPk: number,
  ) {
    const maxWeightRecords: MaxWeightRecord[] = [];

    for (const workout of routineDay.workouts || []) {
      if (!workout.sets || workout.sets.length === 0) continue;

      const currentMaxWeight = Math.max(...workout.sets.map((s) => s.weight ?? 0));

      // workout_personal_records에서 해당 날짜에 달성한 기록 조회
      // routine_day_pk가 일치하거나 achieved_at이 해당 날짜인 경우
      const maxWeightRecord = await this.workoutPersonalRecordRepository.findOne({
        where: {
          user_pk: userPk,
          workout_name: workout.workout_name,
          order: workout.order,
        },
      });

      // 해당 routine_day_pk에 달성한 기록이 있는지 확인
      // 또는 achieved_at이 해당 날짜인 경우
      if (
        maxWeightRecord &&
        (maxWeightRecord.routine_day_pk === routineDay.routine_day_pk ||
          maxWeightRecord.achieved_at === routineDay.session_date)
      ) {
        activity.has_max_weight_achieved = true;
        maxWeightRecords.push({
          workout_name: workout.workout_name,
          order: workout.order,
          max_weight: Number(maxWeightRecord.max_weight),
        });
      }
    }

    if (maxWeightRecords.length > 0) {
      activity.max_weight_records = maxWeightRecords;
    } else {
      activity.max_weight_records = null;
    }
  }

  private async checkNewRoutine(activity: DayActivity, routineDay: RoutineDay, userPk: number) {
    // routine_pk의 created_at이 해당 날짜와 같은지 확인
    const routine = await this.routineRepository.findOne({
      where: {
        routine_pk: routineDay.routine_pk,
        user_pk: userPk,
      },
    });

    if (!routine) return;

    const routineCreatedDate = new Date(routine.created_at).toISOString().split('T')[0];

    if (routineCreatedDate === routineDay.session_date) {
      activity.is_new_routine = true;
      return;
    }

    // 첫 번째 routine_day가 해당 날짜인지 확인
    const firstRoutineDay = await this.routineDayRepository.findOne({
      where: {
        routine_pk: routineDay.routine_pk,
        user_pk: userPk,
      },
      order: {
        session_date: 'ASC',
      },
    });

    if (firstRoutineDay && firstRoutineDay.session_date === routineDay.session_date) {
      activity.is_new_routine = true;
    }
  }

  private generateDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }

    return dates;
  }

  private isValidDate(date: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(date);
  }
}

