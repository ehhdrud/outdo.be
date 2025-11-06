import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { User, UserPayload } from '../common/decorators/user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('users')
@UseGuards(JwtAuthGuard) // 모든 엔드포인트에 JWT 가드 적용
export class UsersController {
	constructor(private readonly usersService: UsersService) {}

	@Get('profile')
	async getProfile(@User() user: UserPayload) {
		return this.usersService.getProfile(user.user_pk);
	}

	@Patch('profile')
	async updateProfile(@User() user: UserPayload, @Body() updateProfileDto: UpdateProfileDto) {
		return this.usersService.updateProfile(user.user_pk, updateProfileDto);
	}
}
