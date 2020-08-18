/* eslint-disable max-lines */
import { Test, TestingModule } from '@nestjs/testing';
import {
  Algoan,
  ServiceAccount,
  EventName,
  Subscription,
  RequestBuilder,
  BanksUser,
  BanksUserStatus,
  BanksUserAccount,
  AccountType,
  UsageType,
  MultiResourceCreationResponse,
  BanksUserTransaction,
  BanksUserTransactionType,
} from '@algoan/rest';
import { Connection } from '../../aggregator/interfaces/budget-insight.interface';
import { EventDTO } from '../dto/event.dto';
import { AggregatorModule } from '../../aggregator/aggregator.module';
import { AggregatorService } from '../../aggregator/services/aggregator.service';
import { AlgoanModule } from '../../algoan/algoan.module';
import { AppModule } from '../../app.module';
import { AlgoanService } from '../../algoan/algoan.service';
import { BankreaderLinkRequiredDTO } from '../dto/bandreader-link-required.dto';
import { mockAccount, mockTransaction, mockCategory } from '../../aggregator/interfaces/budget-insight-mock';
import {
  mapBudgetInsightAccount,
  mapBudgetInsightTransactions,
} from '../../aggregator/services/budget-insight/budget-insight.utils';
import { HooksService } from './hooks.service';

