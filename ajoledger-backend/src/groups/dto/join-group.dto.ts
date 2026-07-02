import { IsString, Matches } from 'class-validator';

export class JoinGroupDto {
  @IsString()
  @Matches(/^AJO-[A-Z0-9]{6}$/, {
    message:
      'inviteCode must be a valid AjoLedger invite code (e.g. AJO-7F4X9P).',
  })
  inviteCode: string;
}
