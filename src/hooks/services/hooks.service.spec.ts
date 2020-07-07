/* eslint-disable max-lines */
import { Test, TestingModule } from '@nestjs/testing';
import { ServiceAccount, EventName, Subscription, RequestBuilder } from '@algoan/rest';
import { EventDTO } from '../dto/event.dto';
import { AggregatorModule } from '../../aggregator/aggregator.module';
import { AggregatorService } from '../../aggregator/services/aggregator.service';
import { AlgoanModule } from '../../algoan/algoan.module';
import { AppModule } from '../../app.module';
import { AlgoanService } from '../../algoan/algoan.service';
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule, AggregatorModule, AlgoanModule],
      providers: [HooksService],
    }).compile();

    hooksService = module.get<HooksService>(HooksService);
    aggregatorService = module.get<AggregatorService>(AggregatorService);
    algoanService = module.get<AlgoanService>(AlgoanService);
    await algoanService.onModuleInit();
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
      const spy = jest.spyOn(hooksService, 'handleBankreaderLinkRequiredEvent').mockReturnValue(null);
      await hooksService.handleWebhook(mockEvent as EventDTO, 'mockSignature');

      expect(spy).toBeCalledWith(mockServiceAccount, mockEvent.payload);
    });

    it('handles configuration required', async () => {
      mockEvent.subscription.eventName = EventName.BANKREADER_CONFIGURATION_REQUIRED;
      const spy = jest.spyOn(hooksService, 'handleBankreaderConfigurationRequiredEvent').mockReturnValue(null);
      await hooksService.handleWebhook(mockEvent as EventDTO, 'mockSignature');

      expect(spy).toBeCalledWith(mockServiceAccount, mockEvent.payload);
    });

    it('handles bankreader required', async () => {
      mockEvent.subscription.eventName = EventName.BANKREADER_REQUIRED;
      const spy = jest.spyOn(hooksService, 'handleBankReaderRequiredEvent').mockReturnValue(null);
      await hooksService.handleWebhook(mockEvent as EventDTO, 'mockSignature');

      expect(spy).toBeCalledWith(mockServiceAccount, mockEvent.payload);
    });
  });
});
