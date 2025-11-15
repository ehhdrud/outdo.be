import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { RoutineDayWorkout } from './routine-day-workout.entity';

@Entity('routine_day_sets')
export class RoutineDaySet {
  @PrimaryGeneratedColumn({ name: 'routine_day_set_pk' })
  routine_day_set_pk: number;

  @Column({ name: 'routine_day_workout_pk', type: 'int' })
  routine_day_workout_pk: number;

  @ManyToOne(() => RoutineDayWorkout, (workout) => workout.sets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'routine_day_workout_pk' })
  workout: RoutineDayWorkout;

  @Column({ name: 'weight', type: 'decimal', precision: 5, scale: 2, nullable: true })
  weight: number | null;

  @Column({ name: 'reps', type: 'int' })
  reps: number;
}

