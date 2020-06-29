import { OnModuleInit } from '@nestjs/common';
import { Ylogger } from '@yelloan/logger';

export class LoggerService implements OnModuleInit {
  private readonly logger: Ylogger;

  constructor() {
    this.logger = new Ylogger(__filename);
  }

  public onModuleInit() {
    this.logger.debug('Init Logger');
  }

  public log(message: string): void {
    this.logger.info(message);
  }
  public error(message: string, error?: Error): void {
    this.logger.error(message, error);
  }
  public warn(message: string, payload: {} = {}): void {
    this.logger.warn(message, payload);
  }
  public debug(message: string): void {
    this.logger.debug(message);
  }
}
