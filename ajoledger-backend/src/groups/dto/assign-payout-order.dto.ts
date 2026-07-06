import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsUUID,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TurnAssignmentDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'The UUID of the membership record',
  })
  @IsUUID()
  membershipId: string;

  @ApiProperty({
    example: 1,
    description: 'The payout turn assigned to this member (1-indexed)',
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  payoutTurn: number;
}

export class AssignPayoutOrderDto {
  @ApiProperty({
    type: [TurnAssignmentDto],
    description: 'Array of turn assignments for all members of the group',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TurnAssignmentDto)
  assignments: TurnAssignmentDto[];
}
