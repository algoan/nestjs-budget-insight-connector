import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  LoggerService,
  BadRequestException,
} from '@nestjs/common';
import { ServiceAccount, EventName } from '@algoan/rest';
import { EventDTO } from '../dto/event.dto';
import { BIEvent } from '../dto/bi-event.dto';
import { HooksService } from '../services/hooks.service';
import { BankreaderLinkRequiredDTO } from '../dto/bandreader-link-required.dto';
import { BankreaderConfigurationRequiredDTO } from '../dto/bankreader-configuration-required.dto';
import { BankreaderRequiredDTO } from '../dto/bankreader-required.dto';
import { ServiceAccountCreatedDTO } from '../dto/service-account-created.dto';
import { ServiceAccountDeletedDTO } from '../dto/service-account-deleted.dto';

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
    this.hooksService
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
    switch (event.subscription.eventName) {
      case EventName.BANKREADER_CONFIGURATION_REQUIRED:
        this.logger.debug(
          `Start ${EventName.BANKREADER_CONFIGURATION_REQUIRED} process for banksUsers ${
            (event.payload as BankreaderConfigurationRequiredDTO).banksUserId
          }`,
        );

        this.hooksService
          .getSandboxToken(serviceAccount, event.payload as BankreaderConfigurationRequiredDTO)
          .catch((e: Error) => {
            this.logger.error(`Could not add the sandbox to the bank user: ${e.message}`, e);
          });
        break;
      case EventName.BANKREADER_LINK_REQUIRED:
        this.logger.debug(
          `Start ${EventName.BANKREADER_LINK_REQUIRED} process for banksUsers ${
            (event.payload as BankreaderLinkRequiredDTO).banksUserId
          }`,
        );
        this.hooksService
          .generateRedirectUrl(serviceAccount, event.payload as BankreaderLinkRequiredDTO)
          .catch((e: Error) => {
            this.logger.error(`Could not add the redirection Url to the bank user: ${e.message}`, e);
          });
        break;
      case EventName.BANKREADER_REQUIRED:
        this.logger.debug(
          `Start ${EventName.BANKREADER_REQUIRED} process for banksUsers ${
            (event.payload as BankreaderLinkRequiredDTO).banksUserId
          }`,
        );
        this.hooksService
          .synchronizeBanksUser(serviceAccount, event.payload as BankreaderRequiredDTO)
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
            (event.payload as ServiceAccountCreatedDTO).serviceAccountId
          }`,
        );

        this.hooksService
          .addServiceAccount(event.payload as ServiceAccountCreatedDTO)
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
            (event.payload as ServiceAccountCreatedDTO).serviceAccountId
          }`,
        );

        this.hooksService
          .removeServiceAccount(event.payload as ServiceAccountDeletedDTO)
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
