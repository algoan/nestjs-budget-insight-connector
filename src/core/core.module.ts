import { Global, Module } from '@nestjs/common';
import { ConfigModule } from './modules/config/config.module';
import { LoggerModule } from './modules/logger/logger.module';

/**
 * Core Module
 */
@Global()
@Module({
  imports: [LoggerModule, ConfigModule],
  exports: [LoggerModule, ConfigModule],
})
export class CoreModule {}
