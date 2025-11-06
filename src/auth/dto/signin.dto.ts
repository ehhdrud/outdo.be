import { IsEmail, IsString, IsNotEmpty } from 'class-validator';

export class SigninDto {
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다' })
  @IsNotEmpty({ message: '이메일은 필수입니다' })
  email: string;

  @IsString({ message: '비밀번호는 문자열이어야 합니다' })
  @IsNotEmpty({ message: '비밀번호는 필수입니다' })
  password: string;
}
