import { IsNotEmpty, IsNotEmptyObject, IsString } from 'class-validator';

/**
 * ServiceAccountUpdated DTO
 */
export class ServiceAccountUpdatedDTO {
  /**
   * Unique service account DTO
   */
  @IsNotEmpty()
  @IsString()
  public readonly serviceAccountId: string;
  /**
   * Service account configuration
   */
  @IsNotEmptyObject()
  // eslint-disable-next-line
  public config: Record<string, unknown>;
}
