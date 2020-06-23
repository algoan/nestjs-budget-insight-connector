import { ApiModelProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional } from 'class-validator';

/**
 * BankreaderRequired
 */
export class BankreaderRequiredDTO {
  @ApiModelProperty()
  @IsNotEmpty()
  public readonly applicationId: string;
  @ApiModelProperty()
  @IsNotEmpty()
  public readonly banksUserId: string;
  @ApiModelProperty()
  @IsOptional()
  @IsNotEmpty()
  public readonly temporaryCode: string;
}
