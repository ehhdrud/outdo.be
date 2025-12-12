import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { Routine } from './routine.entity';
import { RoutineDayWorkout } from './routine-day-workout.entity';

@Entity('routine_days')
@Index('uniq_routine_session_date', ['routine_pk', 'session_date'], { unique: true })
@Index('idx_routine_day_user_pk', ['user_pk'])
@Index('idx_routine_day_session_date', ['session_date'])
export class RoutineDay {
  @PrimaryGeneratedColumn({ name: 'routine_day_pk' })
  routine_day_pk: number;

  @Column({ name: 'routine_pk', type: 'int' })
  routine_pk: number;

  @ManyToOne(() => Routine, (routine) => routine.routineDays, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'routine_pk' })
  routine: Routine;

  @Column({ name: 'user_pk', type: 'int' })
  user_pk: number;

  @Column({ name: 'session_date', type: 'date' })
  session_date: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updated_at: Date;

  @OneToMany(() => RoutineDayWorkout, (workout) => workout.routineDay, { cascade: true })
  workouts: RoutineDayWorkout[];
}

