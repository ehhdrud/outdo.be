import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { RefreshToken } from '../../auth/entities/refresh-token.entity';
import { Routine } from '../../routines/entities/routine.entity';
import { RoutineDay } from '../../routines/entities/routine-day.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ name: 'user_pk' })
  user_pk: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  password: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ name: 'google_id', type: 'varchar', length: 255, nullable: true, unique: true })
  google_id: string | null;

  @OneToMany(() => RefreshToken, (refreshToken) => refreshToken.user)
  refreshTokens: RefreshToken[];

  @OneToMany(() => Routine, (routine) => routine.user)
  routines: Routine[];

  @OneToMany(() => RoutineDay, (routineDay) => routineDay.user)
  routineDays: RoutineDay[];
}
