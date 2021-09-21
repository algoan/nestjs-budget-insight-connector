import { HttpModule } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AlgoanModule } from '../../algoan/algoan.module';
import { AppModule } from '../../app.module';
import { Connection } from '../interfaces/budget-insight.interface';
import { mockAccount, mockTransaction, mockCategory } from '../interfaces/budget-insight-mock';
import { AggregatorService } from './aggregator.service';
import { BudgetInsightClient } from './budget-insight/budget-insight.client';

describe('AggregatorService', () => {
  let service: AggregatorService;
  let client: BudgetInsightClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule, HttpModule, AlgoanModule],
      providers: [AggregatorService, BudgetInsightClient],
    }).compile();

    service = module.get<AggregatorService>(AggregatorService);
    client = module.get<BudgetInsightClient>(BudgetInsightClient);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register user on budget insight', async () => {
    const spy = jest.spyOn(client, 'register').mockReturnValue(Promise.resolve('permToken'));
    const token = 'token';
    await service.registerClient(token);

    expect(spy).toBeCalledWith(token, undefined);
  });

  it('should create an anonymous user and return its id', async () => {
    const spy = jest.spyOn(client, 'createUser').mockReturnValue(
      Promise.resolve({
        id_user: 1,
        auth_token: 'mickToken',
        type: 'permanent',
        expires_in: 3000,
      }),
    );

    expect(await service.createUser()).toBe(1);
    expect(spy).toBeCalledWith(undefined);
  });

  it('should get userId from its token', async () => {
    const spy = jest.spyOn(client, 'getUser').mockReturnValue(
      Promise.resolve({
        id: 2,
        signin: new Date(),
        platform: 'mockPlatform',
      }),
    );

    expect(await service.getUserId('mockToken')).toBe(2);
    expect(spy).toBeCalledWith('mockToken', undefined);
  });

  it('should get the jwt token', async () => {
    const spy = jest.spyOn(client, 'getUserJWT').mockReturnValue(
      Promise.resolve({
        jwt_token: 'mockJwt',
        payload: {
          domain: 'mockDomain',
          id_user: 'userId',
        },
      }),
    );
    await service.getJWToken();

    expect(spy).toBeCalled();
  });

  it('should get the jwt token from a user', async () => {
    const spy = jest.spyOn(client, 'getUserJWT').mockReturnValue(
      Promise.resolve({
        jwt_token: 'mockJwt',
        payload: {
          domain: 'mockDomain',
          id_user: 'userId',
        },
      }),
    );
    await service.getJWToken(undefined, 'mockUserId');

    expect(spy).toBeCalledWith(undefined, 'mockUserId');
  });

  it('should create the webviewUrl base on the callbackUrl', () => {
    const url: string = service.generateRedirectUrl('callbackUrl');
    expect(url).toBe(
      'http://localhost:4000/auth/webview/fr/connect?client_id=budgetInsightClientId&redirect_uri=callbackUrl&response_type=code&state=&types=banks',
    );
  });

  it('should get the accounts', async () => {
    const spy = jest.spyOn(client, 'fetchBankAccounts').mockReturnValue(Promise.resolve([mockAccount]));
    const token = 'token';
    await service.getAccounts(token);

    expect(spy).toBeCalledWith(token, undefined);
  });

  it('should get the transactions', async () => {
    const spy = jest.spyOn(client, 'fetchTransactions').mockReturnValue(Promise.resolve([mockTransaction]));
    const token = 'token';
    const accountId = 7;
    await service.getTransactions(token, accountId);

    expect(spy).toBeCalledWith(token, accountId, undefined);
  });

  it('should get the connections', async () => {
    const connection: Connection = {
      id: 4,
      id_user: 6,
      id_connector: 5,
      last_update: 'mockLastUpdate',
      state: null,
      active: true,
      created: null,
      next_try: null,
    };
    const spy = jest.spyOn(client, 'fetchConnection').mockReturnValue(Promise.resolve([connection]));
    const token = 'token';
    await service.getConnections(token);

    expect(spy).toBeCalledWith(token, undefined);
  });

  it('should get the categories', async () => {
    const spy = jest.spyOn(client, 'fetchCategory').mockReturnValue(Promise.resolve(mockCategory));
    const token = 'token';
    const categoryId = 7;
    await service.getCategory(token, categoryId);

    expect(spy).toBeCalledWith(token, categoryId, undefined);
  });
});
