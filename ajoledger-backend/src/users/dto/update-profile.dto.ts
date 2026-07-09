import { IsOptional, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiProperty({ example: 'John', description: 'First name', required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ example: 'Doe', description: 'Last name', required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({
    example: '08012345678',
    description: 'Phone number',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{11}$/, { message: 'Phone number must be exactly 11 digits' })
  phoneNumber?: string;
}
