import { Injectable, LoggerService } from '@nestjs/common';
import { BanksUser } from '@algoan/rest';

/**
 * Service used to interact with the BanksUser ressource
 */
@Injectable()
export class BanksUserService {
  constructor(private readonly logger: LoggerService) {}

  /**
   * Will set the redirect url on the banksUser
   *
   * @param banksUser The banksUser that will receive the new redirect url
   * @param redirectUrl The redirect url to set
   */
  public async registerRedirectUrl(banksUser: BanksUser, redirectUrl: string): Promise<BanksUser> {
    this.logger.debug(`Register url ${redirectUrl} on banksUser ${banksUser.id}`);
    await banksUser.update({ redirectUrl });

    return banksUser;
  }
}
