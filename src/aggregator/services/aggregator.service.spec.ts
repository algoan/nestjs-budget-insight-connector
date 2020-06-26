import { HttpModule } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CoreModule } from '../../core/core.module';
import { BanksUser, UserStatus } from '../../algoan/interfaces/algoan.interface';
import { AlgoanModule } from '../../algoan/algoan.module';
import { AppModule } from '../../app.module';
import { AggregatorService } from './aggregator.service';
import { BudgetInsightClient } from './budget-insight/budget-insight.client';

describe('AggregatorService', () => {
  let service: AggregatorService;
  let client: BudgetInsightClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule, CoreModule, HttpModule, AlgoanModule],
      providers: [AggregatorService, BudgetInsightClient],
    }).compile();

    service = module.get<AggregatorService>(AggregatorService);
    service.biCredentialsMap.set('serviceAccountId', {
      clientId: 'clientId',
      clientSecret: 'clientSecret',
      baseUrl: 'https://budget-insight/',
      name: 'connector-budgetInsight-psm',
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register user on budget insight', () => {
    const spy = jest.spyOn(client, 'register').mockReturnValue(Promise.resolve('permToken'));
    const token = 'token';
    service.registerClient('serviceAccountId', token);

    expect(spy).toBeCalledWith('serviceAccountId', token);
  });

  it('should create the webviewUrl base on the callbackUrl', () => {
    const banksUser: BanksUser = {
      id: 'id',
      callbackUrl: 'callbackUrl',
      status: UserStatus.NEW,
    };
    const url: string = service.generateRedirectUrl('serviceAccountId', banksUser);
    expect(url).toBe(
      'https://budget-insight/auth/webview/fr/connect?client_id=clientId&redirect_uri=callbackUrl&response_type=code&state=&types=banks',
    );
  });
});
