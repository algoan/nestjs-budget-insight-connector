import { Type } from 'class-transformer';
import { Allow, IsInt, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';

import {
  AggregatorLinkRequiredDTO,
  BanksDetailsRequiredDTO,
  ServiceAccountCreatedDTO,
  ServiceAccountDeletedDTO,
  SubscriptionDTO,
} from '.';

/**
 * Events payload types
 */
type Events = ServiceAccountCreatedDTO | ServiceAccountDeletedDTO | AggregatorLinkRequiredDTO | BanksDetailsRequiredDTO;

/**
 * Event
 */
export class EventDTO {
  @ValidateNested()
  @Type(() => SubscriptionDTO)
  public readonly subscription: SubscriptionDTO;
  @Allow()
  public readonly payload: Events;
  @IsInt()
  public readonly index: number;
  @IsOptional()
  @IsInt()
  public readonly time: number;
  @IsNotEmpty()
  @IsString()
  public readonly id: string;
}
