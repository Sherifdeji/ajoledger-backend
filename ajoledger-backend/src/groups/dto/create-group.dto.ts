import { IsOptional, IsString, MaxLength, MinLength, IsEnum, IsNumber, IsInt, Min } from 'class-validator';
import { ContributionFrequency } from '@prisma/client';
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

  @ApiProperty({
    example: 'WEEKLY',
    enum: ContributionFrequency,
    description: 'The frequency of contributions',
  })
  @IsEnum(ContributionFrequency)
  frequency: ContributionFrequency;

  @ApiProperty({
    example: 50000,
    description: 'The required contribution amount per member in Naira (minimum ₦100)',
    minimum: 100,
  })
  @IsNumber()
  @Min(100, { message: 'Minimum contribution amount is ₦100.' })
  contributionAmount: number;

  @ApiProperty({
    example: 10,
    description: 'The total number of participants in the group (minimum 2)',
    minimum: 2,
  })
  @IsInt()
  @Min(2, { message: 'A group must have at least 2 participants.' })
  numberOfParticipants: number;
}

