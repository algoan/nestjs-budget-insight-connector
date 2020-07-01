import { prop } from '@typegoose/typegoose';
import { IsString } from 'class-validator';

/**
 * And Object persisted in database to keep the mapping between
 * Algoan's objects and BI's objects
 */
export class BanksUserMap {
  @IsString()
  @prop()
  /**
   * Identifier of the user on the Algoan's side
   */
  public banksUserId: string;

  @IsString()
  @prop()
  /**
   * Identifier of the connection between a user and bank on BI's side
   */
  public connectionId: string;

  @IsString()
  @prop()
  /**
   * Useful to select which oauth token to use to call Algoan's API
   */
  public clientId: string;
}
