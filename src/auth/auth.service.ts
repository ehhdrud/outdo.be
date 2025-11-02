import { Injectable, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { SignupDto } from './dto/signup.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async signup(signupDto: SignupDto): Promise<User> {
    const { email, password, name } = signupDto;

    // 1. 이메일 중복 확인
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('이미 사용 중인 이메일입니다');
    }

    // 2. 비밀번호 해싱
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 3. User 생성
    const user = this.userRepository.create({
      email,
      password: hashedPassword,
      name,
      bio: null,
    });

    try {
      const savedUser = await this.userRepository.save(user);
      // password 제외하고 반환
      delete (savedUser as any).password;
      return savedUser;
    } catch (error) {
      throw new InternalServerErrorException('회원가입 중 오류가 발생했습니다');
    }
  }
}
