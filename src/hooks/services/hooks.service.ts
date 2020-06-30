import { ServiceAccount, Subscription, BanksUser } from '@algoan/rest';
import { UnauthorizedException, Injectable, LoggerService } from '@nestjs/common';
import * as delay from 'delay';

import { AlgoanService } from '../../algoan/algoan.service';
import { EventDTO } from '../dto/event.dto';

import { Connection, JWTokenResponse, Transaction } from '../../aggregator/interfaces/budget-insight.interface';
import { AggregatorService } from '../../aggregator/services/aggregator.service';
import {
  mapBudgetInsightAccount,
  mapBudgetInsightAccountsFromOneConnection,
} from '../../aggregator/services/budget-insight/budget-insight.utils';
import { BankreaderLinkRequiredDTO } from '../dto/bandreader-link-required.dto';
import { BankreaderConfigurationRequiredDTO } from '../dto/bankreader-configuration-required.dto';
import { BankreaderRequiredDTO } from '../dto/bankreader-required.dto';
import { ConnectionSyncedDTO } from '../dto/connection-synced.dto';
import { ServiceAccountCreatedDTO } from '../dto/service-account-created.dto';
import { ServiceAccountDeletedDTO } from '../dto/service-account-deleted.dto';

/**
 * Hook service
 */
@Injectable()
export class HooksService {
  constructor(
    private readonly algoanService: AlgoanService,
    private readonly aggregator: AggregatorService,
    private readonly logger: LoggerService,
  ) {}

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

    return;
  }

  /**
   * Handle the bankreader-link-required event
   */
  public async generateRedirectUrl(event: EventDTO, payload: BankreaderLinkRequiredDTO): Promise<void> {
    const serviceAccount = await this.getServiceAccount(event);
    let banksUser = await serviceAccount.getBanksUserById(payload.banksUserId);
    this.logger.debug(`Found BanksUser with id ${banksUser.id} and callback ${banksUser.callbackUrl}`);

    const redirectUrl: string = this.aggregator.generateRedirectUrl(serviceAccount.id, banksUser);

    banksUser = await this.banksUser.registerRedirectUrl(serviceAccount, banksUser, redirectUrl);

    this.logger.debug(`Added redirect url ${banksUser.redirectUrl} to banksUser ${banksUser.id}`);
  }

  /**
   * Handle the bankreader-required event
   */
  public async synchronizeBanksUser(event: EventDTO, payload: BankreaderRequiredDTO): Promise<void> {
    const serviceAccount = await this.getServiceAccount(event);
    const banksUser = await serviceAccount.getBanksUserById(payload.banksUserId);
    const biCredentials: BIConfigurations | undefined = this.serviceAccountService.biCredentialsMap.get(
      serviceAccount.id,
    );
    let permanentToken: string | undefined = banksUser?.plugIn?.budgetInsightBank?.token;

    if (!permanentToken || payload.temporaryCode) {
      permanentToken = await this.aggregator.registerClient(serviceAccount.id, payload.temporaryCode);
    }
    if (biCredentials?.webhook) {
      /**
       * Fetch the connections
       */
      const connections: Connection[] = await this.aggregator.getConnections(serviceAccount.id, permanentToken);

      /**
       * Link banksUser with the connections
       */
      for (const co of connections) {
        await this.banksUserMapService.create({
          banksUserId: payload.banksUserId,
          connectionId: co.id as string,
          clientId: serviceAccount.clientId,
        });
      }

      return;
    } else {
      /**
       * Add a delay in order to wait for Budget Insight to synchronize all accounts
       * ⚠️ NOTE: This is temporary! Normally we are warned through a webhook
       * that the synchronization is finished
       */
      const timeout: number = this.configService.getConfig('budget-insight.synchronizationTimeout') || 0;
      this.logger.debug(`SynchroniseBanksUser with a ${timeout} millisecond delay`);
      await delay(timeout);

      const connections: Connection[] = await this.aggregator.getAccounts(serviceAccount.id, permanentToken);
      const transactions: Transaction[] = await this.aggregator.getTransactions(serviceAccount.id, permanentToken);
      const accounts: BanksUserAccountWithTransactions[] = mapBudgetInsightAccount(connections, transactions);

      await this.banksUserService.synchronizeBanksUser(accounts, serviceAccount, payload.banksUserId);
    }
  }

  /**
   * Handle the service-account-created event
   */
  public async addServiceAccount(event: EventDTO, payload: ServiceAccountCreatedDTO): Promise<void> {
    const serviceAccount = await this.getServiceAccount(event);
    await serviceAccount.add(payload.serviceAccountId);
  }

  /**
   * Handle the service-account-deleted event
   */
  public async removeServiceAccount(event: EventDTO, payload: ServiceAccountDeletedDTO): Promise<void> {
    const serviceAccount = await this.getServiceAccount(event);
    serviceAccount.remove(payload.serviceAccountId);
  }

  /**
   * Handle the connection-synced event
   * @param payload the event payload with accounts and transactions in connection
   */
  public async patchBanksUserConnectionSync(payload: ConnectionSyncedDTO): Promise<void> {
    // Get Algoan BanksUser to update
    if (!payload.connection?.id) {
      throw new Error(`No id found in connection "${payload}"`);
    }

    const banksUserMap = await this.banksUserMapService.getByConnectionId(payload.connection.id);
    if (!banksUserMap) {
      throw new Error(`No banksUserMap found for Budget-Insight connection n°"${payload.connection.id}"`);
    }

    // Format accounts & transactions to Algoan
    const accounts: BanksUserAccountWithTransactions[] = mapBudgetInsightAccountsFromOneConnection(payload.connection);

    const serviceAccount: ServiceAccount = ({
      clientId: banksUserMap.clientId,
    } as unknown) as ServiceAccount;

    // Send accounts and transactions to Algoan BanksUser
    await this.banksUserService.synchronizeBanksUser(accounts, serviceAccount, banksUserMap.banksUserId);
  }

  /**
   * Get BI Sandbox token
   * @param serviceAccount Algoan service account to retrieve sandbox credentials
   * @param payload Payload
   */
  public async getSandboxToken(event: EventDTO, payload: BankreaderConfigurationRequiredDTO): Promise<void> {
    const serviceAccount = await this.getServiceAccount(event);
    const banksUser = await serviceAccount.getBanksUserById(payload.banksUserId);
    const jsonWT: JWTokenResponse = await this.aggregator.getJWToken(serviceAccount.id);

    const plugIn: PlugIn = {
      budgetInsightBank: {
        baseUrl: jsonWT.payload?.domain
          ? `https://${jsonWT.payload.domain}/2.0/`
          : this.configService.getConfig('budget-insight.url'),
        token: jsonWT.jwt_token,
      },
    };

    await banksUser.update({ plugin: plugIn });
  }

  /**
   * Gets the Service Account given the event
   */
  private async getServiceAccount(event: EventDTO): Promise<ServiceAccount> {
    const serviceAccount = this.algoanService.algoanClient.getServiceAccountBySubscriptionId(event.subscription.id);
    if (serviceAccount === undefined) {
      throw new UnauthorizedException(`No service account found for subscription ${event.subscription.id}`);
    }

    return serviceAccount;
  }
}
