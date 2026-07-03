import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class JoinGroupDto {
  @ApiProperty({
    example: 'AJO-7F4X9P',
    description: 'The invite code for the savings group (format: AJO-XXXXXX)',
    pattern: '^AJO-[A-Z0-9]{6}$',
  })
  @IsString()
  @Matches(/^AJO-[A-Z0-9]{6}$/, {
    message:
      'inviteCode must be a valid AjoLedger invite code (e.g. AJO-7F4X9P).',
  })
  inviteCode: string;
}

