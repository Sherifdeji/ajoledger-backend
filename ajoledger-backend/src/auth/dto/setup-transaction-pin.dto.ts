import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetupTransactionPinDto {
  @ApiProperty({
    example: '1234',
    description: 'A 4-digit numeric Transaction PIN used to authorize financial operations',
    pattern: '^\\d{4}$',
  })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'transactionPin must be exactly 4 digits' })
  transactionPin: string;
}

