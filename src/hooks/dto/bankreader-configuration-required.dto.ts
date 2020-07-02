import { IsNotEmpty } from 'class-validator';

/**
 * `bankreader_configuration_required` event's payload
 */
export class BankreaderConfigurationRequiredDTO {
  @IsNotEmpty()
  public readonly banksUserId: string;
}
