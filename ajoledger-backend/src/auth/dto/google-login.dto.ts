import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleLoginDto {
  @ApiProperty({
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI...',
    description: 'The Google ID Token received from the native mobile SDK',
  })
  @IsNotEmpty()
  @IsString()
  idToken: string;
}
