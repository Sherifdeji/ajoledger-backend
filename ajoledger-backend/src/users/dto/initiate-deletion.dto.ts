import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InitiateDeletionDto {
  @ApiProperty({
    example: 'I am switching to a different service',
    description: 'Reason for deleting account',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
