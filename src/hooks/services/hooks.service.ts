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
  AccountType,
  EventStatus,
  SubscriptionEvent,
} from '@algoan/rest';
import { UnauthorizedException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { config } from 'node-config-ts';

import * as moment from 'moment';
import * as delay from 'delay';
import { AlgoanService } from '../../algoan/algoan.service';
import { EventDTO } from '../dto/event.dto';

import {
  JWTokenResponse,
  BudgetInsightAccount,
  BudgetInsightTransaction,
  Connection,
  BudgetInsightOwner,
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

const WAITING_TIME: number = config.budgetInsight.waitingTime;

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

    const subscription: Subscription | undefined = serviceAccount.subscriptions.find(
      (sub: Subscription) => sub.id === event.subscription.id,
    );

    if (subscription === undefined) {
      return;
    }

    if (!subscription.validateSignature(signature, (event.payload as unknown) as { [key: string]: string })) {
      throw new UnauthorizedException('Invalid X-Hub-Signature: you cannot call this API');
    }

    // Handle the event asynchronously
    void this.dispatchAndHandleWebhook(event, subscription, serviceAccount);

    return;
  }

  /**
   * Dispatch to the right webhook handler and handle
   *
   * Allow to asynchronously handle (with `void`) the webhook and firstly respond 204 to the server
   */
  private async dispatchAndHandleWebhook(
    event: EventDTO,
    subscription: Subscription,
    serviceAccount: ServiceAccount,
  ): Promise<void> {
    // ACKnowledged event
    const se: SubscriptionEvent = subscription.event(event.id);

    try {
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
          void se.update({ status: EventStatus.FAILED });

          return;
      }
    } catch (err) {
      void se.update({ status: EventStatus.ERROR });

      throw err;
    }

    void se.update({ status: EventStatus.PROCESSED });
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

    if (permanentToken === undefined) {
      this.logger.warn('Aggregation process stopped: no permanent token generated');

      return;
    }

    /**
     * 2. Fetch user active connections
     */
    let synchronizationCompleted = false;
    const timeout = moment().add(config.budgetInsight.synchronizationTimeout, 'seconds');
    let connections: Connection[] | undefined;
    while (!synchronizationCompleted && moment().isBefore(timeout)) {
      connections = await this.aggregator.getConnections(permanentToken, serviceAccount.config as ClientConfig);
      synchronizationCompleted = true;
      for (const connection of connections) {
        // eslint-disable-next-line no-null/no-null
        if (connection.state !== null || connection.last_update === null) {
          synchronizationCompleted = false;
          // Wait 5 seconds between each call
          await delay(WAITING_TIME);
        }
      }
    }

    if (!synchronizationCompleted) {
      const err = new Error('Synchronization failed');
      this.logger.warn({
        message: 'Synchronization failed after a timeout',
        banksUserId: banksUser.id,
        timeout: config.budgetInsight.synchronizationTimeout,
      });
      throw err;
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

    if (connections === undefined) {
      this.logger.warn('Aggregation process stopped: no active connection found');

      return;
    }

    /**
     * 3.b. Get personal information from every connection
     */
    const connectionsInfo: { [key: string]: BudgetInsightOwner } = {};
    for (const connection of connections) {
      try {
        connectionsInfo[connection.id] = await this.aggregator.getInfo(
          permanentToken,
          `${connection.id}`,
          serviceAccount.config as ClientConfig,
        );
      } catch (err) {
        this.logger.warn({
          message: `Unable to get user personal information`,
          error: err,
          connection,
        });
      }
    }

    const algoanAccounts: PostBanksUserAccountDTO[] = mapBudgetInsightAccount(
      accounts,
      connections,
      connectionsInfo,
    ).filter(
      // Disable this rule because the type can be undefined even if it should never happen
      // eslint-disable-next-line @typescript-eslint/tslint/config
      (account: PostBanksUserAccountDTO & { type?: AccountType }) => account.type !== undefined,
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
        account.type,
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
    const serviceAccountConfig: ClientConfig = serviceAccount.config as ClientConfig;
    const jsonWT: JWTokenResponse = await this.aggregator.getJWToken(serviceAccountConfig);

    const plugIn = {
      budgetInsightBank: {
        baseUrl: serviceAccountConfig?.baseUrl ?? config.budgetInsight.url,
        token: jsonWT.jwt_token,
        clientId: serviceAccountConfig?.clientId ?? serviceAccount.clientId,
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
