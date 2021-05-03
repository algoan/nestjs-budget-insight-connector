import { Controller, Get, HttpCode, HttpStatus, Param, Query, Render } from '@nestjs/common';
import { config } from 'node-config-ts';
import { Subscription, EventName } from '@algoan/rest';

import { AppService } from './app.service';
import { AlgoanService } from './algoan/services/algoan.service';

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
}
