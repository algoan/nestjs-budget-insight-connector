import { ServiceAccount, Subscription, EventName, EventStatus, SubscriptionEvent } from '@algoan/rest';
import { Inject, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as delay from 'delay';
import { isEmpty } from 'lodash';
import * as moment from 'moment';
import { Config } from 'node-config-ts';

import {
  BudgetInsightAccount,
  BudgetInsightTransaction,
  Connection,
  BudgetInsightOwner,
} from '../../aggregator/interfaces/budget-insight.interface';
import { AggregatorService } from '../../aggregator/services/aggregator.service';
import { ClientConfig } from '../../aggregator/services/budget-insight/budget-insight.client';
import {
  mapBudgetInsightAccount,
  mapBudgetInsightTransactions,
} from '../../aggregator/services/budget-insight/budget-insight.utils';
import { Account } from '../../algoan/dto/analysis.inputs';
import { Customer, AggregationDetails } from '../../algoan/dto/customer.objects';
import { AggregationDetailsAggregatorName, AggregationDetailsMode } from '../../algoan/dto/customer.enums';
import { AlgoanCustomerService } from '../../algoan/services/algoan-customer.service';
import { AlgoanAnalysisService } from '../../algoan/services/algoan-analysis.service';
import { AlgoanHttpService } from '../../algoan/services/algoan-http.service';
import { AlgoanService } from '../../algoan/services/algoan.service';
import { CONFIG } from '../../config/config.module';
import { AggregatorLinkRequiredDTO, BanksDetailsRequiredDTO, EventDTO } from '../dto';

/**
 * Hook service
 */
@Injectable()
export class HooksService {
  /**
   * Class logger
   */
  private readonly logger: Logger = new Logger(HooksService.name);

  constructor(
    @Inject(CONFIG) private readonly config: Config,
    private readonly algoanService: AlgoanService,
    private readonly algoanHttpService: AlgoanHttpService,
    private readonly algoanCustomerService: AlgoanCustomerService,
    private readonly algoanAnalysisService: AlgoanAnalysisService,
    private readonly aggregator: AggregatorService,
  ) {}

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
  public async dispatchAndHandleWebhook(
    event: EventDTO,
    subscription: Subscription,
    serviceAccount: ServiceAccount,
  ): Promise<void> {
    // ACKnowledged event
    const se: SubscriptionEvent = subscription.event(event.id);

    try {
      switch (event.subscription.eventName) {
        case EventName.AGGREGATOR_LINK_REQUIRED:
          await this.handleAggregatorLinkRequiredEvent(serviceAccount, event.payload as AggregatorLinkRequiredDTO);
          break;

        case EventName.BANK_DETAILS_REQUIRED:
          await this.handleBanksDetailsRequiredEvent(serviceAccount, event.payload as BanksDetailsRequiredDTO);
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
   * Handle the "aggregator_link_required" event
   * Looks for a callback URL and generates a new redirect URL
   * @param serviceAccount Concerned Algoan service account attached to the subscription
   * @param payload Payload sent, containing the customer id
   */
  public async handleAggregatorLinkRequiredEvent(
    serviceAccount: ServiceAccount,
    payload: AggregatorLinkRequiredDTO,
  ): Promise<void> {
    /** Authenticate to algoan */
    this.algoanHttpService.authenticate(serviceAccount.clientId, serviceAccount.clientSecret);

    /** Get the customer to retrieve the callbackUrl and connection mode */
    const customer: Customer | undefined = await this.algoanCustomerService.getCustomerById(payload.customerId);

    if (customer === undefined) {
      throw new Error(`Could not retrieve customer for id "${payload.customerId}"`);
    }

    /** Init the aggregationDetails' response  */
    const serviceAccountConfig: ClientConfig = serviceAccount.config as ClientConfig;
    const aggregationDetails: AggregationDetails = {
      aggregatorName: AggregationDetailsAggregatorName.BUDGET_INSIGHT,
      apiUrl: serviceAccountConfig?.baseUrl ?? this.config.budgetInsight.url,
      clientId: serviceAccountConfig?.clientId ?? this.config.budgetInsight.clientId,
    };

    switch (customer.aggregationDetails?.mode) {
      case AggregationDetailsMode.REDIRECT:
        /** Generate the redirect url */
        const callbackUrl: string | undefined = customer.aggregationDetails.callbackUrl;
        this.logger.debug(`Found customer with id ${customer.id} and callbackUrl ${callbackUrl}`);

        if (callbackUrl === undefined) {
          throw new NotFoundException(`Customer ${customer.id} has no callback URL`);
        }

        aggregationDetails.redirectUrl = this.aggregator.generateRedirectUrl(callbackUrl, serviceAccountConfig);
        break;

      case AggregationDetailsMode.API:
        /** Get the JWT token */
        const token = await this.aggregator.getJWToken(serviceAccountConfig);
        aggregationDetails.token = token.jwt_token;
        break;

      default:
        throw new Error(`Invalid bank connection mode ${customer.aggregationDetails?.mode}`);
    }

    /** Update the customer, sending to Algoan the aggregationDetails */
    await this.algoanCustomerService.updateCustomer(customer.id, { aggregationDetails });
    this.logger.debug(
      `Added aggregation details to customer ${customer.id} for mode ${customer.aggregationDetails.mode}`,
    );

    return;
  }

  /**
   * Handle the "banks_details_required" event
   * Looks for a callback URL and generates a new redirect URL
   * @param serviceAccount Concerned Algoan service account attached to the subscription
   * @param payload Payload sent, containing the customer id
   */
  public async handleBanksDetailsRequiredEvent(
    serviceAccount: ServiceAccount,
    payload: BanksDetailsRequiredDTO,
  ): Promise<void> {
    /** Authenticate to algoan */
    this.algoanHttpService.authenticate(serviceAccount.clientId, serviceAccount.clientSecret);

    /** Get the customer to retrieve the callbackUrl and connection mode */
    const customer: Customer | undefined = await this.algoanCustomerService.getCustomerById(payload.customerId);

    if (customer === undefined) {
      throw new Error(`Could not retrieve customer for id "${payload.customerId}"`);
    }

    /**
     * 1. Retrieves an access token from Budget Insight to access to the user accounts
     */
    let permanentToken: string | undefined = customer.aggregationDetails?.token;
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
    let synchronizationCompleted: boolean = false;
    const timeout = moment().add(this.config.budgetInsight.synchronizationTimeout, 'seconds');
    let connections: Connection[];

    // Wait for 5s between each call
    const delayNext = async (): Promise<boolean> => {
      await delay(this.config.budgetInsight.waitingTime);

      return true;
    };

    do {
      connections = await this.aggregator.getConnections(permanentToken, serviceAccount.config as ClientConfig);
      synchronizationCompleted = connections?.every(
        // eslint-disable-next-line no-null/no-null
        (connection: Connection) => connection.state === null && connection.last_update !== null,
      ) as boolean;
    } while (!synchronizationCompleted && moment().isBefore(timeout) && (await delayNext()));

    if (!synchronizationCompleted) {
      const err = new Error('Synchronization failed');
      this.logger.warn({
        message: 'Synchronization failed after a timeout',
        customerId: customer.id,
        timeout: this.config.budgetInsight.synchronizationTimeout,
      });
      throw err;
    }

    if (isEmpty(connections)) {
      this.logger.warn('Aggregation process stopped: no active connection found');

      return;
    }

    /**
     * 3. Retrieves BI banks accounts and send them to Algoan
     */
    const accounts: BudgetInsightAccount[] = await this.aggregator.getAccounts(
      permanentToken,
      serviceAccount.config as ClientConfig,
    );
    this.logger.debug({
      message: `Budget Insight accounts retrieved for customer "${customer.id}"`,
      accounts,
    });

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

    const algoanAccounts: Account[] = mapBudgetInsightAccount(accounts, connections, connectionsInfo);

    /**
     * For each account, get and format transactions
     */
    for (const account of algoanAccounts) {
      const transactions: BudgetInsightTransaction[] = await this.aggregator.getTransactions(
        permanentToken,
        Number(account.aggregator.id),
        serviceAccount.config as ClientConfig,
      );
      this.logger.debug({
        message: `Transactions retrieved from BI for analysis "${payload.analysisId}" and account "${account.aggregator.id}"`,
        transactions,
      });
      account.transactions = await mapBudgetInsightTransactions(
        transactions,
        account,
        permanentToken,
        this.aggregator,
        serviceAccount.config as ClientConfig,
      );
    }

    /**
     * Patch the analysis with the accounts and transactions
     */
    await this.algoanAnalysisService.updateAnalysis(payload.customerId, payload.analysisId, {
      accounts: algoanAccounts,
    });
    this.logger.debug({
      message: `Analysis "${payload.analysisId}" patched`,
    });
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
