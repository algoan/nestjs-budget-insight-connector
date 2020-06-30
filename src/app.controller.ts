import { Controller, Get, HttpCode, HttpStatus, Render } from '@nestjs/common';
import { config } from 'node-config-ts';
import { Subscription, EventName } from '@algoan/rest';

import { AppService } from './app.service';
import { AlgoanService } from './algoan/algoan.service';

/**
 * App Controller with a GET / API
 */
@Controller()
export class AppController {
  constructor(private readonly appService: AppService, private readonly algoanService: AlgoanService) {}

  /**
   * GET / Hello
   */
  @Get('/ping')
  @HttpCode(HttpStatus.NO_CONTENT)
  public getPing(): string {
    return this.appService.getPing();
  }

  /**
   * Root index.html page to test BI process locally
   * NOTE: ⚠️ Should not be used in production
   */
  @Get()
  @Render('index')
  public async root(): Promise<IRootResult> {
    const appUrl: string = `http://localhost:${config.port}`;

    const subscription: Subscription = this.algoanService.algoanClient.serviceAccounts[0].subscriptions.find((sub: Subscription) => {
      return sub.eventName === EventName.BANKREADER_LINK_REQUIRED;
    }); 

    return {
      baseUrl: appUrl,
      callbackUrl: appUrl,
      subscription,
      token: await this.algoanService.algoanClient.serviceAccounts[0].getAuthorizationHeader(),
      algoanBaseUrl: config.algoan.baseUrl,
    };
  }
}

interface IRootResult {
  baseUrl: string;
  algoanBaseUrl: string;
  subscription: Subscription,
  token: string;
  callbackUrl: string,
}