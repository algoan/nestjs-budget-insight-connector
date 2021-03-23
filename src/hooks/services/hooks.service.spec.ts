/* eslint-disable max-lines */
import { Test, TestingModule } from '@nestjs/testing';
import { ContextIdFactory } from '@nestjs/core';
import { Algoan, ServiceAccount, EventName, Subscription, RequestBuilder } from '@algoan/rest';

import { EventDTO } from '../dto';
import { AggregationDetailsMode } from '../../algoan/dto/customer.enums';
import { Customer } from '../../algoan/dto/customer.objects';
import { AggregatorModule } from '../../aggregator/aggregator.module';
import { AggregatorService } from '../../aggregator/services/aggregator.service';
import { AlgoanModule } from '../../algoan/algoan.module';
import { AppModule } from '../../app.module';
import { AlgoanService } from '../../algoan/services/algoan.service';
import { AlgoanCustomerService } from '../../algoan/services/algoan-customer.service';
import { AlgoanHttpService } from '../../algoan/services/algoan-http.service';
import { ConfigModule } from '../../config/config.module';
import { HooksService } from './hooks.service';

describe('HooksService', () => {
  let hooksService: HooksService;
  let aggregatorService: AggregatorService;
  let algoanService: AlgoanService;
  let algoanHttpService: AlgoanHttpService;
  let algoanCustomerService: AlgoanCustomerService;
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
    const serviceAccountReturned = await hooksService.getServiceAccount((mockEvent as unknown) as EventDTO);

    expect(spy).toBeCalledWith('mockEventSubId');
    expect(serviceAccountReturned).toEqual(mockServiceAccount);
  });

  it('should patch the event status with failed when an unknown event is received', async () => {
    const mockSubscription: Subscription = ({
      event: (_id: string) => ({
        update: async ({ status }) => {
          expect(status).toEqual('FAILED');
        },
      }),
    } as unknown) as Subscription;

    const event: EventDTO = ({
      ...mockEvent,
      subscription: {
        ...mockEvent,
        eventName: 'UNKNOWN',
      },
      payload: { customerId: 'mockCustomerId' },
    } as unknown) as EventDTO;

    await hooksService.dispatchAndHandleWebhook(event, mockSubscription, mockServiceAccount);
  });

  it('should handle the aggregator_link_required and do nothing in an unknown mode', async () => {
    const mockSubscription: Subscription = ({
      event: (_id: string) => ({
        update: async ({ status }) => {
          expect(status).toEqual('ERROR');
        },
      }),
    } as unknown) as Subscription;

    const spyHttpService = jest.spyOn(algoanHttpService, 'authenticate');

    const spyGetCustomer = jest.spyOn(algoanCustomerService, 'getCustomerById').mockReturnValue(
      Promise.resolve(({
        id: 'mockCustomerId',
        aggregationDetails: { mode: 'INVALID', callbackUrl: 'http://fake.url' },
      } as unknown) as Customer),
    );

    const spyPatchCustomer = jest
      .spyOn(algoanCustomerService, 'updateCustomer')
      .mockReturnValue(Promise.resolve(({} as unknown) as Customer));

    const event: EventDTO = ({
      ...mockEvent,
      subscription: {
        ...mockEvent,
        eventName: EventName.AGGREGATOR_LINK_REQUIRED,
      },
      payload: { customerId: 'mockCustomerId' },
    } as unknown) as EventDTO;

    try {
      await hooksService.dispatchAndHandleWebhook(event, mockSubscription, mockServiceAccount);
    } catch (err) {
      expect(err.message).toEqual('Invalid bank connection mode INVALID');
    }

    expect(spyHttpService).toBeCalled();
    expect(spyGetCustomer).toBeCalledWith('mockCustomerId');
    expect(spyPatchCustomer).not.toBeCalled();
  });

  it('should handle the aggregator_link_required and patch the redirect url in redirect mode', async () => {
    const mockSubscription: Subscription = ({
      event: (_id: string) => ({
        update: async ({ status }) => {
          expect(status).toEqual('PROCESSED');
        },
      }),
    } as unknown) as Subscription;

    const spyHttpService = jest.spyOn(algoanHttpService, 'authenticate');

    const spyGetCustomer = jest.spyOn(algoanCustomerService, 'getCustomerById').mockReturnValue(
      Promise.resolve(({
        id: 'mockCustomerId',
        aggregationDetails: { mode: AggregationDetailsMode.REDIRECT, callbackUrl: 'http://fake.url' },
      } as unknown) as Customer),
    );

    const spyPatchCustomer = jest
      .spyOn(algoanCustomerService, 'updateCustomer')
      .mockReturnValue(Promise.resolve(({} as unknown) as Customer));

    const event: EventDTO = ({
      ...mockEvent,
      subscription: {
        ...mockEvent,
        eventName: EventName.AGGREGATOR_LINK_REQUIRED,
      },
      payload: { customerId: 'mockCustomerId' },
    } as unknown) as EventDTO;
    await hooksService.dispatchAndHandleWebhook(event, mockSubscription, mockServiceAccount);

    expect(spyHttpService).toBeCalled();
    expect(spyGetCustomer).toBeCalledWith('mockCustomerId');
    expect(spyPatchCustomer).toBeCalledWith('mockCustomerId', {
      aggregationDetails: {
        aggregatorName: 'BUDGET_INSIGHT',
        apiUrl: 'http://localhost:4000/',
        clientId: 'budgetInsightClientId',
        redirectUrl:
          'http://localhost:4000/auth/webview/fr/connect?client_id=budgetInsightClientId&redirect_uri=http://fake.url&response_type=code&state=&types=banks',
      },
    });
  });

  it('should handle the aggregator_link_required and not patch the redirect url in redirect mode when no callback url is provided', async () => {
    const mockSubscription: Subscription = ({
      event: (_id: string) => ({
        update: async ({ status }) => {
          expect(status).toEqual('ERROR');
        },
      }),
    } as unknown) as Subscription;

    const spyHttpService = jest.spyOn(algoanHttpService, 'authenticate');

    const spyGetCustomer = jest.spyOn(algoanCustomerService, 'getCustomerById').mockReturnValue(
      Promise.resolve(({
        id: 'mockCustomerId',
        aggregationDetails: { mode: AggregationDetailsMode.REDIRECT },
      } as unknown) as Customer),
    );

    const spyPatchCustomer = jest
      .spyOn(algoanCustomerService, 'updateCustomer')
      .mockReturnValue(Promise.resolve(({} as unknown) as Customer));

    const event: EventDTO = ({
      ...mockEvent,
      subscription: {
        ...mockEvent,
        eventName: EventName.AGGREGATOR_LINK_REQUIRED,
      },
      payload: { customerId: 'mockCustomerId' },
    } as unknown) as EventDTO;

    try {
      await hooksService.dispatchAndHandleWebhook(event, mockSubscription, mockServiceAccount);
    } catch (err) {
      expect(err.message).toBe('Customer mockCustomerId has no callback URL');
    }

    expect(spyHttpService).toBeCalled();
    expect(spyGetCustomer).toBeCalledWith('mockCustomerId');
    expect(spyPatchCustomer).not.toBeCalled();
  });

  it('should handle the aggregator_link_required and patch the customer in api mode', async () => {
    const mockSubscription: Subscription = ({
      event: (_id: string) => ({
        update: async ({ status }) => {
          expect(status).toEqual('PROCESSED');
        },
      }),
    } as unknown) as Subscription;

    const spyHttpService = jest.spyOn(algoanHttpService, 'authenticate');

    const spyGetCustomer = jest.spyOn(algoanCustomerService, 'getCustomerById').mockReturnValue(
      Promise.resolve(({
        id: 'mockCustomerId',
        aggregationDetails: { mode: AggregationDetailsMode.API },
      } as unknown) as Customer),
    );

    const spyGetJWT = jest
      .spyOn(aggregatorService, 'getJWToken')
      .mockReturnValue(Promise.resolve({ jwt_token: 'fake_jwt_token', payload: { domain: 'http://fake.domain.url' } }));

    const spyPatchCustomer = jest
      .spyOn(algoanCustomerService, 'updateCustomer')
      .mockReturnValue(Promise.resolve(({} as unknown) as Customer));

    const event: EventDTO = ({
      ...mockEvent,
      subscription: {
        ...mockEvent,
        eventName: EventName.AGGREGATOR_LINK_REQUIRED,
      },
      payload: { customerId: 'mockCustomerId' },
    } as unknown) as EventDTO;

    const fakeServiceAccount: ServiceAccount = {
      ...mockServiceAccount,
      config: {
        baseUrl: 'https://fake-base-url.url',
        clientId: 'fakeClientId',
      },
    } as ServiceAccount;

    await hooksService.dispatchAndHandleWebhook(event, mockSubscription, fakeServiceAccount);

    expect(spyHttpService).toBeCalled();
    expect(spyGetCustomer).toBeCalledWith('mockCustomerId');
    expect(spyGetJWT).toBeCalledWith({ baseUrl: 'https://fake-base-url.url', clientId: 'fakeClientId' });
    expect(spyPatchCustomer).toBeCalledWith('mockCustomerId', {
      aggregationDetails: {
        aggregatorName: 'BUDGET_INSIGHT',
        apiUrl: 'https://fake-base-url.url',
        clientId: 'fakeClientId',
        token: 'fake_jwt_token',
      },
    });
  });
});
