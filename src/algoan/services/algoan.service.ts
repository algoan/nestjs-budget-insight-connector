import { Algoan, EventName, RequestBuilder, ServiceAccount, Subscription } from '@algoan/rest';
import { Injectable, OnModuleInit, InternalServerErrorException, Inject } from '@nestjs/common';
import { utilities } from 'nest-winston';
import { Config } from 'node-config-ts';
import { ServiceAccountCreatedDTO, ServiceAccountUpdatedDTO, SubscriptionDTO } from 'src/hooks/dto';
import { createLogger, format, LoggerOptions, transports } from 'winston';

import { CONFIG } from '../../config/config.module';

/**
 * Algoan service
 * Stores all methods related to Algoan
 */
@Injectable()
export class AlgoanService implements OnModuleInit {
  /**
   * Algoan client
   */
  public algoanClient!: Algoan;

  /**
   * Public base URL
   */
  public baseUrl: string;

  /**
   * API version
   */
  public version: number;

  /**
   * Service accounts stored in-memory
   */
  public serviceAccounts: ServiceAccount[];

  /**
   * Request builder instance
   */
  private readonly requestBuilder: RequestBuilder;

  constructor(@Inject(CONFIG) private readonly config: Config) {
    this.baseUrl = config.algoan.baseUrl;
    this.version = config.algoan.version ?? 1;

    const defaultLoggerOptions: LoggerOptions = {
      transports: [
        new transports.Console({
          level: 'info',
          stderrLevels: ['error'],
          consoleWarnLevels: ['warn'],
        }),
      ],
    };
    this.requestBuilder = new RequestBuilder(
      this.baseUrl,
      {
        clientId: config.algoan.clientId,
        clientSecret: config.algoan.clientSecret,
        username: config.algoan.username,
        password: config.algoan.password,
      },
      {
        logger: createLogger({ ...defaultLoggerOptions, ...config.algoan.loggerOptions }),
        debug: config.algoan.debug,
        version: this.version,
      },
    );
    this.serviceAccounts = [];
  }

  /**
   * Fetch services and creates subscription
   */
  public async onModuleInit(): Promise<void> {
    const defaultLevel: string = process.env.DEBUG_LEVEL ?? 'info';
    const nodeEnv: string | undefined = process.env.NODE_ENV;

    /**
     * Retrieve service accounts and get/create subscriptions
     */
    this.algoanClient = new Algoan({
      baseUrl: this.config.algoan.baseUrl,
      clientId: this.config.algoan.clientId,
      clientSecret: this.config.algoan.clientSecret,
      version: this.config.algoan.version,
      loggerOptions: {
        format:
          nodeEnv === 'production' ? format.json() : format.combine(format.timestamp(), utilities.format.nestLike()),
        level: defaultLevel,
        transports: [
          new transports.Console({
            level: defaultLevel,
            stderrLevels: ['error'],
            consoleWarnLevels: ['warning'],
            silent: nodeEnv === 'test',
          }),
        ],
      },
    });

    if (this.config.eventList?.length <= 0) {
      throw new InternalServerErrorException('No event list given');
    }

    await this.initRestHooks(this.config.targetUrl, this.config.eventList as EventName[], this.config.restHooksSecret);
  }

  /**
   * Init RestHooks
   * 1. Retrieves service accounts and store them in-memory
   * 2. For each service accounts, get or create subscriptions
   * @param target Unique BaseURL used for all of your services
   * @param events List of events to subscribe to
   * @param secret Optional secret, used to encrypt the X-Hub-Signature header
   */
  public async initRestHooks(target: string, events: EventName[], secret?: string): Promise<void>;
  /**
   * Init RestHooks
   * 1. Retrieves service accounts and store them in-memory
   * 2. For each service accounts, get or create subscriptions
   * @param subscriptionBodies List of subscription request body to create subscriptions
   */
  public async initRestHooks(subscriptionBodies: PostSubscriptionDTO[]): Promise<void>;

  public async initRestHooks(
    subscriptionOrTarget: string | PostSubscriptionDTO[],
    events: EventName[] = [],
    secret?: string,
  ): Promise<void> {
    this.serviceAccounts = await ServiceAccount.get(this.baseUrl, this.requestBuilder);

    if (this.serviceAccounts.length === 0) {
      return;
    }

    if (typeof subscriptionOrTarget === 'string' && events.length === 0) {
      return;
    }

    const eventNames: EventName[] =
      typeof subscriptionOrTarget === 'string'
        ? events
        : subscriptionOrTarget.map((sub: PostSubscriptionDTO) => sub.eventName);

    const subscriptionDTO: PostSubscriptionDTO[] =
      typeof subscriptionOrTarget === 'string'
        ? this.fromEventToSubscriptionDTO(subscriptionOrTarget, eventNames, secret)
        : subscriptionOrTarget;

    for (const serviceAccount of this.serviceAccounts) {
      await serviceAccount.getOrCreateSubscriptions(subscriptionDTO, eventNames);
    }
  }

  /**
   * Store the new service account in-memory and create subscriptions
   * @param serviceAccount
   * @param subscriptionDto
   */
  public async saveServiceAccount(payload: ServiceAccountCreatedDTO, subscriptionDto: SubscriptionDTO): Promise<void> {
    this.serviceAccounts = await ServiceAccount.get(this.baseUrl, this.requestBuilder);

    const serviceAccount = this.serviceAccounts.find((sa: ServiceAccount) => sa.id === payload.serviceAccountId);

    const eventNames: EventName[] = this.config.eventList as EventName[];

    if (serviceAccount !== undefined) {
      for (const event of eventNames) {
        const postSubscriptionDto: PostSubscriptionDTO = {
          eventName: event,
          target: subscriptionDto.target,
          secret: this.config.restHooksSecret,
        };

        await serviceAccount.getOrCreateSubscriptions([postSubscriptionDto]);
      }
    }
  }

  /**
   * Update the service account config
   * @param payload
   */
  public updateServiceAccount(payload: ServiceAccountUpdatedDTO): void {
    const serviceAccount = this.serviceAccounts.find((sa: ServiceAccount) => sa.id === payload.serviceAccountId);
    if (serviceAccount !== undefined) {
      serviceAccount.config = payload.config;
    }
  }

  /**
   * Get a service account with a given subscription id
   * @param subscriptionId Unique subscription identifier
   */
  public getServiceAccountBySubscriptionId(subscriptionId: string): ServiceAccount | undefined {
    return this.serviceAccounts.find((sa: ServiceAccount) =>
      sa.subscriptions.find((sub: Subscription) => sub.id === subscriptionId),
    );
  }

  /**
   * Transform a list of events to a Subscription request body
   * @param target Base URL
   * @param eventName List of events
   * @param secret Secret
   */
  private readonly fromEventToSubscriptionDTO = (
    target: string,
    events: EventName[],
    secret?: string,
  ): PostSubscriptionDTO[] =>
    events.map(
      (event: EventName): PostSubscriptionDTO => ({
        target,
        secret,
        eventName: event,
      }),
    );
}

/**
 * POST /subscriptions DTO interface
 */
export interface PostSubscriptionDTO {
  /** Event name to subscribe */
  eventName: EventName;
  /** URL of your service */
  target: string;
  /** Secret to decrypt x-hub-signature (more info [here](https://developers.algoan.com/public/docs/algoan_documentation/resthooks_and_events/resthooks.html#validating-resthook-events)) */
  secret?: string;
}
