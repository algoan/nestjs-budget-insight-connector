/* eslint-disable max-lines */
import {
  EventStatus,
  ServiceAccount,
  Subscription,
  SubscriptionEvent,
  EventName as AlgoanRestEventName,
} from '@algoan/rest';
import { Inject, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as delay from 'delay';
import { isEmpty } from 'lodash';
import * as moment from 'moment';
import { Config } from 'node-config-ts';
import {
  AccountOwnership,
  BudgetInsightAccount,
  BudgetInsightOwner,
  BudgetInsightTransaction,
  Connection,
  JWTokenResponse,
} from '../../aggregator/interfaces/budget-insight.interface';
import { AggregatorService } from '../../aggregator/services/aggregator.service';
import { ClientConfig } from '../../aggregator/services/budget-insight/budget-insight.client';
import {
  mapBudgetInsightAccount,
  mapBudgetInsightTransactions,
} from '../../aggregator/services/budget-insight/budget-insight.utils';
import { EnrichedConnection } from '../../aggregator/interfaces/enriched-budget-insight.interface';
import { AnalysisStatus, ErrorCodes } from '../../algoan/dto/analysis.enum';
import { AggregationDetailsAggregatorName, AggregationDetailsMode } from '../../algoan/dto/customer.enums';
import { AggregationDetails, Customer } from '../../algoan/dto/customer.objects';
import { AlgoanAnalysisService } from '../../algoan/services/algoan-analysis.service';
import { AlgoanCustomerService } from '../../algoan/services/algoan-customer.service';
import { AlgoanHttpService } from '../../algoan/services/algoan-http.service';
import { AlgoanService } from '../../algoan/services/algoan.service';
import { CONFIG } from '../../config/config.module';
import {
  AggregatorLinkRequiredDTO,
  BanksDetailsRequiredDTO,
  EventDTO,
  ServiceAccountCreatedDTO,
  ServiceAccountUpdatedDTO,
} from '../dto';
import { joinUserId } from '../helpers/join-user-id.helpers';
import { EventName } from '../enums/event-name.enum';

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
    if (event.subscription.eventName === EventName.SERVICE_ACCOUNT_CREATED) {
      await this.handleServiceAccountCreatedEvent(event.payload as ServiceAccountCreatedDTO);
    } else {
      const aggregationStartDate: Date = new Date();
      const serviceAccount = await this.getServiceAccount(event);

      const subscription: Subscription | undefined = serviceAccount.subscriptions.find(
        (sub: Subscription) => sub.id === event.subscription.id,
      );

      /**
       * NOTE: this statement is impossible to cover
       * L.57: we are looking for a service account with the subscription id provided by the event
       * To do this, we loop into the subscriptions array. If we do not find the subscription,
       * a 401 error is sent. So necessarily, subscription is defined.
       * TODO: return SA and subscription above. This statement is just a typed-check.
       */
      if (subscription === undefined) {
        return;
      }

      if (!subscription.validateSignature(signature, event.payload as unknown as { [key: string]: string })) {
        throw new UnauthorizedException('Invalid X-Hub-Signature: you cannot call this API');
      }
      // Handle the event asynchronously
      void this.dispatchAndHandleWebhook(event, subscription, serviceAccount, aggregationStartDate);
    }

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
    aggregationStartDate: Date,
  ): Promise<void> {
    // ACKnowledged event
    const se: SubscriptionEvent = subscription.event(event.id);
    try {
      switch (event.subscription.eventName) {
        case EventName.AGGREGATOR_LINK_REQUIRED:
          await this.handleAggregatorLinkRequiredEvent(serviceAccount, event.payload as AggregatorLinkRequiredDTO);
          break;

        case EventName.BANK_DETAILS_REQUIRED:
          await this.handleBanksDetailsRequiredEvent(
            serviceAccount,
            event.payload as BanksDetailsRequiredDTO,
            aggregationStartDate,
          );
          break;

        case EventName.SERVICE_ACCOUNT_UPDATED:
          await this.handleServiceAccountUpdatedEvent(event.payload as ServiceAccountUpdatedDTO);
          break;

        // The default case should never be reached, as the eventName is already checked in the DTO
        default:
          void se.update({ status: EventStatus.FAILED });

          return;
      }
    } catch (err: unknown) {
      this.logger.error(
        { message: `An error occurred in the "dispatchAndHandleWebhook" method`, event },
        (err as { stack: string }).stack as string,
        (err as { message: string }).message as string,
      );
      void se.update({ status: EventStatus.ERROR });

      return;
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

    /** NOTE: should never be reached: if customer does not exist, a 404 error is thrown just above */
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
        const redirectCallbackUrl: string | undefined = customer.aggregationDetails.callbackUrl?.split('?')[0];
        this.logger.debug(`Found customer with id ${customer.id} and callbackUrl ${redirectCallbackUrl}`);

        if (redirectCallbackUrl === undefined) {
          throw new NotFoundException(`Customer ${customer.id} has no callback URL`);
        }

        aggregationDetails.redirectUrl = this.aggregator.generateRedirectUrl(redirectCallbackUrl, serviceAccountConfig);
        break;

      case AggregationDetailsMode.IFRAME:
        /** Generate the redirect url */
        const iframeCallbackUrl: string | undefined = customer.aggregationDetails.callbackUrl?.split('?')[0];
        this.logger.debug(`Found customer with id ${customer.id} and callbackUrl ${iframeCallbackUrl}`);

        if (iframeCallbackUrl === undefined) {
          throw new NotFoundException(`Customer ${customer.id} has no callback URL`);
        }

        aggregationDetails.iframeUrl = this.aggregator.generateRedirectUrl(iframeCallbackUrl, serviceAccountConfig);
        break;

      case AggregationDetailsMode.API:
        /** Get the JWT token */
        const token: JWTokenResponse =
          customer.aggregationDetails.userId !== undefined
            ? await this.aggregator.getJWTokenForExistingUser(serviceAccountConfig, customer.aggregationDetails.userId)
            : await this.aggregator.getJWTokenForNewUser(serviceAccountConfig);

        aggregationDetails.token = token.jwt_token;
        aggregationDetails.userId = `${token.payload.id_user}`;
        break;

      default:
        throw new Error(`Invalid bank connection mode ${customer.aggregationDetails?.mode}`);
    }

    /** Update the customer, sending to Algoan the aggregationDetails */
    await this.algoanCustomerService.updateCustomer(customer.id, { aggregationDetails });
    this.logger.debug(
      `Added aggregation details to customer ${customer.id} for mode ${customer.aggregationDetails.mode}`,
    );
  }

  /**
   * Handle the "bank_details_required" event
   * Looks for a callback URL and generates a new redirect URL
   * @param serviceAccount Concerned Algoan service account attached to the subscription
   * @param payload Payload sent, containing the customer id
   */
  public async handleBanksDetailsRequiredEvent(
    serviceAccount: ServiceAccount,
    payload: BanksDetailsRequiredDTO,
    aggregationStartDate: Date,
  ): Promise<void> {
    try {
      /** Authenticate to algoan */
      this.algoanHttpService.authenticate(serviceAccount.clientId, serviceAccount.clientSecret);

      /** Get the customer to retrieve the callbackUrl and connection mode */
      const customer: Customer | undefined = await this.algoanCustomerService.getCustomerById(payload.customerId);

      /** NOTE: should never be reached: if customer does not exist, a 404 error is thrown just above */
      if (customer === undefined) {
        throw new Error(`Could not retrieve customer for id "${payload.customerId}"`);
      }

      /**
       * 1. Retrieves an access token from Budget Insight to access to the user accounts
       */
      let permanentToken: string | undefined = customer.aggregationDetails?.token;
      let newUserId: number | undefined;
      switch (customer.aggregationDetails?.mode) {
        case AggregationDetailsMode.REDIRECT:
        case AggregationDetailsMode.IFRAME:
          if (payload.temporaryCode !== undefined && permanentToken === undefined) {
            permanentToken = await this.aggregator.registerClient(
              payload.temporaryCode,
              serviceAccount.config as ClientConfig,
            );
          }
          if (permanentToken !== undefined) {
            newUserId = await this.aggregator.getUserId(permanentToken, serviceAccount.config as ClientConfig);
          }
          break;

        case AggregationDetailsMode.API:
          if (customer.aggregationDetails?.userId === undefined) {
            this.logger.warn('User Id should be defined in API bank connection mode');
          }
          break;

        default:
          this.logger.warn(`Invalid bank connection mode ${customer.aggregationDetails?.mode}`);
          break;
      }

      // Save the new user id in the customer
      if (newUserId !== undefined) {
        const aggregationDetails: AggregationDetails = joinUserId(newUserId, customer.aggregationDetails);
        await this.algoanCustomerService.updateCustomer(customer.id, { aggregationDetails });
      }

      // Get a JWT Token from the user id if still none defined
      if (permanentToken === undefined) {
        const userId: string | undefined =
          newUserId !== undefined ? `${newUserId}` : customer.aggregationDetails?.userId?.split(',')[0];
        if (userId !== undefined) {
          permanentToken = (
            await this.aggregator.getJWTokenForExistingUser(serviceAccount.config as ClientConfig, userId)
          ).jwt_token;
        } else {
          this.logger.warn('Aggregation process stopped: no permanent token generated');

          return;
        }
      }

      const enrichedConnections: EnrichedConnection[] | undefined = await this.fetchAccountsAndTransactions(
        permanentToken,
        payload,
        serviceAccount.config as ClientConfig,
      );

      // We remove the user if deleteUsers is set to true
      if ((serviceAccount.config as ClientConfig)?.deleteUsers === true && newUserId !== undefined) {
        await this.aggregator.deleteUser(newUserId, permanentToken, serviceAccount.config as ClientConfig);
      }

      if (enrichedConnections === undefined) {
        return;
      }

      const accountOwnerships: AccountOwnership[] | undefined = await this.getAccountOwnerships(
        permanentToken,
        serviceAccount.config as ClientConfig,
      );

      const aggregationDuration: number = new Date().getTime() - aggregationStartDate.getTime();

      this.logger.log({
        message: `Account aggregation completed in ${aggregationDuration} milliseconds for Customer ${payload.customerId} and Analysis ${payload.analysisId}.`,
        aggregator: 'BUDGET_INSIGHT',
        duration: aggregationDuration,
      });

      /**
       * Patch the analysis with the accounts and transactions
       */
      await this.algoanAnalysisService.updateAnalysis(payload.customerId, payload.analysisId, {
        connections: enrichedConnections,
        accountOwnerships,
        format: 'BUDGET_INSIGHT_V2_0',
      });
      this.logger.debug({
        message: `Analysis "${payload.analysisId}" patched`,
      });
    } catch (err) {
      const host = (err as { request?: { host: string } }).request?.host;
      let message = 'An error occurred on the aggregator connector';
      if (host !== undefined) {
        message = host.includes('algoan')
          ? 'An error occurred while calling Algoan APIs'
          : 'An error occurred while fetching data from the aggregator';
      }
      const errorMessage = (err as { message?: string }).message;
      if (errorMessage?.includes('An error occurred while synchronizing data by the aggregator') === true) {
        message = errorMessage;
      }
      this.logger.debug({
        message: `An error occurred when fetching data from the aggregator for analysis id ${payload.analysisId} and customer id ${payload.customerId}`,
        error: err,
      });

      // Update the analysis error
      await this.algoanAnalysisService.updateAnalysis(payload.customerId, payload.analysisId, {
        status: AnalysisStatus.ERROR,
        error: {
          code: ErrorCodes.INTERNAL_ERROR,
          message,
        },
      });

      throw err;
    }
  }

  /**
   * Get account ownerships
   * @param token
   * @param clientConfig
   * @private
   */
  private async getAccountOwnerships(
    token: string,
    clientConfig: ClientConfig,
  ): Promise<AccountOwnership[] | undefined> {
    if (!this.config.budgetInsight.enableAccountOwnerships) {
      return undefined;
    }

    return this.aggregator.getAccountOwnerships(token, clientConfig);
  }

  /**
   * Handles the service_account_created event
   * @param payload the new service account id
   * @param subscription
   */
  public async handleServiceAccountCreatedEvent(payload: ServiceAccountCreatedDTO) {
    // eslint-disable-next-line
    if (this.config.algoan.version === 2) {
      await this.algoanService.saveServiceAccount(payload);
    }
  }

  /**
   * Handles the service_account_updated event
   * @param payload service account update dto
   */
  public async handleServiceAccountUpdatedEvent(payload: ServiceAccountUpdatedDTO) {
    // eslint-disable-next-line
    if (this.config.algoan.version === 2) {
      await this.algoanService.updateServiceAccount(payload);
    }
  }

  /**
   * Fetch accounts, connections info and transactions from BI (and format them to algoan format)
   * @param permanentToken the token to connect to BI
   * @param customerId the id of the customer
   * @param analysisId the id of the analysis to update
   * @param serviceAccountConfig Config of the concerned Algoan service account attached to the subscription
   */
  private async fetchAccountsAndTransactions(
    permanentToken: string,
    payload: BanksDetailsRequiredDTO,
    serviceAccountConfig?: ClientConfig,
  ): Promise<EnrichedConnection[] | undefined> {
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
    const checkConnectionsStartDate: Date = new Date();
    do {
      connections = await this.aggregator.getConnections(permanentToken, serviceAccountConfig);
      synchronizationCompleted = connections?.every(
        // eslint-disable-next-line no-null/no-null
        (connection: Connection) =>
          (connection.state === null && connection.last_update !== null) ||
          this.config.budgetInsight.ignoredConnectionStates.includes(connection.state as string),
      ) as boolean;
    } while (!synchronizationCompleted && moment().isBefore(timeout) && (await delayNext()));

    const checkDuration: number = new Date().getTime() - checkConnectionsStartDate.getTime();
    this.logger.log({
      message: `All Budget Insights connections are completed in ${checkDuration} milliseconds for Customer ${payload.customerId} and Analysis ${payload.analysisId}.`,
      aggregator: 'BUDGET_INSIGHT',
      duration: checkDuration,
      connectionsNb: connections.length,
    });

    if (!synchronizationCompleted) {
      this.logger.warn({
        message: 'Synchronization failed after a timeout',
        customerId: payload.customerId,
        timeout: this.config.budgetInsight.synchronizationTimeout,
        connections,
      });
      /**
       * Continue the process if there is at least a finished connection
       */
      if (connections.findIndex((connection) => connection.state === null && connection.last_update !== null) < 0) {
        let errorMessage = 'An error occurred while synchronizing data by the aggregator';
        const errorConnection: Connection | undefined = connections.find(
          (connection) => connection.error_message !== null && connection.error_message !== undefined,
        );
        if (errorConnection !== undefined) {
          errorMessage = `${errorMessage} :${errorConnection.error_message as string}`;
        }
        const err = new Error(errorMessage);
        throw err;
      }
    }

    if (isEmpty(connections)) {
      this.logger.warn('Aggregation process stopped: no active connection found');

      return undefined;
    }

    /**
     * 3. Retrieves BI banks accounts and send them to Algoan
     */
    const accounts: BudgetInsightAccount[] = await this.aggregator.getAccounts(permanentToken, serviceAccountConfig);
    this.logger.debug({
      message: `Budget Insight accounts retrieved for customer "${payload.customerId}"`,
      accounts,
    });

    /**
     * 3.b. Get personal information from every connection
     */
    const connectionsInfo: { [key: string]: BudgetInsightOwner } = await this.getConnectionsInfo(
      connections,
      permanentToken,
      serviceAccountConfig,
    );

    const enrichedConnections: EnrichedConnection[] = mapBudgetInsightAccount(
      accounts,
      this.aggregator,
      connections,
      connectionsInfo,
      serviceAccountConfig,
    );

    /**
     * For each account, get and format transactions
     */
    for (const connection of enrichedConnections) {
      const transactions: BudgetInsightTransaction[] = await this.aggregator.getTransactions(
        permanentToken,
        Number(connection.accounts[0].id),
        serviceAccountConfig,
      );
      this.logger.debug({
        message: `Transactions retrieved from BI for analysis "${payload.analysisId}" and account "${connection.accounts[0].id}"`,
        transactions,
      });
      connection.accounts[0].transactions = await mapBudgetInsightTransactions(
        transactions,
        permanentToken,
        this.aggregator,
        serviceAccountConfig,
      );
    }

    return enrichedConnections;
  }

  /**
   * Get personal information from every connection
   * @param connections
   * @param token
   * @param clientConfig
   * @private
   */
  private async getConnectionsInfo(
    connections: Connection[],
    token: string,
    clientConfig?: ClientConfig,
  ): Promise<{ [key: string]: BudgetInsightOwner }> {
    const connectionsInfo: { [key: string]: BudgetInsightOwner } = {};
    if (!this.config.budgetInsight.enableAccountOwnerships) {
      for (const connection of connections) {
        try {
          connectionsInfo[connection.id] = await this.aggregator.getInfo(token, `${connection.id}`, clientConfig);
        } catch (err) {
          this.logger.warn({
            message: `Unable to get user personal information`,
            error: err,
            connection,
          });
        }
      }
    }

    return connectionsInfo;
  }

  /**
   * Gets the Service Account given the event
   */
  public async getServiceAccount(event: EventDTO): Promise<ServiceAccount> {
    let serviceAccount = this.algoanService.algoanClient.getServiceAccountBySubscriptionId(event.subscription.id);
    // eslint-disable-next-line no-magic-numbers
    if (serviceAccount === undefined && this.config.algoan.version === 2) {
      // Update the service accounts list. If a service account is created, only one instance of the
      // connector is notified though the webhook. the other instances need to update their service account list also
      await this.algoanService.initRestHooks(
        this.config.targetUrl,
        this.config.eventList as AlgoanRestEventName[],
        this.config.restHooksSecret,
      );
      serviceAccount = this.algoanService.algoanClient.getServiceAccountBySubscriptionId(event.subscription.id);
    }
    if (serviceAccount === undefined) {
      throw new UnauthorizedException(`No service account found for subscription ${event.subscription.id}`);
    }

    return serviceAccount;
  }
}
