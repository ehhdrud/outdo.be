import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { RoutineDay } from './routine-day.entity';
import { RoutineDaySet } from './routine-day-set.entity';

@Entity('routine_day_workouts')
@Index('idx_day_order', ['routine_day_pk', 'order'])
export class RoutineDayWorkout {
  @PrimaryGeneratedColumn({ name: 'routine_day_workout_pk' })
  routine_day_workout_pk: number;

  @Column({ name: 'routine_day_pk', type: 'int' })
  routine_day_pk: number;

  @ManyToOne(() => RoutineDay, (routineDay) => routineDay.workouts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'routine_day_pk' })
  routineDay: RoutineDay;

  @Column({ name: 'workout_name', type: 'varchar', length: 100 })
  workout_name: string;

  @Column({ name: 'order', type: 'int', default: 0 })
  order: number;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @OneToMany(() => RoutineDaySet, (set) => set.routineDayWorkout)
  sets: RoutineDaySet[];
}

