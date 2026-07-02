import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @MinLength(3, { message: 'Group name must be at least 3 characters.' })
  @MaxLength(100, { message: 'Group name must not exceed 100 characters.' })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description must not exceed 500 characters.' })
  description?: string;
}
