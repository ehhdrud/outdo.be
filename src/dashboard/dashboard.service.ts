import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, In } from 'typeorm';
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

    // Step 9-2: routine_days 데이터 조회 및 병합 (날짜 범위로 필터링하여 쿼리 최적화)
    const filteredRoutineDays = await this.routineDayRepository.find({
      where: {
        user_pk: userPk,
        session_date: Between(startDate, endDate),
      },
      relations: ['routine', 'workouts', 'workouts.sets'],
      order: {
        session_date: 'ASC',
      },
    });

    // N+1 최적화: 관련 routine_pk들의 모든 routine_days를 한 번에 조회
    const routinePks = [...new Set(filteredRoutineDays.map((rd) => rd.routine_pk))];
    
    // 이전 기록 계산을 위해 해당 루틴들의 모든 routine_days 조회 (한 번에)
    const allRoutineDaysForComparison = routinePks.length > 0
      ? await this.routineDayRepository.find({
          where: { routine_pk: In(routinePks), user_pk: userPk },
          relations: ['workouts', 'workouts.sets'],
          order: { session_date: 'DESC' },
        })
      : [];

    // routine_pk별로 그룹화 (이전 기록 찾기용)
    const routineDaysByRoutinePk = new Map<number, RoutineDay[]>();
    for (const rd of allRoutineDaysForComparison) {
      if (!routineDaysByRoutinePk.has(rd.routine_pk)) {
        routineDaysByRoutinePk.set(rd.routine_pk, []);
      }
      routineDaysByRoutinePk.get(rd.routine_pk)!.push(rd);
    }

    // N+1 최적화: 사용자의 모든 workout_personal_records 한 번에 조회
    const allPersonalRecords = await this.workoutPersonalRecordRepository.find({
      where: { user_pk: userPk },
    });

    // routine_day_pk 또는 achieved_at으로 빠른 조회를 위한 맵 생성
    const personalRecordsByRoutineDayPk = new Map<number, WorkoutPersonalRecord[]>();
    const personalRecordsByKey = new Map<string, WorkoutPersonalRecord>();
    for (const record of allPersonalRecords) {
      if (record.routine_day_pk) {
        if (!personalRecordsByRoutineDayPk.has(record.routine_day_pk)) {
          personalRecordsByRoutineDayPk.set(record.routine_day_pk, []);
        }
        personalRecordsByRoutineDayPk.get(record.routine_day_pk)!.push(record);
      }
      // workout_name + order 키로도 저장
      const key = `${record.workout_name}:${record.order}`;
      personalRecordsByKey.set(key, record);
    }

    // N+1 최적화: 루틴 정보는 이미 filteredRoutineDays에 포함되어 있음 (routine relation)
    // 첫 번째 routine_day 정보도 routineDaysByRoutinePk에서 가져올 수 있음

    // 같은 날짜에 여러 루틴이 있을 수 있으므로, 각 routine_day를 별도의 DayActivity로 추가
    const activitiesWithRoutines: DayActivity[] = [];

    for (const routineDay of filteredRoutineDays) {
      const dateIndex = dates.indexOf(routineDay.session_date);
      if (dateIndex === -1) continue;

      const activity: DayActivity = {
        date: routineDay.session_date,
        activity: 1, // 기본값 1
        routine_name: routineDay.routine.routine_name,
        routine_pk: routineDay.routine.routine_pk,
        routine_day_pk: routineDay.routine_day_pk,
        achievement: null,
        has_max_weight_achieved: false,
        max_weight_records: null,
        is_new_routine: false,
      };

      // 이전 기록 찾기 (메모리에서)
      const routineDays = routineDaysByRoutinePk.get(routineDay.routine_pk) ?? [];
      const previousRoutineDay = routineDays.find((rd) => rd.session_date < routineDay.session_date);

      if (previousRoutineDay) {
        this.calculateAchievementSync(activity, routineDay, previousRoutineDay);
      }

      // 최고 무게 달성 체크 (메모리에서)
      this.checkMaxWeightAchievementSync(
        activity,
        routineDay,
        personalRecordsByRoutineDayPk,
        personalRecordsByKey,
      );

      // 새로운 루틴 생성 체크 (메모리에서)
      this.checkNewRoutineSync(activity, routineDay, routineDays);

      // activity 업데이트
      if (
        (activity.achievement !== null && activity.achievement > 0) ||
        activity.has_max_weight_achieved ||
        activity.is_new_routine
      ) {
        activity.activity = 2;
      }

      activitiesWithRoutines.push(activity);
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
    // N+1 최적화: 모든 routine_days를 한 번에 조회 (최신순)
    const routineDays = await this.routineDayRepository.find({
      where: {
        user_pk: userPk,
      },
      relations: ['routine', 'workouts', 'workouts.sets'],
      order: {
        session_date: 'DESC',
      },
    });

    // routine_pk별로 그룹화 (이전 기록 찾기용)
    const routineDaysByRoutinePk = new Map<number, RoutineDay[]>();
    for (const rd of routineDays) {
      if (!routineDaysByRoutinePk.has(rd.routine_pk)) {
        routineDaysByRoutinePk.set(rd.routine_pk, []);
      }
      routineDaysByRoutinePk.get(rd.routine_pk)!.push(rd);
    }

    const achievements: AchievementDetail[] = [];

    for (const routineDay of routineDays) {
      // 이전 기록 찾기 (메모리에서 - N+1 해결)
      const routineDaysForPk = routineDaysByRoutinePk.get(routineDay.routine_pk) ?? [];
      const previousRoutineDay = routineDaysForPk.find((rd) => rd.session_date < routineDay.session_date);

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

        // 5개 달성하면 조기 종료 (성능 최적화)
        if (achievements.length >= 5) {
          break;
        }
      }
    }

    return achievements;
  }

  // Sync 버전: N+1 최적화용 (메모리에서 처리)
  private calculateAchievementSync(
    activity: DayActivity,
    currentRoutineDay: RoutineDay,
    previousRoutineDay: RoutineDay,
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

  // Sync 버전: N+1 최적화용 (메모리에서 처리)
  private checkMaxWeightAchievementSync(
    activity: DayActivity,
    routineDay: RoutineDay,
    personalRecordsByRoutineDayPk: Map<number, WorkoutPersonalRecord[]>,
    personalRecordsByKey: Map<string, WorkoutPersonalRecord>,
  ) {
    const maxWeightRecords: MaxWeightRecord[] = [];

    for (const workout of routineDay.workouts || []) {
      if (!workout.sets || workout.sets.length === 0) continue;

      // workout_name + order 키로 조회
      const key = `${workout.workout_name}:${workout.order}`;
      const maxWeightRecord = personalRecordsByKey.get(key);

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

  // Sync 버전: N+1 최적화용 (메모리에서 처리)
  private checkNewRoutineSync(
    activity: DayActivity,
    routineDay: RoutineDay,
    allRoutineDaysForRoutine: RoutineDay[],
  ) {
    // routine 정보는 이미 routineDay.routine에 포함되어 있음
    const routine = routineDay.routine;
    if (!routine) return;

    const routineCreatedDate = this.formatDateToLocal(new Date(routine.created_at));

    if (routineCreatedDate === routineDay.session_date) {
      activity.is_new_routine = true;
      return;
    }

    // 첫 번째 routine_day가 해당 날짜인지 확인 (이미 정렬된 배열에서 마지막이 가장 오래된 것)
    const sortedDays = [...allRoutineDaysForRoutine].sort((a, b) =>
      a.session_date.localeCompare(b.session_date),
    );
    const firstRoutineDay = sortedDays[0];

    if (firstRoutineDay && firstRoutineDay.session_date === routineDay.session_date) {
      activity.is_new_routine = true;
    }
  }

  private generateDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    // 날짜 문자열을 로컬 날짜로 파싱 (시간대 문제 방지)
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
    const start = new Date(startYear, startMonth - 1, startDay);
    const end = new Date(endYear, endMonth - 1, endDay);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(this.formatDateToLocal(d));
    }

    return dates;
  }

  private formatDateToLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private isValidDate(date: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(date);
  }
}

