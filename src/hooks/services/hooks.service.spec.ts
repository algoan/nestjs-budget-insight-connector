/* eslint-disable max-lines */
import { Test, TestingModule } from '@nestjs/testing';
import { ContextIdFactory } from '@nestjs/core';
import { Algoan, ServiceAccount, EventName, Subscription, RequestBuilder } from '@algoan/rest';

import { EventDTO } from '../dto';
import { AggregationDetailsMode } from '../../algoan/dto/customer.enums';
import { Customer } from '../../algoan/dto/customer.objects';
import { Analysis } from '../../algoan/dto/analysis.objects';
import { AggregatorModule } from '../../aggregator/aggregator.module';
import { mockAccount, mockTransaction, mockCategory } from '../../aggregator/interfaces/budget-insight-mock';
import { Connection } from '../../aggregator/interfaces/budget-insight.interface';
import { AggregatorService } from '../../aggregator/services/aggregator.service';
import { AlgoanModule } from '../../algoan/algoan.module';
import { AppModule } from '../../app.module';
import { AlgoanService } from '../../algoan/services/algoan.service';
import { AlgoanCustomerService } from '../../algoan/services/algoan-customer.service';
import { AlgoanAnalysisService } from '../../algoan/services/algoan-analysis.service';
import { AlgoanHttpService } from '../../algoan/services/algoan-http.service';
import { ConfigModule } from '../../config/config.module';
import { HooksService } from './hooks.service';
import { AnalysisStatus, ErrorCodes } from '../../algoan/dto/analysis.enum';

