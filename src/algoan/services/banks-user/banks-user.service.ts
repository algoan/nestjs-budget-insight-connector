import { Injectable, LoggerService } from '@nestjs/common';
import { BanksUser, ServiceAccount, BanksUserAccountWithTransactions } from '@algoan/rest';
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
  public async registerRedirectUrl(banksUser: BanksUser, redirectUrl: string): Promise<BanksUser> {
    this.logger.debug(`Register url ${redirectUrl} on banksUser ${banksUser.id}`);
    await banksUser.update({ redirectUrl });

    return banksUser;
  }

  /**
   * Synchronise the Algoan api with the accounts from the aggregator
   */
  public async synchronizeBanksUser(
    accounts: BanksUserAccountWithTransactions[],
    serviceAccount: ServiceAccount,
    banksUserId: string,
  ): Promise<void> {
    for (const account of accounts) {
      const accountToPost: Account = {
        ...account,
      };

      /* tslint:disable:no-dynamic-delete */
      delete accountToPost.transactions;
      // TODO Remove this once the api accept a bank parameter
      delete accountToPost.bank;
      /* tslint:enable:no-dynamic-delete */

      const accountId: string = await this.algoanService.algoanClient.postAccount(
        serviceAccount.clientId,
        banksUserId,
        accountToPost,
      );
      await this.algoanService.algoanClient.postTransactions(
        serviceAccount.clientId,
        banksUserId,
        accountId,
        account.transactions,
      );
    }
    await this.algoanService.algoanClient.terminateBanksUserSynchronisation(serviceAccount.clientId, banksUserId);
  }
}
