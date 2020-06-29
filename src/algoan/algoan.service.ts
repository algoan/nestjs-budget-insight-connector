import { Algoan, EventName } from '@algoan/rest';
import { Injectable, OnModuleInit, InternalServerErrorException } from '@nestjs/common';
import { config } from 'node-config-ts';

/**
 * Algoan service
 * Stores all methods related to Algoan
 */
@Injectable()
export class AlgoanService implements OnModuleInit {
  /**
   * Algoan client
   */
  public algoanClient?: Algoan;

  /**
   * Fetch services and creates subscription
   */
  public async onModuleInit(): Promise<void> {
    /**
     * Retrieve service accounts and get/create subscriptions
     */
    this.algoanClient = new Algoan({
      baseUrl: config.algoan.baseUrl,
      clientId: config.algoan.clientId,
      clientSecret: config.algoan.clientSecret,
    });

    if (config.eventList === undefined) {
      throw new InternalServerErrorException('No event list given');
    }

    await this.algoanClient.initRestHooks(config.targetUrl, config.eventList as EventName[], config.restHooksSecret);
  }
}
