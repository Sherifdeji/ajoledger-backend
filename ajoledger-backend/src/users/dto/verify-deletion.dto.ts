import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyDeletionDto {
  @ApiProperty({
    example: '123456',
    description: 'The 6-digit OTP sent to the user',
  })
  @IsString()
  @Length(6, 6)
  otp: string;
}
