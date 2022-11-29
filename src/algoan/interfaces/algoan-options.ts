import { LoggerOptions } from 'winston';

/**
 * Algoan constructor options
 */
export interface IAlgoanOptions {
  clientId: string;
  clientSecret?: string;
  baseUrl: string;
  username?: string;
  password?: string;
  debug?: boolean;
  loggerOptions?: LoggerOptions;
  version?: number;
}

export type AlgoanOptions = IAlgoanOptions;
