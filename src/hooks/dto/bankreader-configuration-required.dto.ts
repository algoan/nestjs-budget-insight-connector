import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

/**
 * `bankreader_configuration_required` event's payload
 */
export class BankreaderConfigurationRequiredDTO {
  @ApiProperty()
  @IsNotEmpty()
  public readonly banksUserId: string;
}
