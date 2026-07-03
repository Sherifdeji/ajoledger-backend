import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyTransactionPinDto {
  @ApiProperty({
    example: '1234',
    description: 'The 4-digit Transaction PIN to verify',
    pattern: '^\\d{4}$',
  })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'transactionPin must be exactly 4 digits' })
  transactionPin: string;
}

