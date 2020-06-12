import { Injectable } from '@nestjs/common';

/**
 * App service
 */
@Injectable()
export class AppService {
  /**
   * GET Hello
   */
  public getHello = (): string => 'Hello World!';
}