describe('HooksService', () => {
  let hooksService: HooksService;
  let aggregatorService: AggregatorService;
  let algoanService: AlgoanService;
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

  const mockServiceAccount: ServiceAccount = new ServiceAccount('mockBaseURL', {
    id: 'mockServiceAccountId',
    clientId: 'mockClientId',
    clientSecret: 'mockClientSecret',
    createdAt: 'mockCreatedAt',
  });
  mockServiceAccount.subscriptions = [
    new Subscription(
      { id: 'mockEventSubId', eventName: EventName.BANKREADER_COMPLETED, status: 'ACTIVE', target: 'mockSubTarget' },
      new RequestBuilder('mockBaseURL', { clientId: 'mockClientId' }),
    ),
  ];

  const mockBanksUser = new BanksUser(
    {
      id: 'mockBanksUserId',
      status: BanksUserStatus.ACCOUNTS_SYNCHRONIZED,
      redirectUrl: 'mockRedirectUrl',
      redirectUrlCreatedAt: 123456789,
      redirectUrlTTL: 100,
      callbackUrl: 'mockCallbackUrl',
      scores: [],
      analysis: { alerts: [], regularCashFlows: [], reliability: 'HIGH' },
    },
    new RequestBuilder('mockBaseURL', { clientId: 'mockClientId' }),
  );

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule, AggregatorModule, AlgoanModule],
      providers: [HooksService],
    }).compile();

    jest.spyOn(Algoan.prototype, 'initRestHooks').mockResolvedValue();

    hooksService = module.get<HooksService>(HooksService);
    aggregatorService = module.get<AggregatorService>(AggregatorService);
    algoanService = module.get<AlgoanService>(AlgoanService);
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
    const serviceAccountReturned = await hooksService.getServiceAccount(mockEvent as EventDTO);

    expect(spy).toBeCalledWith('mockEventSubId');
    expect(serviceAccountReturned).toEqual(mockServiceAccount);
  });

  describe('handleWebhook calls the correct event handling function', () => {
    beforeEach(() => {
      jest.spyOn(algoanService.algoanClient, 'getServiceAccountBySubscriptionId').mockReturnValue(mockServiceAccount);
    });
    it('handles bankreader link required', async () => {
      mockEvent.subscription.eventName = EventName.BANKREADER_LINK_REQUIRED;
      const spy = jest.spyOn(hooksService, 'handleBankreaderLinkRequiredEvent').mockResolvedValue();
      await hooksService.handleWebhook(mockEvent as EventDTO, 'mockSignature');

      expect(spy).toBeCalledWith(mockServiceAccount, mockEvent.payload);
    });

    it('handles configuration required', async () => {
      mockEvent.subscription.eventName = EventName.BANKREADER_CONFIGURATION_REQUIRED;
      const spy = jest.spyOn(hooksService, 'handleBankreaderConfigurationRequiredEvent').mockResolvedValue();
      await hooksService.handleWebhook(mockEvent as EventDTO, 'mockSignature');

      expect(spy).toBeCalledWith(mockServiceAccount, mockEvent.payload);
    });

    it('handles bankreader required', async () => {
      mockEvent.subscription.eventName = EventName.BANKREADER_REQUIRED;
      const spy = jest.spyOn(hooksService, 'handleBankReaderRequiredEvent').mockResolvedValue();
      await hooksService.handleWebhook(mockEvent as EventDTO, 'mockSignature');

      expect(spy).toBeCalledWith(mockServiceAccount, mockEvent.payload);
    });
  });

  it('generates a redirect url on bankreader link required', async () => {
    const serviceAccountSpy = jest
      .spyOn(mockServiceAccount, 'getBanksUserById')
      .mockReturnValue(Promise.resolve(mockBanksUser));
    const agreggatorSpy = jest.spyOn(aggregatorService, 'generateRedirectUrl').mockReturnValue('mockRedirectUrl');
    const banksUserSpy = jest.spyOn(mockBanksUser, 'update').mockResolvedValue();
    await hooksService.handleBankreaderLinkRequiredEvent(
      mockServiceAccount,
      mockEvent.payload as BankreaderLinkRequiredDTO,
    );

    expect(serviceAccountSpy).toBeCalledWith(mockEvent.payload.banksUserId);
    expect(agreggatorSpy).toBeCalledWith(mockBanksUser, undefined);
    expect(banksUserSpy).toBeCalledWith({ redirectUrl: 'mockRedirectUrl' });
  });

  it('updates the bank user on configuration required', async () => {
    const serviceAccountSpy = jest
      .spyOn(mockServiceAccount, 'getBanksUserById')
      .mockReturnValue(Promise.resolve(mockBanksUser));
    const agreggatorSpy = jest.spyOn(aggregatorService, 'getJWToken').mockReturnValue(
      Promise.resolve({
        jwt_token: 'mockJwtToken',
        payload: {
          domain: 'mockDomain',
        },
      }),
    );
    const banksUserSpy = jest.spyOn(mockBanksUser, 'update').mockResolvedValue();
    await hooksService.handleBankreaderConfigurationRequiredEvent(mockServiceAccount, mockEvent.payload);

    expect(serviceAccountSpy).toBeCalledWith(mockEvent.payload.banksUserId);
    expect(agreggatorSpy).toBeCalled();
    expect(banksUserSpy).toBeCalledWith({
      plugIn: {
        budgetInsightBank: {
          baseUrl: 'http://localhost:4000/',
          token: 'mockJwtToken',
        },
      },
    });
  });

  it('synchronizes the acccounts on bank reader required', async () => {
    const connection: Connection = {
      id: 4,
      id_user: 6,
      id_connector: 5,
      last_update: null,
      state: null,
      active: true,
      created: null,
      next_try: null,
    };
    const banksUserAccount: BanksUserAccount = {
      id: 'accountId1',
      balance: 100,
      balanceDate: '23/06/2020',
      connectionSource: 'mockConnectionSource',
      currency: 'EUR',
      type: AccountType.SAVINGS,
      usage: UsageType.PERSONAL,
      reference: '10',
    };
    const banksUserTransactionResponse: MultiResourceCreationResponse<BanksUserTransaction> = {
      elements: [
        {
          resource: {
            id: 'transactionId1',
            amount: 50,
            category: 'mockCategory',
            date: '23/06/2020',
            description: 'mockDescription',
            type: BanksUserTransactionType.ATM,
          },
          status: 200,
        },
      ],
      metadata: { failure: 0, success: 1, total: 1 },
    };

    const serviceAccountSpy = jest
      .spyOn(mockServiceAccount, 'getBanksUserById')
      .mockReturnValue(Promise.resolve(mockBanksUser));
    const resgisterSpy = jest.spyOn(aggregatorService, 'registerClient').mockResolvedValue('mockPermToken');
    const connectionSpy = jest
      .spyOn(aggregatorService, 'getConnections')
      .mockReturnValueOnce(Promise.resolve([connection]))
      .mockReturnValueOnce(Promise.resolve([{ ...connection, last_update: 'mockLastUpdate' }]));
    const accountSpy = jest.spyOn(aggregatorService, 'getAccounts').mockResolvedValue([mockAccount]);
    const banksUserAccountSpy = jest.spyOn(mockBanksUser, 'createAccounts').mockResolvedValue([banksUserAccount]);
    const transactionSpy = jest.spyOn(aggregatorService, 'getTransactions').mockResolvedValue([mockTransaction]);
    const categorySpy = jest.spyOn(aggregatorService, 'getCategory').mockResolvedValue(mockCategory);
    const banksUserTransactionSpy = jest
      .spyOn(mockBanksUser, 'createTransactions')
      .mockResolvedValue(banksUserTransactionResponse);
    const banksUserUpdateSpy = jest.spyOn(mockBanksUser, 'update').mockResolvedValue();
    const mappedTransaction = await mapBudgetInsightTransactions([mockTransaction], 'mockPermToken', aggregatorService);
    await hooksService.handleBankReaderRequiredEvent(mockServiceAccount, mockEvent.payload);

    expect(serviceAccountSpy).toBeCalledWith(mockEvent.payload.banksUserId);
    expect(resgisterSpy).toBeCalledWith(mockEvent.payload.temporaryCode, undefined);
    expect(connectionSpy).toBeCalledWith('mockPermToken', undefined);
    expect(connectionSpy).toBeCalledTimes(2);
    expect(accountSpy).toBeCalledWith('mockPermToken', undefined);
    expect(banksUserAccountSpy).toBeCalledWith(mapBudgetInsightAccount([mockAccount]));
    expect(transactionSpy).toBeCalledWith('mockPermToken', Number(banksUserAccount.reference), undefined);
    expect(categorySpy).toBeCalledWith('mockPermToken', mockTransaction.id_category);
    expect(banksUserTransactionSpy).toBeCalledWith(banksUserAccount.id, mappedTransaction);
    expect(banksUserUpdateSpy).toBeCalledTimes(3);
    expect(banksUserUpdateSpy).toHaveBeenNthCalledWith(1, {
      status: BanksUserStatus.SYNCHRONIZING,
    });
    expect(banksUserUpdateSpy).toHaveBeenNthCalledWith(2, {
      status: BanksUserStatus.ACCOUNTS_SYNCHRONIZED,
    });
    expect(banksUserUpdateSpy).toHaveBeenNthCalledWith(3, {
      status: BanksUserStatus.FINISHED,
    });
  });
});
