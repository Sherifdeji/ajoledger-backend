import { IsDateString, IsInt, Min } from 'class-validator';

export class CreateCycleDto {
  @IsInt({ message: 'contributionAmountKobo must be an integer.' })
  @Min(1, { message: 'contributionAmountKobo must be greater than zero.' })
  contributionAmountKobo: number;

  @IsDateString(
    {},
    { message: 'dueDate must be a valid ISO 8601 date string.' },
  )
  dueDate: string;
}
