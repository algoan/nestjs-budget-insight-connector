import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AlgoanModule } from './algoan/algoan.module';

/**
 * App module
 */
@Module({
  imports: [AlgoanModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
