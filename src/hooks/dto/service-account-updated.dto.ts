import { IsNotEmpty, IsNotEmptyObject } from 'class-validator';

/**
 * ServiceAccountUpdated DTO
 */
export class ServiceAccountUpdatedDTO {
  /**
   * Unique service account DTO
   */
  @IsNotEmpty()
  public readonly serviceAccountId: string;
  /**
   * Service account configuration
   */
  @IsNotEmptyObject()
  // eslint-disable-next-line
  public config: any;
}
