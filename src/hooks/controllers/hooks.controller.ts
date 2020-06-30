import { Body, Controller, Headers, HttpCode, HttpStatus, Post, LoggerService } from '@nestjs/common';
import { ServiceAccount, EventName } from '@algoan/rest';
import { EventDTO } from '../dto/event.dto';
import { HooksService } from '../services/hooks.service';
/**
 * Headers interface
 */
interface Headers {
  'x-hub-signature': string;
}

/**
 * Hooks controller
 */
@Controller()
export class HooksController {
  constructor(private readonly hooksService: HooksService, private readonly logger: LoggerService) {}

  /**
   * Hooks route
   */
  @Post('/hooks')
  @HttpCode(HttpStatus.NO_CONTENT)
  public async controlHook(@Body() event: EventDTO, @Headers() headers: Headers): Promise<void> {
    return this.hooksService.handleWebhook(event, headers['x-hub-signature']);
  }

  /**
   * Handle hooks for BudgetInsight.
   * Throws an error if it was not found
   * @param event The current Event
   * @param headers the validation Header received from the request
   */
  public async handleBudgetInsightEvent(@Body() event: BIEvent): Promise<void> {
    this.logger.debug(`event for connection synced: ${event}`);
    this.eventService
      .patchBanksUserConnectionSync(event)
      .then(() => {
        this.logger.debug('BanksUser updated with success after connection sync');
      })
      .catch((e: Error) => {
        this.logger.error(`Could not update the BanksUser after connection sync: ${e.message}`, e);
      });

    return Promise.resolve();
  }

  /**
   * Handle hooks for Algoan.
   * Throws an error if it was not found
   * @param event The current Event
   * @param headers the validation Header received from the request
   */
  public async handleAlgoanEvent(@Body() event: EventDTO, @Headers() headers: Headers): Promise<void> {
    const serviceAccount: ServiceAccount = this.getServiceAccount(event, headers['x-hub-signature']);
    switch (event.subscription.eventName) {
      case EventName.BANKREADER_CONFIGURATION_REQUIRED:
        this.logger.debug(
          `Start ${EventName.BANKREADER_CONFIGURATION_REQUIRED} process for banksUsers ${
            (event.payload as BankreaderConfigurationRequired).banksUserId
          }`,
        );

        this.hooksService
          .getSandboxToken(serviceAccount, event.payload as BankreaderConfigurationRequired)
          .catch((e: Error) => {
            this.logger.error(`Could not add the sandbox to the bank user: ${e.message}`, e);
          });
        break;
      case EventName.BANKREADER_LINK_REQUIRED:
        this.logger.debug(
          `Start ${EventName.BANKREADER_LINK_REQUIRED} process for banksUsers ${
            (event.payload as BankreaderLinkRequired).banksUserId
          }`,
        );
        this.hooksService
          .generateRedirectUrl(serviceAccount, event.payload as BankreaderLinkRequired)
          .catch((e: Error) => {
            this.logger.error(`Could not add the redirection Url to the bank user: ${e.message}`, e);
          });
        break;
      case EventName.BANKREADER_REQUIRED:
        this.logger.debug(
          `Start ${EventName.BANKREADER_REQUIRED} process for banksUsers ${
            (event.payload as BankreaderLinkRequired).banksUserId
          }`,
        );
        this.hooksService
          .synchronizeBanksUser(serviceAccount, event.payload as BankreaderRequired)
          .then(() => {
            this.logger.debug('User synchronised with success');
          })
          .catch((e: Error) => {
            this.logger.error(`Could not synchronise user : ${e.message}`, e);
          });
        break;
      case EventName.SERVICE_ACCOUNT_CREATED:
        this.logger.debug(
          `Start ${EventName.SERVICE_ACCOUNT_CREATED} process for serviceAccount ${
            (event.payload as ServiceAccountCreated).serviceAccountId
          }`,
        );

        this.hooksService
          .addServiceAccount(event.payload as ServiceAccountCreated)
          .then(() => {
            this.logger.debug('Service Account added with success');
          })
          .catch((e: Error) => {
            this.logger.error(`Could not add the Service Account :${e.message}`, e);
          });
        break;
      case EventName.SERVICE_ACCOUNT_DELETED:
        this.logger.debug(
          `Start ${EventName.SERVICE_ACCOUNT_CREATED} process for serviceAccount ${
            (event.payload as ServiceAccountCreated).serviceAccountId
          }`,
        );

        this.hooksService
          .removeServiceAccount(event.payload as ServiceAccountDeleted)
          .then(() => {
            this.logger.debug('Service Account deleted with success');
          })
          .catch((e: Error) => {
            this.logger.error(`Could not delete the Service Account : ${e.message}`, e);
          });
        break;
      default:
        throw new BadRequestException('Invalid eventName');
    }

    return Promise.resolve();
  }
}
