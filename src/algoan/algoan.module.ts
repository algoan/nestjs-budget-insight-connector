import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { AlgoanService } from './algoan.service';
import { BanksUserService } from './services/banks-user/banks-user.service';
import { BanksUserMapService } from './services/banks-user-map/banks-user-map.service';
import { ConfigService } from './services/config/config.service';
import { BanksUserMap } from './models/banks-user-map';

/**
 * Algoan module
 */
@Module({
  providers: [AlgoanService, BanksUserService, BanksUserMapService, ConfigService],
  exports: [AlgoanService, BanksUserService, BanksUserMapService, ConfigService],
  imports: [TypegooseModule.forFeature([BanksUserMap])],
})
export class AlgoanModule {}
