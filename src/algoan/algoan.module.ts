import { Module } from '@nestjs/common';
import { AlgoanService } from './algoan.service';
import { BanksUserService } from './services/banks-user/banks-user.service';

/**
 * Algoan module
 */
@Module({
  providers: [AlgoanService, BanksUserService],
  exports: [AlgoanService, BanksUserService],
})
export class AlgoanModule {}