describe('HooksService', () => {
  let hooksService: HooksService;
  let aggregatorService: AggregatorService;
  let algoanService: AlgoanService;
  let algoanHttpService: AlgoanHttpService;
  let algoanCustomerService: AlgoanCustomerService;
  let algoanAnalysisService: AlgoanAnalysisService;
  const mockEvent = {
    subscription: {
      id: 'mockEventSubId',
      target: 'https://bankease.com/algoan-hook/',
      eventName: EventName.BANKREADER_CONFIGURATION_REQUIRED,
      status: 'ACTIVE',
    },
    payload: {
      banksUserId: '2a0bf32e3180329b3167e777',
      temporaryCode: 'mockTempCode',
      applicationId: 'mockApplicationId',
    },
    time: 1586177798388,
    index: 32,
    id: 'eventId',
  };

  const subscriptions: Subscription[] = [
    new Subscription(
      { id: 'mockEventSubId', eventName: EventName.BANKREADER_COMPLETED, status: 'ACTIVE', target: 'mockSubTarget' },
      new RequestBuilder('mockBaseURL', { clientId: 'mockClientId' }),
    ),
  ];

  const mockServiceAccount: ServiceAccount = new ServiceAccount('mockBaseURL', {
    id: 'mockServiceAccountId',
    clientId: 'mockClientId',
    clientSecret: 'mockClientSecret',
    createdAt: 'mockCreatedAt',
  });
  mockServiceAccount.subscriptions = subscriptions;
  const mockServiceAccountWithConfig: ServiceAccount = new ServiceAccount('mockBaseURL', {
    id: 'mockServiceAccountId',
    clientId: 'mockClientId',
    clientSecret: 'mockClientSecret',
    createdAt: 'mockCreatedAt',
    config: {
      clientId: 'mockClientIdFromConfig',
    },
  });
  mockServiceAccountWithConfig.subscriptions = subscriptions;

  beforeEach(async () => {
    // To mock scoped DI
    const contextId = ContextIdFactory.create();
    jest.spyOn(ContextIdFactory, 'getByRequest').mockImplementation(() => contextId);

    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule, AggregatorModule, AlgoanModule, ConfigModule],
      providers: [HooksService],
    }).compile();

    jest.spyOn(Algoan.prototype, 'initRestHooks').mockResolvedValue();

    hooksService = await module.resolve<HooksService>(HooksService, contextId);
    aggregatorService = await module.resolve<AggregatorService>(AggregatorService, contextId);
    algoanService = await module.resolve<AlgoanService>(AlgoanService, contextId);
    algoanHttpService = await module.resolve<AlgoanHttpService>(AlgoanHttpService, contextId);
    algoanCustomerService = await module.resolve<AlgoanCustomerService>(AlgoanCustomerService, contextId);
    algoanAnalysisService = await module.resolve<AlgoanAnalysisService>(AlgoanAnalysisService, contextId);
    await algoanService.onModuleInit();
  });

  afterEach(() => {
    /** Reset all spies and mocks */
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(hooksService).toBeDefined();
  });

  it('should get the service account', async () => {
    const spy = jest
      .spyOn(algoanService.algoanClient, 'getServiceAccountBySubscriptionId')
      .mockReturnValue(mockServiceAccount);
    const serviceAccountReturned = await hooksService.getServiceAccount(mockEvent as unknown as EventDTO);

    expect(spy).toBeCalledWith('mockEventSubId');
    expect(serviceAccountReturned).toEqual(mockServiceAccount);
  });

  it('should patch the event status with failed when an unknown event is received', async () => {
    const mockSubscription: Subscription = {
      event: (_id: string) => ({
        update: async ({ status }) => {
          expect(status).toEqual('FAILED');
        },
      }),
    } as unknown as Subscription;

    const event: EventDTO = {
      ...mockEvent,
      subscription: {
        ...mockEvent,
        eventName: 'UNKNOWN',
      },
      payload: { customerId: 'mockCustomerId' },
    } as unknown as EventDTO;

    await hooksService.dispatchAndHandleWebhook(event, mockSubscription, mockServiceAccount, new Date());
  });

  describe('should handle the aggregator_link_required', () => {
    let spyHttpService: jest.SpyInstance;

    const event: EventDTO = {
      ...mockEvent,
      subscription: {
        ...mockEvent,
        eventName: EventName.AGGREGATOR_LINK_REQUIRED,
      },
      payload: { customerId: 'mockCustomerId' },
    } as unknown as EventDTO;

    beforeEach(() => {
      spyHttpService = jest.spyOn(algoanHttpService, 'authenticate');
    });
    it('and do nothing in an unknown mode', async () => {
      const mockSubscription: Subscription = {
        event: (_id: string) => ({
          update: async ({ status }) => {
            expect(status).toEqual('ERROR');
          },
        }),
      } as unknown as Subscription;

      const spyGetCustomer = jest.spyOn(algoanCustomerService, 'getCustomerById').mockReturnValue(
        Promise.resolve({
          id: 'mockCustomerId',
        } as unknown as Customer),
      );

      const spyPatchCustomer = jest
        .spyOn(algoanCustomerService, 'updateCustomer')
        .mockReturnValue(Promise.resolve({} as unknown as Customer));

      try {
        await hooksService.dispatchAndHandleWebhook(event, mockSubscription, mockServiceAccount, new Date());
      } catch (err) {
        expect(err.message).toEqual('Invalid bank connection mode undefined');
      }

      expect(spyHttpService).toBeCalled();
      expect(spyGetCustomer).toBeCalledWith('mockCustomerId');
      expect(spyPatchCustomer).not.toBeCalled();
    });

    it('and throw when no customer is found', async () => {
      const mockSubscription: Subscription = {
        event: (_id: string) => ({
          update: async ({ status }) => {
            expect(status).toEqual('ERROR');
          },
        }),
      } as unknown as Subscription;

      const spyGetCustomer = jest
        .spyOn(algoanCustomerService, 'getCustomerById')
        .mockReturnValue(Promise.resolve(undefined as unknown as Customer));

      const spyPatchCustomer = jest
        .spyOn(algoanCustomerService, 'updateCustomer')
        .mockReturnValue(Promise.resolve({} as unknown as Customer));

      try {
        await hooksService.dispatchAndHandleWebhook(event, mockSubscription, mockServiceAccount, new Date());
      } catch (err) {
        expect(err.message).toBe('Could not retrieve customer for id "mockCustomerId"');
      }

      expect(spyHttpService).toBeCalled();
      expect(spyGetCustomer).toBeCalledWith('mockCustomerId');
      expect(spyPatchCustomer).not.toBeCalled();
    });

    it('and patch the redirect url in redirect mode', async () => {
      const mockSubscription: Subscription = {
        event: (_id: string) => ({
          update: async ({ status }) => {
            expect(status).toEqual('PROCESSED');
          },
        }),
      } as unknown as Subscription;

      const spyGetCustomer = jest.spyOn(algoanCustomerService, 'getCustomerById').mockReturnValue(
        Promise.resolve({
          id: 'mockCustomerId',
          aggregationDetails: { mode: AggregationDetailsMode.REDIRECT, callbackUrl: 'http://fake.url' },
        } as unknown as Customer),
      );

      const spyPatchCustomer = jest
        .spyOn(algoanCustomerService, 'updateCustomer')
        .mockReturnValue(Promise.resolve({} as unknown as Customer));

      await hooksService.dispatchAndHandleWebhook(event, mockSubscription, mockServiceAccount, new Date());

      expect(spyHttpService).toBeCalled();
      expect(spyGetCustomer).toBeCalledWith('mockCustomerId');
      expect(spyPatchCustomer).toBeCalledWith('mockCustomerId', {
        aggregationDetails: {
          aggregatorName: 'BUDGET_INSIGHT',
          apiUrl: 'https://fake-budget-insights.com/2.0',
          clientId: 'budgetInsightClientId',
          redirectUrl:
            'https://fake-budget-insights.com/2.0/auth/webview/fr/connect?client_id=budgetInsightClientId&redirect_uri=http://fake.url&response_type=code&state=&types=banks',
        },
      });
    });

    it('and not patch the redirect url in redirect mode when no callback url is provided', async () => {
      const mockSubscription: Subscription = {
        event: (_id: string) => ({
          update: async ({ status }) => {
            expect(status).toEqual('ERROR');
          },
        }),
      } as unknown as Subscription;

      const spyGetCustomer = jest.spyOn(algoanCustomerService, 'getCustomerById').mockReturnValue(
        Promise.resolve({
          id: 'mockCustomerId',
          aggregationDetails: { mode: AggregationDetailsMode.REDIRECT },
        } as unknown as Customer),
      );

      const spyPatchCustomer = jest
        .spyOn(algoanCustomerService, 'updateCustomer')
        .mockReturnValue(Promise.resolve({} as unknown as Customer));

      try {
        await hooksService.dispatchAndHandleWebhook(event, mockSubscription, mockServiceAccount, new Date());
      } catch (err) {
        expect(err.message).toBe('Customer mockCustomerId has no callback URL');
      }

      expect(spyHttpService).toBeCalled();
      expect(spyGetCustomer).toBeCalledWith('mockCustomerId');
      expect(spyPatchCustomer).not.toBeCalled();
    });

    it('and patch the customer in api mode', async () => {
      const mockSubscription: Subscription = {
        event: (_id: string) => ({
          update: async ({ status }) => {
            expect(status).toEqual('PROCESSED');
          },
        }),
      } as unknown as Subscription;

      const spyGetCustomer = jest.spyOn(algoanCustomerService, 'getCustomerById').mockReturnValue(
        Promise.resolve({
          id: 'mockCustomerId',
          aggregationDetails: { mode: AggregationDetailsMode.API },
        } as unknown as Customer),
      );

      const spyGetJWT = jest.spyOn(aggregatorService, 'getJWToken').mockReturnValue(
        Promise.resolve({
          jwt_token: 'fake_jwt_token',
          payload: { domain: 'http://fake.domain.url', id_user: 'userId' },
        }),
      );

      const spyPatchCustomer = jest
        .spyOn(algoanCustomerService, 'updateCustomer')
        .mockReturnValue(Promise.resolve({} as unknown as Customer));

      const fakeServiceAccount: ServiceAccount = {
        ...mockServiceAccount,
        config: {
          baseUrl: 'https://fake-base-url.url',
          clientId: 'fakeClientId',
        },
      } as ServiceAccount;

      await hooksService.dispatchAndHandleWebhook(event, mockSubscription, fakeServiceAccount, new Date());

      expect(spyHttpService).toBeCalled();
      expect(spyGetCustomer).toBeCalledWith('mockCustomerId');
      expect(spyGetJWT).toBeCalledWith({ baseUrl: 'https://fake-base-url.url', clientId: 'fakeClientId' }, undefined);
      expect(spyPatchCustomer).toBeCalledWith('mockCustomerId', {
        aggregationDetails: {
          aggregatorName: 'BUDGET_INSIGHT',
          apiUrl: 'https://fake-base-url.url',
          clientId: 'fakeClientId',
          token: 'fake_jwt_token',
          userId: 'userId',
        },
      });
    });
  });

  describe('should handle the bank_details_required', () => {
    let spyHttpService: jest.SpyInstance;

    const connection: Connection = {
      id: 4,
      id_user: 6,
      id_connector: 5,
      state: null,
      active: true,
      created: null,
      next_try: null,
      last_update: null,
    };

    beforeEach(() => {
      spyHttpService = jest.spyOn(algoanHttpService, 'authenticate');
    });

    it('should throw when no customer found', async () => {
      const mockSubscription: Subscription = {
        event: (_id: string) => ({
          update: async ({ status }) => {
            expect(status).toEqual('ERROR');
          },
        }),
      } as unknown as Subscription;

      const spyGetCustomer = jest
        .spyOn(algoanCustomerService, 'getCustomerById')
        .mockReturnValue(Promise.resolve(undefined as unknown as Customer));

      const analysisSpy = jest
        .spyOn(algoanAnalysisService, 'updateAnalysis')
        .mockReturnValue(Promise.resolve({} as unknown as Analysis));

      const event: EventDTO = {
        ...mockEvent,
        subscription: {
          ...mockEvent,
          eventName: EventName.BANK_DETAILS_REQUIRED,
        },
        payload: { customerId: 'mockCustomerId', analysisId: 'mockAnalysisId' },
      } as unknown as EventDTO;

      const fakeServiceAccount: ServiceAccount = {
        ...mockServiceAccount,
        config: {
          baseUrl: 'https://fake-base-url.url',
          clientId: 'fakeClientId',
        },
      } as ServiceAccount;

      try {
        await hooksService.dispatchAndHandleWebhook(event, mockSubscription, fakeServiceAccount, new Date());
      } catch (err) {
        expect(err.message).toEqual('Could not retrieve customer for id "mockCustomerId"');
      }

      expect(spyHttpService).toBeCalled();
      expect(spyGetCustomer).toBeCalledWith('mockCustomerId');
      expect(analysisSpy).toBeCalledWith('mockCustomerId', 'mockAnalysisId', {
        status: AnalysisStatus.ERROR,
        error: {
          code: ErrorCodes.INTERNAL_ERROR,
          message: `An error occured when fetching data from the aggregator`,
        },
      });
    });

    it('without temporaryCode nor token, nor userId in the customer details', async () => {
      const mockSubscription: Subscription = {
        event: (_id: string) => ({
          update: async ({ status }) => {
            expect(status).toEqual('PROCESSED');
          },
        }),
      } as unknown as Subscription;

      const spyGetCustomer = jest.spyOn(algoanCustomerService, 'getCustomerById').mockReturnValue(
        Promise.resolve({
          id: 'mockCustomerId',
        } as unknown as Customer),
      );

      const event: EventDTO = {
        ...mockEvent,
        subscription: {
          ...mockEvent,
          eventName: EventName.BANK_DETAILS_REQUIRED,
        },
        payload: { customerId: 'mockCustomerId', analysisId: 'mockAnalysisId' },
      } as unknown as EventDTO;

      const fakeServiceAccount: ServiceAccount = {
        ...mockServiceAccount,
        config: {
          baseUrl: 'https://fake-base-url.url',
          clientId: 'fakeClientId',
        },
      } as ServiceAccount;

      await hooksService.dispatchAndHandleWebhook(event, mockSubscription, fakeServiceAccount, new Date());

      expect(spyHttpService).toBeCalled();
      expect(spyGetCustomer).toBeCalledWith('mockCustomerId');
    });

    it('with token in the customer and have a timeout', async () => {
      const mockSubscription: Subscription = {
        event: (_id: string) => ({
          update: async ({ status }) => {
            expect(status).toEqual('PROCESSED');
          },
        }),
      } as unknown as Subscription;

      const spyGetCustomer = jest.spyOn(algoanCustomerService, 'getCustomerById').mockReturnValue(
        Promise.resolve({
          id: 'mockCustomerId',
          aggregationDetails: { mode: AggregationDetailsMode.API, token: 'fakeToken' },
        } as unknown as Customer),
      );

      const connectionSpy = jest
        .spyOn(aggregatorService, 'getConnections')
        .mockReturnValueOnce(Promise.resolve([connection]))
        .mockReturnValue(Promise.resolve([{ ...connection, last_update: 'mockLastUpdate' }]));
      const accountSpy = jest.spyOn(aggregatorService, 'getAccounts').mockResolvedValue([mockAccount]);
      const userInfoSpy = jest.spyOn(aggregatorService, 'getInfo').mockResolvedValue({ owner: { name: 'JOHN DOE' } });
      const transactionSpy = jest.spyOn(aggregatorService, 'getTransactions').mockResolvedValue([mockTransaction]);
      const categorySpy = jest.spyOn(aggregatorService, 'getCategory').mockResolvedValue(mockCategory);
      const analysisSpy = jest
        .spyOn(algoanAnalysisService, 'updateAnalysis')
        .mockReturnValue(Promise.resolve({} as unknown as Analysis));

      const event: EventDTO = {
        ...mockEvent,
        subscription: {
          ...mockEvent,
          eventName: EventName.BANK_DETAILS_REQUIRED,
        },
        payload: { customerId: 'mockCustomerId', analysisId: 'mockAnalysisId', temporaryCode: 'mockTempCode' },
      } as unknown as EventDTO;

      const fakeServiceAccount: ServiceAccount = {
        ...mockServiceAccount,
        config: {
          baseUrl: 'https://fake-base-url.url',
          clientId: 'fakeClientId',
        },
      } as ServiceAccount;

      await hooksService.dispatchAndHandleWebhook(event, mockSubscription, fakeServiceAccount, new Date());

      const saConfig = {
        baseUrl: 'https://fake-base-url.url',
        clientId: 'fakeClientId',
      };

      expect(spyHttpService).toBeCalled();
      expect(spyGetCustomer).toBeCalledWith('mockCustomerId');
      expect(connectionSpy).toBeCalledWith('fakeToken', saConfig);
      expect(accountSpy).toBeCalledWith('fakeToken', saConfig);
      expect(userInfoSpy).toBeCalledWith('fakeToken', '4', saConfig);
      expect(userInfoSpy).toBeCalledTimes(1);
      expect(transactionSpy).toBeCalledWith('fakeToken', 1, saConfig);
      expect(categorySpy).toBeCalledWith('fakeToken', mockTransaction.id_category, saConfig);
      expect(analysisSpy).toBeCalledWith('mockCustomerId', 'mockAnalysisId', {
        accounts: [
          {
            aggregator: { id: '1' },
            balance: 100,
            balanceDate: '2011-10-05T14:48:00.000Z',
            bank: { id: undefined, name: undefined },
            bic: 'mockBic',
            coming: 0,
            currency: 'id1',
            details: { loan: undefined, savings: undefined },
            iban: 'mockIban',
            name: 'mockName',
            number: 'mockNumber',
            owners: undefined,
            transactions: [
              {
                aggregator: { category: 'mockCategoryName', id: 'mockId', type: 'BANK_FEE' },
                amount: 50,
                currency: 'USD',
                dates: { bookedAt: null, debitedAt: null },
                description: 'mockOriginalWording',
                isComing: false,
              },
            ],
            type: 'CHECKING',
            usage: 'PERSONAL',
          },
        ],
      });
    });

    it('without token in the customer but a userId in the customer - duplicated fetched accounts', async () => {
      const mockSubscription: Subscription = {
        event: (_id: string) => ({
          update: async ({ status }) => {
            expect(status).toEqual('PROCESSED');
          },
        }),
      } as unknown as Subscription;

      const spyGetCustomer = jest.spyOn(algoanCustomerService, 'getCustomerById').mockReturnValue(
        Promise.resolve({
          id: 'mockCustomerId',
          aggregationDetails: { mode: AggregationDetailsMode.API, userId: 'mockUserId' },
        } as unknown as Customer),
      );

      const jwtTokenSpy = jest
        .spyOn(aggregatorService, 'getJWToken')
        .mockResolvedValue({ jwt_token: 'mockPermToken', payload: { domain: 'mockDomain', id_user: 'userId' } });

      const connectionSpy = jest
        .spyOn(aggregatorService, 'getConnections')
        .mockReturnValueOnce(Promise.resolve([connection]))
        .mockReturnValueOnce(Promise.resolve([{ ...connection, last_update: 'mockLastUpdate' }]));
      const accountSpy = jest.spyOn(aggregatorService, 'getAccounts').mockResolvedValue([mockAccount, mockAccount]);
      const userInfoSpy = jest.spyOn(aggregatorService, 'getInfo').mockResolvedValue({ owner: { name: 'JOHN DOE' } });
      const transactionSpy = jest.spyOn(aggregatorService, 'getTransactions').mockResolvedValue([mockTransaction]);
      const categorySpy = jest.spyOn(aggregatorService, 'getCategory').mockResolvedValue(mockCategory);
      const analysisSpy = jest
        .spyOn(algoanAnalysisService, 'updateAnalysis')
        .mockReturnValue(Promise.resolve({} as unknown as Analysis));

      const event: EventDTO = {
        ...mockEvent,
        subscription: {
          ...mockEvent,
          eventName: EventName.BANK_DETAILS_REQUIRED,
        },
        payload: { customerId: 'mockCustomerId', analysisId: 'mockAnalysisId' },
      } as unknown as EventDTO;

      const fakeServiceAccount: ServiceAccount = {
        ...mockServiceAccount,
        config: {
          baseUrl: 'https://fake-base-url.url',
          clientId: 'fakeClientId',
        },
      } as ServiceAccount;

      await hooksService.dispatchAndHandleWebhook(event, mockSubscription, fakeServiceAccount, new Date());

      const saConfig = {
        baseUrl: 'https://fake-base-url.url',
        clientId: 'fakeClientId',
      };

      expect(spyHttpService).toBeCalled();
      expect(spyGetCustomer).toBeCalledWith('mockCustomerId');
      expect(jwtTokenSpy).toBeCalledWith(saConfig, 'mockUserId');
      expect(connectionSpy).toBeCalledWith('mockPermToken', saConfig);
      expect(connectionSpy).toBeCalledTimes(2);
      expect(accountSpy).toBeCalledWith('mockPermToken', saConfig);
      expect(userInfoSpy).toBeCalledWith('mockPermToken', '4', saConfig);
      expect(userInfoSpy).toBeCalledTimes(1);
      expect(transactionSpy).toBeCalledWith('mockPermToken', 1, saConfig);
      expect(categorySpy).toBeCalledWith('mockPermToken', mockTransaction.id_category, saConfig);
      expect(analysisSpy).toBeCalledWith('mockCustomerId', 'mockAnalysisId', {
        accounts: [
          {
            aggregator: { id: '1' },
            balance: 100,
            balanceDate: '2011-10-05T14:48:00.000Z',
            bank: { id: undefined, name: undefined },
            bic: 'mockBic',
            coming: 0,
            currency: 'id1',
            details: { loan: undefined, savings: undefined },
            iban: 'mockIban',
            name: 'mockName',
            number: 'mockNumber',
            owners: undefined,
            transactions: [
              {
                aggregator: { category: 'mockCategoryName', id: 'mockId', type: 'BANK_FEE' },
                amount: 50,
                currency: 'USD',
                dates: { bookedAt: null, debitedAt: null },
                description: 'mockOriginalWording',
                isComing: false,
              },
            ],
            type: 'CHECKING',
            usage: 'PERSONAL',
          },
        ],
      });
    });

    it('without token in the customer but a userId in the customer - there is an account with number null', async () => {
      const mockSubscription: Subscription = {
        event: (_id: string) => ({
          update: async ({ status }) => {
            expect(status).toEqual('PROCESSED');
          },
        }),
      } as unknown as Subscription;

      const spyGetCustomer = jest.spyOn(algoanCustomerService, 'getCustomerById').mockReturnValue(
        Promise.resolve({
          id: 'mockCustomerId',
          aggregationDetails: { mode: AggregationDetailsMode.API, userId: 'mockUserId' },
        } as unknown as Customer),
      );

      const jwtTokenSpy = jest
        .spyOn(aggregatorService, 'getJWToken')
        .mockResolvedValue({ jwt_token: 'mockPermToken', payload: { domain: 'mockDomain', id_user: 'userId' } });

      const connectionSpy = jest
        .spyOn(aggregatorService, 'getConnections')
        .mockReturnValueOnce(Promise.resolve([connection]))
        .mockReturnValueOnce(Promise.resolve([{ ...connection, last_update: 'mockLastUpdate' }]));
      const accountSpy = jest
        .spyOn(aggregatorService, 'getAccounts')
        .mockResolvedValue([mockAccount, { ...mockAccount, number: null }]);
      const userInfoSpy = jest.spyOn(aggregatorService, 'getInfo').mockResolvedValue({ owner: { name: 'JOHN DOE' } });
      const transactionSpy = jest.spyOn(aggregatorService, 'getTransactions').mockResolvedValue([mockTransaction]);
      const categorySpy = jest.spyOn(aggregatorService, 'getCategory').mockResolvedValue(mockCategory);
      const analysisSpy = jest
        .spyOn(algoanAnalysisService, 'updateAnalysis')
        .mockReturnValue(Promise.resolve({} as unknown as Analysis));

      const event: EventDTO = {
        ...mockEvent,
        subscription: {
          ...mockEvent,
          eventName: EventName.BANK_DETAILS_REQUIRED,
        },
        payload: { customerId: 'mockCustomerId', analysisId: 'mockAnalysisId' },
      } as unknown as EventDTO;

      const fakeServiceAccount: ServiceAccount = {
        ...mockServiceAccount,
        config: {
          baseUrl: 'https://fake-base-url.url',
          clientId: 'fakeClientId',
        },
      } as ServiceAccount;

      await hooksService.dispatchAndHandleWebhook(event, mockSubscription, fakeServiceAccount, new Date());

      const saConfig = {
        baseUrl: 'https://fake-base-url.url',
        clientId: 'fakeClientId',
      };

      expect(spyHttpService).toBeCalled();
      expect(spyGetCustomer).toBeCalledWith('mockCustomerId');
      expect(jwtTokenSpy).toBeCalledWith(saConfig, 'mockUserId');
      expect(connectionSpy).toBeCalledWith('mockPermToken', saConfig);
      expect(connectionSpy).toBeCalledTimes(2);
      expect(accountSpy).toBeCalledWith('mockPermToken', saConfig);
      expect(userInfoSpy).toBeCalledWith('mockPermToken', '4', saConfig);
      expect(userInfoSpy).toBeCalledTimes(1);
      expect(transactionSpy).toBeCalledWith('mockPermToken', 1, saConfig);
      expect(categorySpy).toBeCalledWith('mockPermToken', mockTransaction.id_category, saConfig);
      expect(analysisSpy).toBeCalledWith('mockCustomerId', 'mockAnalysisId', {
        accounts: [
          {
            aggregator: { id: '1' },
            balance: 100,
            balanceDate: '2011-10-05T14:48:00.000Z',
            bank: { id: undefined, name: undefined },
            bic: 'mockBic',
            coming: 0,
            currency: 'id1',
            details: { loan: undefined, savings: undefined },
            iban: 'mockIban',
            name: 'mockName',
            number: 'mockNumber',
            owners: undefined,
            transactions: [
              {
                aggregator: { category: 'mockCategoryName', id: 'mockId', type: 'BANK_FEE' },
                amount: 50,
                currency: 'USD',
                dates: { bookedAt: null, debitedAt: null },
                description: 'mockOriginalWording',
                isComing: false,
              },
            ],
            type: 'CHECKING',
            usage: 'PERSONAL',
          },
          {
            aggregator: { id: '1' },
            balance: 100,
            balanceDate: '2011-10-05T14:48:00.000Z',
            bank: { id: undefined, name: undefined },
            bic: 'mockBic',
            coming: 0,
            currency: 'id1',
            details: { loan: undefined, savings: undefined },
            iban: 'mockIban',
            name: 'mockName',
            number: undefined,
            owners: undefined,
            transactions: [
              {
                aggregator: { category: 'mockCategoryName', id: 'mockId', type: 'BANK_FEE' },
                amount: 50,
                currency: 'USD',
                dates: { bookedAt: null, debitedAt: null },
                description: 'mockOriginalWording',
                isComing: false,
              },
            ],
            type: 'CHECKING',
            usage: 'PERSONAL',
          },
        ],
      });
    });

    it('without token in the customer but a temporaryCode', async () => {
      const mockSubscription: Subscription = {
        event: (_id: string) => ({
          update: async ({ status }) => {
            expect(status).toEqual('PROCESSED');
          },
        }),
      } as unknown as Subscription;

      const spyGetCustomer = jest.spyOn(algoanCustomerService, 'getCustomerById').mockReturnValue(
        Promise.resolve({
          id: 'mockCustomerId',
          aggregationDetails: { mode: AggregationDetailsMode.REDIRECT },
        } as unknown as Customer),
      );
      const updateCustomerSpy = jest.spyOn(algoanCustomerService, 'updateCustomer').mockResolvedValue({} as Customer);

      const registerSpy = jest.spyOn(aggregatorService, 'registerClient').mockResolvedValue('mockPermToken');
      const userIdSpy = jest.spyOn(aggregatorService, 'getUserId').mockResolvedValue(12);

      const connectionSpy = jest
        .spyOn(aggregatorService, 'getConnections')
        .mockReturnValueOnce(Promise.resolve([connection]))
        .mockReturnValueOnce(Promise.resolve([{ ...connection, last_update: 'mockLastUpdate' }]));
      const accountSpy = jest.spyOn(aggregatorService, 'getAccounts').mockResolvedValue([mockAccount]);
      const userInfoSpy = jest.spyOn(aggregatorService, 'getInfo').mockResolvedValue({ owner: { name: 'JOHN DOE' } });
      const transactionSpy = jest.spyOn(aggregatorService, 'getTransactions').mockResolvedValue([mockTransaction]);
      const categorySpy = jest.spyOn(aggregatorService, 'getCategory').mockResolvedValue(mockCategory);
      const analysisSpy = jest
        .spyOn(algoanAnalysisService, 'updateAnalysis')
        .mockReturnValue(Promise.resolve({} as unknown as Analysis));

      const event: EventDTO = {
        ...mockEvent,
        subscription: {
          ...mockEvent,
          eventName: EventName.BANK_DETAILS_REQUIRED,
        },
        payload: { customerId: 'mockCustomerId', analysisId: 'mockAnalysisId', temporaryCode: 'mockTempCode' },
      } as unknown as EventDTO;

      const fakeServiceAccount: ServiceAccount = {
        ...mockServiceAccount,
        config: {
          baseUrl: 'https://fake-base-url.url',
          clientId: 'fakeClientId',
        },
      } as ServiceAccount;

      await hooksService.dispatchAndHandleWebhook(event, mockSubscription, fakeServiceAccount, new Date());

      const saConfig = {
        baseUrl: 'https://fake-base-url.url',
        clientId: 'fakeClientId',
      };

      expect(spyHttpService).toBeCalled();
      expect(spyGetCustomer).toBeCalledWith('mockCustomerId');
      expect(updateCustomerSpy).toBeCalledWith('mockCustomerId', { aggregationDetails: { userId: '12' } });
      expect(registerSpy).toBeCalledWith(mockEvent.payload.temporaryCode, saConfig);
      expect(userIdSpy).toBeCalledWith('mockPermToken', saConfig);
      expect(connectionSpy).toBeCalledWith('mockPermToken', saConfig);
      expect(connectionSpy).toBeCalledTimes(2);
      expect(accountSpy).toBeCalledWith('mockPermToken', saConfig);
      expect(userInfoSpy).toBeCalledWith('mockPermToken', '4', saConfig);
      expect(userInfoSpy).toBeCalledTimes(1);
      expect(transactionSpy).toBeCalledWith('mockPermToken', 1, saConfig);
      expect(categorySpy).toBeCalledWith('mockPermToken', mockTransaction.id_category, saConfig);
      expect(analysisSpy).toBeCalledWith('mockCustomerId', 'mockAnalysisId', {
        accounts: [
          {
            aggregator: { id: '1' },
            balance: 100,
            balanceDate: '2011-10-05T14:48:00.000Z',
            bank: { id: undefined, name: undefined },
            bic: 'mockBic',
            coming: 0,
            currency: 'id1',
            details: { loan: undefined, savings: undefined },
            iban: 'mockIban',
            name: 'mockName',
            number: 'mockNumber',
            owners: undefined,
            transactions: [
              {
                aggregator: { category: 'mockCategoryName', id: 'mockId', type: 'BANK_FEE' },
                amount: 50,
                currency: 'USD',
                dates: { bookedAt: null, debitedAt: null },
                description: 'mockOriginalWording',
                isComing: false,
              },
            ],
            type: 'CHECKING',
            usage: 'PERSONAL',
          },
        ],
      });
    });
  });
});
