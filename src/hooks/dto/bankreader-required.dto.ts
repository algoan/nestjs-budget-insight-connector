import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional } from 'class-validator';

/**
 * BankreaderRequired
 */
export class BankreaderRequiredDTO {
  @ApiProperty()
  @IsNotEmpty()
  public readonly applicationId: string;
  @ApiProperty()
  @IsNotEmpty()
  public readonly banksUserId: string;
  @ApiProperty()
  @IsOptional()
  @IsNotEmpty()
  public readonly temporaryCode: string;
}
