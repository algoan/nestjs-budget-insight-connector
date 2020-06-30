import { Test, TestingModule } from '@nestjs/testing';
import { ServiceAccount, BanksUser } from '@algoan/rest';
import { AlgoanService } from '../../algoan.service';

import { AlgoanModule } from '../../algoan.module';
import { AppModule } from '../../../app.module';
import { BanksUserService } from './banks-user.service';

describe('BanksUserService', () => {
  let service: BanksUserService;
  let algoanService: AlgoanService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule, AlgoanModule],
      providers: [BanksUserService],
    }).compile();

    service = module.get<BanksUserService>(BanksUserService);
    algoanService = module.get<AlgoanService>(AlgoanService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register the url on service', async () => {
    const banksUser: BanksUser = {
      id: 'id',
      callbackUrl: 'callbackUrl',
      status: UserStatus.NEW,
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
