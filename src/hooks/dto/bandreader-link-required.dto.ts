import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

/**
 * BankreaderLinkRequired
 */
export class BankreaderLinkRequiredDTO {
  @ApiProperty()
  @IsNotEmpty()
  public readonly applicationId: string;
  @ApiProperty()
  @IsNotEmpty()
  public readonly banksUserId: string;
}
