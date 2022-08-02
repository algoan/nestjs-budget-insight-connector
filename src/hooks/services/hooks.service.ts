import { EventName, EventStatus, ServiceAccount, Subscription, SubscriptionEvent } from '@algoan/rest';
import { Inject, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as delay from 'delay';
import { isEmpty } from 'lodash';
import * as moment from 'moment';
import { Config } from 'node-config-ts';
import {
  BudgetInsightAccount,
  BudgetInsightOwner,
  BudgetInsightTransaction,
  Connection,
  ConnectionErrorState,
  JWTokenResponse,
} from '../../aggregator/interfaces/budget-insight.interface';
import { AggregatorService } from '../../aggregator/services/aggregator.service';
import { ClientConfig } from '../../aggregator/services/budget-insight/budget-insight.client';
import {
  mapBudgetInsightAccount,
  mapBudgetInsightTransactions,
} from '../../aggregator/services/budget-insight/budget-insight.utils';
import { AnalysisStatus, ErrorCodes } from '../../algoan/dto/analysis.enum';
import { Account } from '../../algoan/dto/analysis.inputs';
import { AggregationDetailsAggregatorName, AggregationDetailsMode } from '../../algoan/dto/customer.enums';
import { AggregationDetails, Customer } from '../../algoan/dto/customer.objects';
import { AlgoanAnalysisService } from '../../algoan/services/algoan-analysis.service';
import { AlgoanCustomerService } from '../../algoan/services/algoan-customer.service';
import { AlgoanHttpService } from '../../algoan/services/algoan-http.service';
import { AlgoanService } from '../../algoan/services/algoan.service';
import { CONFIG } from '../../config/config.module';
import { AggregatorLinkRequiredDTO, BanksDetailsRequiredDTO, EventDTO } from '../dto';
import { joinUserId } from '../helpers/join-user-id.helpers';

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
        const callbackUrl: string | undefined = customer.aggregationDetails.callbackUrl;
        this.logger.debug(`Found customer with id ${customer.id} and callbackUrl ${callbackUrl}`);

        if (callbackUrl === undefined) {
          throw new NotFoundException(`Customer ${customer.id} has no callback URL`);
        }

        aggregationDetails.redirectUrl = this.aggregator.generateRedirectUrl(callbackUrl, serviceAccountConfig);
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

    return;
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

      const algoanAccounts: Account[] | undefined = await this.fetchAccountsAndTransactions(
        permanentToken,
        payload,
        serviceAccount.config as ClientConfig,
      );
      if (algoanAccounts === undefined) {
        return;
      }

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
        accounts: algoanAccounts,
      });
      this.logger.debug({
        message: `Analysis "${payload.analysisId}" patched`,
      });
    } catch (err) {
      this.logger.debug({
        message: `An error occured when fetching data from the aggregator for analysis id ${payload.analysisId} and customer id ${payload.customerId}`,
        error: err,
      });

      // Update the analysis error
      await this.algoanAnalysisService.updateAnalysis(payload.customerId, payload.analysisId, {
        status: AnalysisStatus.ERROR,
        error: {
          code: ErrorCodes.INTERNAL_ERROR,
          message: `An error occured when fetching data from the aggregator`,
        },
      });

      throw err;
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
  ): Promise<Account[] | undefined> {
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
          [
            ConnectionErrorState.WRONGPASS,
            ConnectionErrorState.BUG,
            ConnectionErrorState.WEBSITE_UNAVAILABLE,
            ConnectionErrorState.PASSWORD_EXPIRED,
          ].includes(connection.state as ConnectionErrorState),
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
      const err = new Error('Synchronization failed');
      this.logger.warn({
        message: 'Synchronization failed after a timeout',
        customerId: payload.customerId,
        timeout: this.config.budgetInsight.synchronizationTimeout,
      });
      throw err;
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
     * Remove accounts with duplicated number
     */
    const accountNumberMap: Record<string, boolean | undefined> = {};
    const uniqueAccounts: BudgetInsightAccount[] = [];

    for (const account of accounts) {
      // Add accounts without number
      if (account.number === null) {
        uniqueAccounts.push(account);
        // Add accounts with number, only if it's the first time we see it
      } else if (accountNumberMap[account.number as string] === undefined) {
        accountNumberMap[account.number as string] = true;
        uniqueAccounts.push(account);
      }
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
          serviceAccountConfig,
        );
      } catch (err) {
        this.logger.warn({
          message: `Unable to get user personal information`,
          error: err,
          connection,
        });
      }
    }

    const algoanAccounts: Account[] = mapBudgetInsightAccount(
      uniqueAccounts,
      this.aggregator,
      connections,
      connectionsInfo,
      serviceAccountConfig,
    );

    /**
     * For each account, get and format transactions
     */
    for (const account of algoanAccounts) {
      const transactions: BudgetInsightTransaction[] = await this.aggregator.getTransactions(
        permanentToken,
        Number(account.aggregator.id),
        serviceAccountConfig,
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
        serviceAccountConfig,
      );
    }

    return algoanAccounts;
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
