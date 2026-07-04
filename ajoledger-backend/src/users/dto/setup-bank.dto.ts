import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetupBankDto {
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
    example: 'ADAM ABDULKAREEM',
    description:
      'Account name as resolved by POST /users/resolve-account. ' +
      'Always resolve this value from Nomba before calling this endpoint.',
  })
  @IsString()
  accountName: string;
}
