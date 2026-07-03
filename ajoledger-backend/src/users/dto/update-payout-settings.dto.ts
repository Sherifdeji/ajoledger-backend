import { IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePayoutSettingsDto {
  @ApiProperty({
    example: '058',
    description: 'CBN bank code for the destination bank (e.g. 058 = GTBank)',
  })
  @IsString()
  bankCode: string;

  @ApiProperty({
    example: '0123456789',
    description: 'NUBAN account number (exactly 10 digits)',
    minLength: 10,
    maxLength: 10,
  })
  @IsString()
  @Length(10, 10, { message: 'accountNumber must be exactly 10 characters.' })
  accountNumber: string;

  @ApiProperty({
    example: 'Sherif Ibrahim',
    description: 'Account name as it appears on the destination bank account',
  })
  @IsString()
  accountName: string;

  @ApiProperty({
    example: '1234',
    description:
      'Your 4-digit Transaction PIN — required to authorise this change',
    pattern: '^\\d{4}$',
  })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'pin must be exactly 4 digits.' })
  pin: string;
}
