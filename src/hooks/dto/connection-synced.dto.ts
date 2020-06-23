import { ApiModelProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { Connection } from '../../aggregator/interfaces/budget-insight.interface';

/**
 * BI `connection-synced` event
 */
export class ConnectionSyncedDTO {
  @ApiModelProperty()
  @IsNotEmpty()
  public readonly user: object;

  @ApiModelProperty()
  @IsNotEmpty()
  public readonly connection: Connection;

  @ApiModelProperty()
  @IsNotEmpty()
  public readonly connector: object;
}
