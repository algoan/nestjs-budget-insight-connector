import { ServiceAccount, Subscription, EventName, EventStatus, SubscriptionEvent } from '@algoan/rest';
import { Inject, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Config } from 'node-config-ts';

import { AggregatorService } from '../../aggregator/services/aggregator.service';
import { ClientConfig } from '../../aggregator/services/budget-insight/budget-insight.client';
import { Customer, AggregationDetails } from '../../algoan/dto/customer.objects';
import { AggregationDetailsAggregatorName, AggregationDetailsMode } from '../../algoan/dto/customer.enums';
import { AlgoanCustomerService } from '../../algoan/services/algoan-customer.service';
import { AlgoanHttpService } from '../../algoan/services/algoan-http.service';
import { AlgoanService } from '../../algoan/services/algoan.service';
import { CONFIG } from '../../config/config.module';
import { AggregatorLinkRequiredDTO, EventDTO } from '../dto';

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
    const customer: Customer = await this.algoanCustomerService.getCustomerById(payload.customerId);

    /** Init the aggregationDetails' response  */
    const serviceAccountConfig: ClientConfig = serviceAccount.config as ClientConfig;
    const aggregationDetails: AggregationDetails = {
      aggregatorName: AggregationDetailsAggregatorName.BUDGET_INSIGHT,
      apiUrl: serviceAccountConfig?.baseUrl ?? this.config.budgetInsight.url,
      clientId: serviceAccountConfig?.clientId ?? this.config.budgetInsight.clientId,
    };

    switch (customer.aggregationDetails.mode) {
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
        aggregationDetails.apiUrl = token.payload.domain ?? aggregationDetails.apiUrl;
        break;

      default:
        throw new Error(`Invalid bank connection mode ${customer.aggregationDetails.mode}`);
    }

    /** Update the customer, sending to Algoan the aggregationDetails */
    await this.algoanCustomerService.updateCustomer(customer.id, { aggregationDetails });
    this.logger.debug(
      `Added aggregation details to customer ${customer.id} for mode ${customer.aggregationDetails.mode}`,
    );

    return;
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
