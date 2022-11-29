import { HttpService, HttpModule } from '@nestjs/axios';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosResponse } from 'axios';
import { of } from 'rxjs';
import { AlgoanModule } from '../../../algoan/algoan.module';
import { AppModule } from '../../../app.module';
import { BudgetInsightClient } from './budget-insight.client';
import {
  AnonymousUser,
  User,
  AuthTokenResponse,
  JWTokenResponse,
  TransactionWrapper,
  AccountWrapper,
  ConnectionWrapper,
} from '../../interfaces/budget-insight.interface';
import { mockAccount, mockTransaction, mockCategory } from '../../interfaces/budget-insight-mock';
import { ClientConfig } from './budget-insight.client';
import { config } from 'node-config-ts';

describe('BudgetInsightClient', () => {
  let service: BudgetInsightClient;
  let httpService: HttpService;
  const headers = { headers: { Accept: 'application/json', 'Content-Type': 'application/json' } };
  let result: AxiosResponse = {
    data: {},
    status: 200,
    statusText: '',
    headers: {},
    config: {},
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule, HttpModule, AlgoanModule],
      providers: [BudgetInsightClient],
    }).compile();

    httpService = module.get<HttpService>(HttpService);
    service = module.get<BudgetInsightClient>(BudgetInsightClient);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns the permanent token when I register a new client', async () => {
    const authResponse: AuthTokenResponse = {
      access_token: 'mockAccessToken',
      token_type: 'mockTokenType',
    };
    result.data = authResponse;
    const token = 'token';
    const spy = jest.spyOn(httpService, 'post').mockImplementationOnce(() => of(result));

    const permToken = await service.register(token);
    expect(permToken).toBe('mockAccessToken');
    expect(spy).toHaveBeenCalledWith(
      'https://fake-budget-insights.com/2.0/auth/token/access',
      {
        client_id: 'budgetInsightClientId',
        client_secret: 'budgetInsightClientSecret',
        code: token,
      },
      headers,
    );
  });

  it('create and returns a new anonymous user', async () => {
    const user: AnonymousUser = {
      auth_token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9',
      type: 'permanent',
      id_user: 4,
      expires_in: 3600,
    };
    result.data = user;
    const spy = jest.spyOn(httpService, 'post').mockImplementationOnce(() => of(result));

    const jwtResponse = await service.createUser();
    expect(jwtResponse).toEqual(user);

    expect(spy).toHaveBeenCalledWith('https://fake-budget-insights.com/2.0/auth/init', {
      client_id: 'budgetInsightClientId',
      client_secret: 'budgetInsightClientSecret',
    });
  });

  it('returns the JWT token', async () => {
    const jwtReturn: JWTokenResponse = {
      jwt_token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9',
      payload: {
        domain: 'https://fake-budget-insights.com/2.0',
        id_user: 'userId',
      },
    };

    result.data = {
      auth_token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9',
      type: 'permanent',
      id_user: 'userId',
    };

    const spy = jest.spyOn(httpService, 'post').mockImplementationOnce(() => of(result));

    const jwtResponse = await service.getNewUserJWT();
    expect(jwtResponse).toEqual(jwtReturn);

    expect(spy).toHaveBeenCalledWith(
      'https://fake-budget-insights.com/2.0/auth/init',
      {
        client_id: 'budgetInsightClientId',
        client_secret: 'budgetInsightClientSecret',
      },
      { headers: { Accept: 'application/json', 'Content-Type': 'application/json' } },
    );
  });

  it('returns the JWT token from a user', async () => {
    const jwtReturn: JWTokenResponse = {
      jwt_token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9',
      payload: {
        domain: 'https://fake-budget-insights.com/2.0',
        id_user: 'mockUserId',
      },
    };

    result.data = {
      access_token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9',
      token_type: 'Bearer',
    };

    const spy = jest.spyOn(httpService, 'post').mockImplementationOnce(() => of(result));

    const jwtResponse = await service.getExistingUserJWT(undefined, 'mockUserId');
    expect(jwtResponse).toEqual(jwtReturn);

    expect(spy).toHaveBeenCalledWith(
      'https://fake-budget-insights.com/2.0/auth/renew',
      {
        client_id: 'budgetInsightClientId',
        client_secret: 'budgetInsightClientSecret',
        grant_type: 'client_credentials',
        id_user: 'mockUserId',
      },
      { headers: { Accept: 'application/json', 'Content-Type': 'application/json' } },
    );
  });

  it('returns the user connection information', async () => {
    const userResponse: User = {
      id: 3,
      platform: 'mockPlatform',
      signin: new Date(),
    };
    result.data = userResponse;
    const token = 'token';
    const spy = jest.spyOn(httpService, 'get').mockImplementationOnce(() => of(result));

    const user = await service.getUser(token);
    expect(user).toEqual(userResponse);
    expect(spy).toHaveBeenCalledWith('https://fake-budget-insights.com/2.0/users/me', {
      headers: {
        ...headers.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  });

  it('returns only active connections with accounts', async () => {
    const makeConnection = (id: number, active: boolean = true) => ({
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
    const sentResponse = {
      connections: [makeConnection(0), makeConnection(1, false), makeConnection(2)],
      total: 3,
    };

    result.data = sentResponse;

    const spy = jest.spyOn(httpService, 'get').mockImplementationOnce(() => of(result));

    const actualResponse = await service.fetchConnection(token);
    expect(actualResponse).toEqual([makeConnection(0), makeConnection(2)]);

    expect(spy).toHaveBeenCalledWith('https://fake-budget-insights.com/2.0/users/me/connections?expand=connector', {
      headers: {
        ...headers.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  });

  it('returns the user connection information', async () => {
    const connectionsResponse: ConnectionWrapper = {
      connections: [
        {
          id: 4,
          id_user: 6,
          id_connector: 5,
          last_update: null,
          state: null,
          active: true,
          created: null,
          next_try: null,
        },
      ],
    };
    result.data = connectionsResponse;
    const token = 'token';
    const spy = jest.spyOn(httpService, 'get').mockImplementationOnce(() => of(result));

    const connections = await service.getConnectionInfo(token, '1');
    expect(connections).toEqual(connectionsResponse);
    expect(spy).toHaveBeenCalledWith('https://fake-budget-insights.com/2.0/users/me/connections/1/informations', {
      headers: {
        ...headers.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  });

  it('returns the bank accounts', async () => {
    const accountsResponse: AccountWrapper = { accounts: [mockAccount] };
    result.data = accountsResponse;
    const token = 'token';
    const spy = jest.spyOn(httpService, 'get').mockImplementationOnce(() => of(result));

    const accounts = await service.fetchBankAccounts(token);
    expect(accounts).toEqual([mockAccount]);
    expect(spy).toHaveBeenCalledWith('https://fake-budget-insights.com/2.0/users/me/accounts', {
      headers: {
        ...headers.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  });
  it('returns the transactions', async () => {
    const moment = jest.requireActual('moment');
    const dateTime = new Date('2019-04-22T10:20:30Z').getTime();
    global.Date.now = jest.fn(() => dateTime);
    Date.now = () => dateTime;
    const transactionResponse: TransactionWrapper = {
      transactions: [mockTransaction],
    };
    const secondTransactionResponse: TransactionWrapper = {
      transactions: [],
    };
    result.data = transactionResponse;
    let secondResult: AxiosResponse = {
      data: {},
      status: 200,
      statusText: '',
      headers: {},
      config: {},
    };
    secondResult.data = secondTransactionResponse;
    const token = 'token';
    const accountId = 7;
    const spy = jest.spyOn(httpService, 'get').mockImplementationOnce(() => of(result));
    jest.spyOn(httpService, 'get').mockImplementationOnce(() => of(secondResult));

    const startDate: Date = moment(new Date(Date.now())).subtract(5, 'month').toDate();
    const url: string = `https://fake-budget-insights.com/2.0/users/me/accounts/${accountId}/transactions?limit=${
      config.budgetInsight.paginationLimit
    }&offset=0&min_date=${startDate.toISOString()}&max_date=${new Date(Date.now()).toISOString()}`;

    const transactions = await service.fetchTransactions(token, accountId);
    expect(transactions).toEqual([mockTransaction]);
    expect(spy).toHaveBeenCalledWith(url, {
      headers: {
        ...headers.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  });

  it('returns a category', async () => {
    result.data = mockCategory;
    const token = 'token';
    const categoryId = 9;
    const spy = jest.spyOn(httpService, 'get').mockImplementationOnce(() => of(result));

    const category = await service.fetchCategory(token, categoryId);
    expect(category).toEqual(mockCategory);
    expect(spy).toHaveBeenCalledWith(`https://fake-budget-insights.com/2.0/banks/categories/${categoryId}`, {
      headers: {
        ...headers.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  });

  it('returns the configs from the parameter if defined, from the configmap otherwise', async () => {
    let config: ClientConfig;

    /** Configs from the configmap */
    config = service.getClientConfig();
    expect(config).toEqual({
      baseUrl: 'https://fake-budget-insights.com/2.0',
      clientId: 'budgetInsightClientId',
      clientSecret: 'budgetInsightClientSecret',
    });

    config = service.getClientConfig({ baseUrl: 'http://test.url' } as ClientConfig);
    expect(config).toEqual({
      baseUrl: 'https://fake-budget-insights.com/2.0',
      clientId: 'budgetInsightClientId',
      clientSecret: 'budgetInsightClientSecret',
    });

    /** Configs from the parameter */
    config = service.getClientConfig({
      baseUrl: 'http://test.url/2.0',
      clientId: 'testClientId',
      clientSecret: 'testClientSecret',
    } as ClientConfig);
    expect(config).toEqual({
      baseUrl: 'http://test.url/2.0',
      clientId: 'testClientId',
      clientSecret: 'testClientSecret',
    });
  });

  it('delete the user after the account recuperation if deleteUser is true', async () => {
    const user: User = {
      id: 3,
      platform: 'mockPlatform',
      signin: new Date(),
    };

    const permanentToken = 'token';

    const spy = jest.spyOn(httpService, 'delete').mockImplementationOnce(() => of(result));

    await service.deleteUser(user.id, permanentToken);

    expect(spy).toHaveBeenCalledWith(`https://fake-budget-insights.com/2.0/users/${user.id}`, {
      headers: {
        ...headers.headers,
        Authorization: `Bearer ${permanentToken}`,
      },
    });
  });
});
