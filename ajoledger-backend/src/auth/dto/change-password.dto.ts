import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ example: 'old_password123', description: 'Current password' })
  @IsString()
  currentPassword: string;

  @ApiProperty({
    example: 'new_secure_password!456',
    description: 'New password (min 8 chars)',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
