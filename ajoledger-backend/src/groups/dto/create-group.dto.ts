import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGroupDto {
  @ApiProperty({
    example: 'Backend Engineers Ajo',
    description: 'Display name for the savings group (3–100 characters)',
    minLength: 3,
    maxLength: 100,
  })
  @IsString()
  @MinLength(3, { message: 'Group name must be at least 3 characters.' })
  @MaxLength(100, { message: 'Group name must not exceed 100 characters.' })
  name: string;

  @ApiPropertyOptional({
    example: 'Monthly savings contribution group for the backend team.',
    description: 'Optional description of the group purpose (max 500 characters)',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description must not exceed 500 characters.' })
  description?: string;
}

