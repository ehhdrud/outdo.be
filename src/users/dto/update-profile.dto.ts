import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
	@IsOptional()
	@IsString()
	@MinLength(1, { message: '이름은 최소 1자 이상이어야 합니다' })
	@MaxLength(100, { message: '이름은 최대 100자까지 입력 가능합니다' })
	name?: string;

	@IsOptional()
	@IsString()
	bio?: string;
}
