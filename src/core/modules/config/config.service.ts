import { readFileSync } from 'fs';
import { Logger, OnModuleInit } from '@nestjs/common';
import * as yaml from 'js-yaml';
import { get, isEmpty } from 'lodash';
import { format, LoggerOptions, transports } from 'winston';
import { version } from '../../../../package.json';

/* tslint:disable */

/**
 * Config generic properties
 */
export interface GlobalConfig {
  [key: string]: any;
}

/**
 * Constant config key
 */
export enum ConfigKey {
  PORT = 'PORT',
  APPMODE = 'appmode',
}

export enum BudgetInsightKey {
  COFIDIS_CLIENT_ID = 'budget-insight.cofidis.client-id',
  BASE_URL = 'budget-insight.url',
}

export enum BudgetInsightKey {
  COFIDIS_CLIENT_SECRET = 'budget-insight.cofidis.client-secret',
}

export enum AlgoanKey {
  BASE_URL = 'algoan.url',
  CLIENT_ID = 'algoan.client-id',
}

export enum AlgoanKey {
  CLIENT_SECRET = 'algoan.client-secret',
}

export enum ConnectorKey {
  HOOKS_URL = 'connector.hooks-url',
  VALIDATION_ACTIVATED = 'connector.validation-activated',
}

/**
 * Constant config key
 */
export enum SecretKey {}

/**
 * Node environment
 */
export type NodeEnv = 'production' | 'development' | 'test';

/**
 * Algoan environment
 */
export type AlgoanEnv = 'production' | 'preprod' | 'staging' | 'development';

/**
 * Config service
 */
export class ConfigService implements OnModuleInit {
  /**
   * Config linked to Kubernetes configmaps
   */
  public config: GlobalConfig;

  /**
   * Config linked to Kubernetes secrets
   */
  public secret: GlobalConfig;

  /**
   * Node environment
   */
  public nodeEnv: NodeEnv;

  /**
   * Algoan environment
   */
  public algoanEnv: AlgoanEnv;

  /**
   * Algoan environment
   */
  public isDevEnv: boolean;

  /**
   * API version, extracted from package.json
   */
  public apiVersion: number;

  /**
   * Package version
   */
  public packageVersion: string;

  constructor(nodeEnv: NodeEnv = process.env.NODE_ENV as NodeEnv) {
    this.nodeEnv = isEmpty(nodeEnv) ? 'development' : nodeEnv;
    const fileName: string = this.nodeEnv === 'development' ? 'default' : nodeEnv;
    this.algoanEnv = isEmpty(process.env.ALGOAN_ENV) ? 'development' : (process.env.ALGOAN_ENV as AlgoanEnv);
    this.isDevEnv = nodeEnv === 'development';
    this.packageVersion = version;
    this.apiVersion = Number(version.split('.')[0]);
    try {
      const loadConfig: GlobalConfig = yaml.safeLoad(readFileSync(`./config/${fileName}.yaml`, 'utf8'));
      this.config = {
        ...process.env,
        ...(isEmpty(loadConfig) ? {} : loadConfig),
      };
      const loadSecret: GlobalConfig = yaml.safeLoad(readFileSync(`./secret/${fileName}.yaml`, 'utf8'));
      this.secret = isEmpty(loadSecret) ? {} : loadSecret;
    } catch (err) {
      if (this.nodeEnv === 'production') {
        throw new Error(`An error occurred when loading configuration files: ${err.message}`);
      }

      this.config = { ...process.env };
      this.secret = {};
    }
  }

  /**
   * Init Service
   */
  public onModuleInit(): void {
    Logger.debug(`Init ${ConfigService.name}`);
  }
  /**
   * Get a config property
   * @param key key property
   */
  public getConfig(key: string | string[]): any {
    return get(this.config, key);
  }

  /**
   * Get a config property cast to number
   * @param key key property
   */
  public getConfigNumber(key: string | string[]): any {
    const response = this.getConfig(key);

    return Number(response) || undefined;
  }

  /**
   * Get a secret property
   * @param key key property
   */
  public getSecret(key: string | string[]): any {
    return get(this.secret, key);
  }

  /**
   * Return logger options on app init
   */
  public getLoggerOptions(): LoggerOptions {
    const defaultLevel: string = process.env.DEBUG_LEVEL || 'info';

    return {
      format:
        this.nodeEnv === 'production'
          ? format.json()
          : format.combine(
              format.colorize({
                colors: {
                  debug: 'blue',
                  error: 'red',
                  info: 'green',
                  warn: 'yellow',
                },
              }),
              format.simple(),
              format.errors({ stack: true }),
            ),
      level: defaultLevel,
      transports: [
        new transports.Console({
          level: defaultLevel,
          stderrLevels: ['error'],
          consoleWarnLevels: ['warn'],
        }),
      ],
    };
  }
}
/* tslint:enable */
