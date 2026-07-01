import { IsString, Matches } from 'class-validator';

export class RegisterDto {
  @IsString()
  @Matches(/^0\d{10}$/, {
    message: 'phone must be an 11-digit Nigerian number (e.g. 08012345678)',
  })
  phone: string;

  @IsString()
  @Matches(/^\d{4}$/, { message: 'loginPin must be exactly 4 digits' })
  loginPin: string;
}
