import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { BanksUserMapService } from './banks-user-map.service';

describe('BanksUserMapService', () => {
  let service: BanksUserMapService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    service = module.get<BanksUserMapService>(BanksUserMapService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a banksUserMap and get by connectionId', async () => {
    const createdBum = await service.create({
      banksUserId: 'testBu',
      connectionId: 'testConnection',
      clientId: 'testClientId',
    });
    expect(createdBum.banksUserId).toEqual('testBu');
    expect(createdBum.connectionId).toEqual('testConnection');
    expect(createdBum.clientId).toEqual('testClientId');

    const gotBum = await service.getByConnectionId('testConnection');
    expect(gotBum?.banksUserId).toEqual('testBu');
    expect(gotBum?.connectionId).toEqual('testConnection');
    expect(gotBum?.clientId).toEqual('testClientId');
  });
});
