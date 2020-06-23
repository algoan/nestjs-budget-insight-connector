import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AlgoanModule } from './algoan/algoan.module';
import { HooksModule } from './hooks/hooks.module';

/**
 * App module
 */
@Module({
  imports: [AlgoanModule, HooksModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
