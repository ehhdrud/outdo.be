import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
	constructor(
		@InjectRepository(User)
		private userRepository: Repository<User>
	) {}

	async getProfile(userPk: number): Promise<Omit<User, 'password'>> {
		const user = await this.userRepository.findOne({
			where: { user_pk: userPk },
		});

		if (!user) {
			throw new NotFoundException('사용자를 찾을 수 없습니다');
		}

		// password 제외하고 반환
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { password, ...userWithoutPassword } = user;
		return userWithoutPassword as Omit<User, 'password'>;
	}

	async updateProfile(userPk: number, updateProfileDto: UpdateProfileDto): Promise<Omit<User, 'password'>> {
		const user = await this.userRepository.findOne({
			where: { user_pk: userPk },
		});

		if (!user) {
			throw new NotFoundException('사용자를 찾을 수 없습니다');
		}

		// DTO에 있는 필드만 업데이트
		if (updateProfileDto.name !== undefined && updateProfileDto.name !== null) {
			// name은 NOT NULL이므로 빈 문자열 체크
			const trimmedName = updateProfileDto.name.trim();
			if (trimmedName.length === 0) {
				throw new BadRequestException('이름은 비어있을 수 없습니다');
			}
			user.name = trimmedName;
		}
		if (updateProfileDto.bio !== undefined) {
			// bio는 nullable이므로 null이면 null로, 문자열이면 trim 후 빈 문자열이면 null로
			if (updateProfileDto.bio === null) {
				user.bio = null;
			} else {
				user.bio = updateProfileDto.bio.trim() || null;
			}
		}

		const updatedUser = await this.userRepository.save(user);

		// password 제외하고 반환
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { password, ...userWithoutPassword } = updatedUser;
		return userWithoutPassword as Omit<User, 'password'>;
	}
}
