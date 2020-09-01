import {
  BanksUserAccount,
  ServiceAccount,
  Subscription,
  EventName,
  BanksUser,
  BanksUserStatus,
  PostBanksUserTransactionDTO,
  PostBanksUserAccountDTO,
  MultiResourceCreationResponse,
  BanksUserTransaction,
} from '@algoan/rest';
import { UnauthorizedException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { config } from 'node-config-ts';

import * as moment from 'moment';
import { AlgoanService } from '../../algoan/algoan.service';
import { EventDTO } from '../dto/event.dto';

import {
  JWTokenResponse,
  BudgetInsightAccount,
  BudgetInsightTransaction,
  Connection,
} from '../../aggregator/interfaces/budget-insight.interface';
import { AggregatorService } from '../../aggregator/services/aggregator.service';
import {
  mapBudgetInsightAccount,
  mapBudgetInsightTransactions,
} from '../../aggregator/services/budget-insight/budget-insight.utils';
import { BankreaderLinkRequiredDTO } from '../dto/bandreader-link-required.dto';
import { BankreaderConfigurationRequiredDTO } from '../dto/bankreader-configuration-required.dto';
import { BankreaderRequiredDTO } from '../dto/bankreader-required.dto';
import { ClientConfig } from '../../aggregator/services/budget-insight/budget-insight.client';
/**
 * Hook service
 */
@Injectable()
export class HooksService {
  /**
   * Class logger
   */
  private readonly logger: Logger = new Logger(HooksService.name);

  constructor(private readonly algoanService: AlgoanService, private readonly aggregator: AggregatorService) {}

  /**
   * Handle Algoan webhooks
   * @param event Event listened to
   * @param signature Signature headers, to check if the call is from Algoan
   */
  public async handleWebhook(event: EventDTO, signature: string): Promise<void> {
    const serviceAccount = await this.getServiceAccount(event);

    const subscription: Subscription = serviceAccount.subscriptions.find(
      (sub: Subscription) => sub.id === event.subscription.id,
    );

    if (!subscription.validateSignature(signature, (event.payload as unknown) as { [key: string]: string })) {
      throw new UnauthorizedException('Invalid X-Hub-Signature: you cannot call this API');
    }

    switch (event.subscription.eventName) {
      case EventName.BANKREADER_LINK_REQUIRED:
        await this.handleBankreaderLinkRequiredEvent(serviceAccount, event.payload as BankreaderLinkRequiredDTO);
        break;

      case EventName.BANKREADER_CONFIGURATION_REQUIRED:
        await this.handleBankreaderConfigurationRequiredEvent(
          serviceAccount,
          event.payload as BankreaderConfigurationRequiredDTO,
        );
        break;

      case EventName.BANKREADER_REQUIRED:
        await this.handleBankReaderRequiredEvent(serviceAccount, event.payload as BankreaderRequiredDTO);
        break;

      // The default case should never be reached, as the eventName is already checked in the DTO
      default:
        return;
    }

    return;
  }

  /**
   * Handle the "bankreader_link_required" event
   * Looks for a callback URL and generates a new redirect URL
   * @param serviceAccount Concerned Algoan service account attached to the subscription
   * @param payload Payload sent, containing the Banks User id
   */
  public async handleBankreaderLinkRequiredEvent(
    serviceAccount: ServiceAccount,
    payload: BankreaderLinkRequiredDTO,
  ): Promise<void> {
    /**
     * 1. GET the banks user to retrieve the callback URL
     */
    const banksUser: BanksUser = await serviceAccount.getBanksUserById(payload.banksUserId);
    this.logger.debug(`Found BanksUser with id ${banksUser.id} and callback ${banksUser.callbackUrl}`);

    if (banksUser.callbackUrl === undefined) {
      throw new NotFoundException(`BanksUser ${banksUser.id} has no callback URL`);
    }

    /**
     * 2. Generates a redirect URL
     */
    const redirectUrl: string = this.aggregator.generateRedirectUrl(banksUser, serviceAccount.config as ClientConfig);

    /**
     * 3. Update the Banks-User, sending to Algoan the generated URL
     */
    await banksUser.update({
      redirectUrl,
    });

    this.logger.debug(`Added redirect url ${banksUser.redirectUrl} to banksUser ${banksUser.id}`);

    return;
  }

  /**
   * Handle the "bankreader_required" subscription
   * It triggers the banks accounts and transactions synchronization
   * @param serviceAccount Concerned Algoan service account attached to the subscription
   * @param payload Payload sent, containing the Banks User id
   */
  public async handleBankReaderRequiredEvent(
    serviceAccount: ServiceAccount,
    payload: BankreaderRequiredDTO,
  ): Promise<void> {
    const banksUser: BanksUser = await serviceAccount.getBanksUserById(payload.banksUserId);

    /**
     * 0. Notify Algoan that the synchronization is starting
     */
    await banksUser.update({
      status: BanksUserStatus.SYNCHRONIZING,
    });

    /**
     * 1. Retrieves an access token from Budget Insight to access to the user accounts
     */
    let permanentToken: string | undefined = banksUser.plugIn?.budgetInsightBank?.token;

    if (permanentToken === undefined && payload.temporaryCode !== undefined) {
      permanentToken = await this.aggregator.registerClient(
        payload.temporaryCode,
        serviceAccount.config as ClientConfig,
      );
    }

    /**
     * 2. Fetch user active connections
     */
    let synchronizationCompleted = false;
    const timeout = moment().add(config.budgetInsight.synchronizationTimeout as number, 'seconds');
    while (!synchronizationCompleted && moment().isBefore(timeout)) {
      const connections: Connection[] = await this.aggregator.getConnections(
        permanentToken,
        serviceAccount.config as ClientConfig,
      );
      synchronizationCompleted = true;
      for (const connection of connections) {
        // eslint-disable-next-line no-null/no-null
        if (connection.state !== null || connection.last_update === null) {
          synchronizationCompleted = false;
        }
      }
    }

    /**
     * 3. Retrieves BI banks accounts and send them to Algoan
     */
    const accounts: BudgetInsightAccount[] = await this.aggregator.getAccounts(
      permanentToken,
      serviceAccount.config as ClientConfig,
    );
    this.logger.debug({
      message: `Budget Insight accounts retrieved for Banks User "${banksUser.id}"`,
      accounts,
    });
    const algoanAccounts: PostBanksUserAccountDTO[] = mapBudgetInsightAccount(accounts).filter(
      // eslint-disable-next-line no-null/no-null
      (account) => account.type !== null,
    );
    const createdAccounts: BanksUserAccount[] = await banksUser.createAccounts(algoanAccounts);
    this.logger.debug({
      message: `Algoan accounts created for Banks User "${banksUser.id}"`,
      accounts: createdAccounts,
    });

    /**
     * 4. Notify Algoan that the accounts have been synchronized
     */
    await banksUser.update({
      status: BanksUserStatus.ACCOUNTS_SYNCHRONIZED,
    });

    /**
     * 5. For each synchronized accounts, get transactions
     */
    for (const account of createdAccounts) {
      const transactions: BudgetInsightTransaction[] = await this.aggregator.getTransactions(
        permanentToken,
        Number(account.reference),
        serviceAccount.config as ClientConfig,
      );
      this.logger.debug({
        message: `Transactions retrieved from BI for banks user "${banksUser.id}" and account "${account.id}"`,
        transactions,
      });
      const algoanTransactions: PostBanksUserTransactionDTO[] = await mapBudgetInsightTransactions(
        transactions,
        permanentToken,
        this.aggregator,
      );
      const multiStatusResult: MultiResourceCreationResponse<BanksUserTransaction> = await banksUser.createTransactions(
        account.id,
        algoanTransactions,
      );
      this.logger.debug({
        message: `Transactions created for Algoan for banks user "${banksUser.id}" and account "${account.id}"`,
        multiStatusResult,
      });
    }

    /**
     * 6. Notify Algoan that the process is finished
     */
    await banksUser.update({
      status: BanksUserStatus.FINISHED,
    });

    return;
  }

  /**
   * Get BI Sandbox token
   * @param serviceAccount Algoan service account to retrieve sandbox credentials
   * @param payload Payload
   */
  public async handleBankreaderConfigurationRequiredEvent(
    serviceAccount: ServiceAccount,
    payload: BankreaderConfigurationRequiredDTO,
  ): Promise<void> {
    const banksUser = await serviceAccount.getBanksUserById(payload.banksUserId);
    const jsonWT: JWTokenResponse = await this.aggregator.getJWToken(serviceAccount.config as ClientConfig);

    const plugIn = {
      budgetInsightBank: {
        baseUrl: config.budgetInsight.url,
        token: jsonWT.jwt_token,
      },
    };

    await banksUser.update({ plugIn });
  }

  /**
   * Gets the Service Account given the event
   */
  public async getServiceAccount(event: EventDTO): Promise<ServiceAccount> {
    const serviceAccount = this.algoanService.algoanClient.getServiceAccountBySubscriptionId(event.subscription.id);
    if (serviceAccount === undefined) {
      throw new UnauthorizedException(`No service account found for subscription ${event.subscription.id}`);
    }

    return serviceAccount;
  }
}
