import { ApiModelProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

/**
 * BankreaderLinkRequired
 */
export class BankreaderLinkRequiredDTO {
  @ApiModelProperty()
  @IsNotEmpty()
  public readonly applicationId: string;
  @ApiModelProperty()
  @IsNotEmpty()
  public readonly banksUserId: string;
}
