import { Module } from '@nestjs/common';
import { AlgoanService } from './algoan.service';

/**
 * Algoan module
 */
@Module({
  providers: [AlgoanService],
})
export class AlgoanModule {}
