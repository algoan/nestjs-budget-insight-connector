import { IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO for the event `aggregator_link_required`
 */
export class AggregatorLinkRequiredDTO {
  /** Id of the customer */
  @IsString()
  @IsNotEmpty()
  public readonly customerId: string;
}
