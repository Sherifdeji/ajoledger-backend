import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResolveAccountDto {
  @ApiProperty({
    example: '058',
    description: 'CBN bank code (e.g. 058 = GTBank, 033 = UBA)',
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
}
