import { IsString, Matches, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetupBankDto {
  @ApiProperty({
    example: '058',
    description: 'CBN bank code for the destination bank (e.g. 058 = GTBank)',
  })
  @IsString()
  @Matches(/^\d{3,6}$/, { message: 'bankCode must be 3–6 numeric digits.' })
  bankCode: string;

  @ApiProperty({
    example: '0123456789',
    description: 'NUBAN account number (exactly 10 digits)',
    minLength: 10,
    maxLength: 10,
  })
  @IsString()
  @Matches(/^\d{10}$/, { message: 'accountNumber must be exactly 10 numeric digits.' })
  accountNumber: string;

  @ApiProperty({
    example: 'ADAM ABDULKAREEM',
    description:
      'Account name as resolved by POST /users/resolve-account. ' +
      'Always resolve this value from Nomba before calling this endpoint.',
  })
  @IsString()
  @MinLength(2, { message: 'accountName must be at least 2 characters.' })
  @MaxLength(100, { message: 'accountName must not exceed 100 characters.' })
  accountName: string;
}
