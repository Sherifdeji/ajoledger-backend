import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyDeletionDto {
  @ApiProperty({
    example: '123456',
    description: 'The 6-digit numeric OTP sent to the user',
  })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'otp must be exactly 6 numeric digits.' })
  otp: string;
}
