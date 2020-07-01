import { Injectable } from '@nestjs/common';
import { ReturnModelType } from '@typegoose/typegoose';
import { InjectModel } from 'nestjs-typegoose';
import { BanksUserMap } from '../../models/banks-user-map';

/**
 * BanksUserMapService
 */
@Injectable()
export class BanksUserMapService {
  constructor(
    @InjectModel(BanksUserMap)
    private readonly banksUserMapModel: ReturnModelType<typeof BanksUserMap>,
  ) {}

  /**
   * Create a banksUserMap
   */
  public async create(createBanksUserMap: {
    banksUserId: string;
    connectionId: string;
    clientId: string;
  }): Promise<BanksUserMap> {
    const createdBanksUserMap = new this.banksUserMapModel(createBanksUserMap);

    return createdBanksUserMap.save();
  }

  /**
   * Get a banksUserMap by connectionId
   */
  public async getByConnectionId(connectionId: string): Promise<BanksUserMap | null> {
    return this.banksUserMapModel.findOne({ connectionId });
  }
}
