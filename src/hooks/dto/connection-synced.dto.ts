import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { Connection } from '../../aggregator/interfaces/budget-insight.interface';

/**
 * BI `connection-synced` event
 */
export class ConnectionSyncedDTO {
  @ApiProperty()
  @IsNotEmpty()
  public readonly user: { signin: string; platform: string; id: number };

  @ApiProperty()
  @IsNotEmpty()
  public readonly connection: Connection;
}
