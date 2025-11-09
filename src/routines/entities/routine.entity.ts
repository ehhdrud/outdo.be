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
import { User } from '../../users/entities/user.entity';
import { RoutineDay } from './routine-day.entity';

@Entity('routines')
@Index('uniq_user_routine_name', ['user_pk', 'routine_name'], { unique: true })
export class Routine {
  @PrimaryGeneratedColumn({ name: 'routine_pk' })
  routine_pk: number;

  @Column({ name: 'user_pk', type: 'int' })
  user_pk: number;

  @ManyToOne(() => User, (user) => user.routines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_pk' })
  user: User;

  @Column({ name: 'routine_name', type: 'varchar', length: 100 })
  routine_name: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updated_at: Date;

  @OneToMany(() => RoutineDay, (routineDay) => routineDay.routine)
  routineDays: RoutineDay[];
}

