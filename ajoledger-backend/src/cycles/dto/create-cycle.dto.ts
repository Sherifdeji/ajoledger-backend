import { IsDateString, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCycleDto {
  @ApiProperty({
    example: 500000,
    description:
      'Contribution amount in kobo (integer). ₦5,000 = 500000. No decimals allowed.',
    minimum: 1,
    type: 'integer',
  })
  @IsInt({ message: 'contributionAmountKobo must be an integer.' })
  @Min(1, { message: 'contributionAmountKobo must be greater than zero.' })
  contributionAmountKobo: number;

  @ApiProperty({
    example: '2026-08-01',
    description: 'ISO 8601 date string for the first round contribution due date',
  })
  @IsDateString(
    {},
    { message: 'dueDate must be a valid ISO 8601 date string.' },
  )
  dueDate: string;
}

