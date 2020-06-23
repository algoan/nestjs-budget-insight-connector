import { HttpModule, Module } from '@nestjs/common';
import { AlgoanModule } from '../algoan/algoan.module';
import { AggregatorService } from './services/aggregator.service';
import { BudgetInsightClient } from './services/budget-insight/budget-insight.client';

/**
 * AggregatorModule
 */
@Module({
  imports: [HttpModule, AlgoanModule],
  providers: [AggregatorService, BudgetInsightClient],
  exports: [AggregatorService],
})
export class AggregatorModule {}
