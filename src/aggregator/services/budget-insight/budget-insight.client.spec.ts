import { HttpService, HttpModule } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ServiceAccount } from '@algoan/rest/dist/src/core/ServiceAccount';
import { LoggerService } from '../../../core/modules/logger/logger.service';
import { CoreModule } from '../../../core/core.module';
import { AlgoanModule } from '../../../algoan/algoan.module';
import { AppModule } from '../../../app.module';
import { BudgetInsightClient } from './budget-insight.client';

describe('BudgetInsightClient', () => {
  let service: BudgetInsightClient;
  let logger: LoggerService;
  let serviceAccount: ServiceAccount;
  let httpService: HttpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule, HttpModule, CoreModule, AlgoanModule],
      providers: [BudgetInsightClient],
    }).compile();

    service = module.get<BudgetInsightClient>(BudgetInsightClient);
    serviceAccount = module.get<ServiceAccount>(ServiceAccount);
    serviceAccount.biCredentialsMap.set('serviceAccountId', {
      clientId: 'clientId',
      clientSecret: 'clientSecret',
      baseUrl: 'https://budget-insight/',
      name: 'connector-budgetInsight-psm',
    });
    logger = module.get<LoggerService>(LoggerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns the permanent token when I register a new client', async () => {
    const token = 'token';
    const spy = jest.spyOn(httpService, 'post').mockReturnValue(
      Promise.resolve([
        {
          access_token: 'permToken',
        },
        {},
        201,
      ]),
    );

    const permToken = await service.register('serviceAccountId', token);
    expect(permToken).toBe('permToken');

    expect(spy).toHaveBeenCalledWith('https://budget-insight/auth/token/access', {
      client_id: 'clientId',
      client_secret: 'clientSecret',
      code: token,
    });
  });

  it('returns the permanent token when I register a new client', async () => {
    const token = 'token';
    const spyLog = jest.spyOn(logger, 'error');
    const spy = jest.spyOn(httpService, 'post').mockReturnValue(
      Promise.reject({
        response: {
          data: {
            message: 'Code is invalid',
          },
        },
      }),
    );

    try {
      await service.register('serviceAccountId', token);
    } catch (e) {
      expect(e).toBeDefined();
    }

    expect(spy).toHaveBeenCalled();
    expect(spyLog).toHaveBeenCalledWith('failed to register to budgetInsight', {
      response: { data: { message: 'Code is invalid' } },
    });
  });

  it('returns the JWT token', async () => {
    const response: object = {
      jwt_token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9',
      payload: {
        domain: 'algoan-testa-sandbox.biapi.pro',
        id_user: 1,
        iss: 81423725,
        exp: 1586180719,
        scope: '',
        iat: 1586178919,
        type: 'sharedAccess',
      },
    };
    const spy = jest.spyOn(httpService, 'post').mockReturnValue(Promise.resolve([response, {}, 201]));

    const jwtResponse = await service.getUserJWT('serviceAccountId');
    expect(jwtResponse).toEqual(response);

    expect(spy).toHaveBeenCalledWith('https://budget-insight/auth/jwt', {
      client_id: 'clientId',
      client_secret: 'clientSecret',
    });
  });

  it('returns only active connections with accounts', async () => {
    const makeConnection = (id: number, active: boolean = true): object => ({
      id,
      id_user: 0,
      id_connector: 0,
      last_update: '2020-04-07 16:49:35.375670',
      created: '<function now at 0x7f99e9e99140>',
      active,
      last_push: '2020-04-07 16:49:35.375791',
      next_try: '2020-04-07 16:49:35.375830',
    });

    const token: string = 'my_jwt_token';
    const sentResponse: object = {
      connections: [makeConnection(0), makeConnection(1, false), makeConnection(2)],
      total: 3,
    };

    jest.spyOn(service, 'getClientConfig').mockReturnValue({
      baseUrl: 'https://test.coum',
      clientId: '1',
      clientSecret: 'secret',
    });

    const spy = jest.spyOn(httpService, 'get').mockReturnValue(Promise.resolve([sentResponse, {}, 200]));

    const actualResponse = await service.fetchConnection('serviceAccountId', token);
    expect(actualResponse).toEqual([makeConnection(0), makeConnection(2)]);

    expect(spy).toHaveBeenCalledWith('https://test.coum/users/me/connections?expand=accounts,bank', {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
  });
});
