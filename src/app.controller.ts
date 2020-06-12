import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

/**
 * App Controller with a GET / API
 */
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * GET / Hello
   */
  @Get()
  public getHello(): string {
    return this.appService.getHello();
  }
}
