import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Routine } from './routine.entity';
import { User } from '../../users/entities/user.entity';
import { RoutineDayWorkout } from './routine-day-workout.entity';

@Entity('routine_days')
@Index('uniq_routine_date', ['routine_pk', 'session_date'], { unique: true })
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

  @ManyToOne(() => User, (user) => user.routineDays, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_pk' })
  user: User;

  @Column({ name: 'session_date', type: 'date' })
  session_date: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updated_at: Date;

  @OneToMany(() => RoutineDayWorkout, (workout) => workout.routineDay)
  workouts: RoutineDayWorkout[];
}

