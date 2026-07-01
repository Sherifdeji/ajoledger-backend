import { IsString, Matches } from 'class-validator';

export class SetupTransactionPinDto {
  @IsString()
  @Matches(/^\d{4}$/, { message: 'transactionPin must be exactly 4 digits' })
  transactionPin: string;
}
