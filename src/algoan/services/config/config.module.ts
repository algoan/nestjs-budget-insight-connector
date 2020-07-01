import { Module } from '@nestjs/common';
import 'dotenv';
import { ConfigService, NodeEnv } from './config.service';

/**
 * ConfigService
 */
@Module({
  providers: [
    {
      provide: ConfigService,
      useValue: new ConfigService(process.env.NODE_ENV as NodeEnv),
    },
  ],
  exports: [ConfigService],
})
export class ConfigModule {}
