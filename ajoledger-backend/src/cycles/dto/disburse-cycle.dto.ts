import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DisburseCycleDto {
  @ApiProperty({
    example: '1234',
    description:
      'Your 4-digit Transaction PIN — required to authorise this disbursement. ' +
      'Note: a ₦20 network fee is deducted from the total pooled amount per AjoLedger Terms & Conditions.',
    pattern: '^\\d{4}$',
  })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'transactionPin must be exactly 4 digits.' })
  transactionPin: string;
}
