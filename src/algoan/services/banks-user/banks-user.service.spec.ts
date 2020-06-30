import { Test, TestingModule } from '@nestjs/testing';
import { ServiceAccount, BanksUser, BanksUserStatus, ReliabilityStatus } from '@algoan/rest';

import { AlgoanModule } from '../../algoan.module';
import { AppModule } from '../../../app.module';
import { BanksUserService } from './banks-user.service';

describe('BanksUserService', () => {
  let service: BanksUserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule, AlgoanModule],
      providers: [BanksUserService],
    }).compile();

    service = module.get<BanksUserService>(BanksUserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register the url on service', async () => {
    const banksUser: BanksUser = {
      id: 'id',
      callbackUrl: 'callbackUrl',
      status: BanksUserStatus.NEW,
      // new
      redirectUrl: 'redirectUrl',
      redirectUrlCreatedAt: 1,
      redirectUrlTTL: 1,
      scores: [],
      analysis: {
        alerts: [],
        regularCashFlows: [],
        reliability: ReliabilityStatus.MEDIUM,
      },
      requestBuilder: {},
    };

    const registerSpy = jest
      .spyOn(algoanService.algoanClient, 'assignRedirectUrl')
      .mockReturnValue(Promise.resolve(banksUser));

    const serviceAccount: ServiceAccount = {
      id: 'serviceAccountId',
      clientId: 'clientId',
    };
    const url: string = 'url';

    await service.registerRedirectUrl(serviceAccount, banksUser, url);

    expect(registerSpy).toHaveBeenCalled();
  });
});
