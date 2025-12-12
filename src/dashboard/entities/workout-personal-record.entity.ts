import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('workout_personal_records')
@Index('uniq_user_workout_order', ['user_pk', 'workout_name', 'order'], { unique: true })
@Index('idx_workout_pr_routine_day_pk', ['routine_day_pk'])
@Index('idx_workout_pr_achieved_at', ['achieved_at'])
export class WorkoutPersonalRecord {
  @PrimaryGeneratedColumn({ name: 'record_pk' })
  record_pk: number;

  @Column({ name: 'user_pk', type: 'int' })
  user_pk: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_pk' })
  user: User;

  @Column({ name: 'workout_name', type: 'varchar', length: 100 })
  workout_name: string;

  @Column({ name: 'order', type: 'int' })
  order: number;

  @Column({ name: 'max_weight', type: 'decimal', precision: 5, scale: 2 })
  max_weight: number;

  @Column({ name: 'achieved_at', type: 'date' })
  achieved_at: string;

  @Column({ name: 'routine_day_pk', type: 'int', nullable: true })
  routine_day_pk: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updated_at: Date;
}

