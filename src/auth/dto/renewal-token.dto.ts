import { IsString, IsNotEmpty } from 'class-validator';

export class RenewalTokenDto {
  @IsString({ message: 'Refresh Token은 문자열이어야 합니다' })
  @IsNotEmpty({ message: 'Refresh Token은 필수입니다' })
  refresh_token: string;
}
