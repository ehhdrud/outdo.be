import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('refresh_tokens')
@Index(['user_pk', 'token'])
export class RefreshToken {
	@PrimaryGeneratedColumn({ name: 'token_pk' })
	token_pk: number;

	@Column({ name: 'user_pk' })
	user_pk: number;

	@Column({ type: 'varchar', length: 500 })
	token: string;

	@Column({ name: 'expires_at', type: 'timestamp' })
	expires_at: Date;

	@ManyToOne(() => User, (user) => user.refreshTokens, {
		onDelete: 'CASCADE',
	})
	@JoinColumn({ name: 'user_pk' })
	user: User;

	@Column({
		name: 'created_at',
		type: 'datetime',
		nullable: false,
	})
	created_at: Date;
}
