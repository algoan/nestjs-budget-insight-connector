import { Injectable, LoggerService } from '@nestjs/common';
import { ServiceAccount, BanksUser } from '@algoan/rest';
import { AlgoanService } from '../../algoan.service';

/**
 * Service used to interact with the BanksUser ressource
 */
@Injectable()
export class BanksUserService {
  constructor(private readonly logger: LoggerService, private readonly algoanService: AlgoanService) {}

  /**
   * Will set the redirect url on the banksUser
   *
   * @param banksUser The banksUser that will receive the new redirect url
   * @param redirectUrl The redirect url to set
   */
  public async registerRedirectUrl(
    serviceAccount: ServiceAccount,
    banksUser: BanksUser,
    redirectUrl: string,
  ): Promise<BanksUser> {
    this.logger.debug(`Register url ${redirectUrl} on banksUser ${banksUser.id}`);

    return this.algoanService.algoanClient.assignRedirectUrl(banksUser, redirectUrl, serviceAccount.clientId);
  }
}
