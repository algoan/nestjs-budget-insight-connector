import { Test, TestingModule } from '@nestjs/testing';
import { EventName, ServiceAccount } from '@algoan/rest';
import { AggregatorModule } from '../../aggregator/aggregator.module';
import { AlgoanModule } from '../../algoan/algoan.module';
import { BIEvent } from '../dto/bi-event.dto';
import { EventDTO } from '../dto/event.dto';
import { HooksService } from '../services/hooks.service';
import { AppModule } from '../../app.module';
import { HooksController } from './hooks.controller';

describe('Hooks Controller', () => {
  let controller: HooksController;
  let hooksService: HooksService;
  const serviceAccount: ServiceAccount = {
    id: 'serviceAccountId',
    clientId: 'clientId',
    restHookSubscriptions: [
      {
        id: 'b3cf907a5a66c1a7f5490fe1',
        secret: 'secret',
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule, AggregatorModule, AlgoanModule],
      providers: [HooksService],
      controllers: [HooksController],
    }).compile();

    controller = module.get<HooksController>(HooksController);
    hooksService = module.get<HooksService>(HooksService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('when calling hooks route', () => {
    describe('when the event is bankreader_required', () => {
      const eventBody: EventDTO = {
        subscription: {
          id: 'b3cf907a5a66c1a7f5490fe1',
          target: 'https://bankease.com/algoan-hook/',
          eventName: EventName.BANKREADER_REQUIRED,
          status: 'ACTIVE',
        },
        payload: {
          applicationId: '8fa7795ff26a471b384daf8b',
          banksUserId: '2a0bf32e3180329b3167e777',
          temporaryCode: 'temporaryCode',
        },
        time: 1560527519000,
        index: 34,
        id: 'eventId',
      };

      it('should start the synchronisation process', () => {
        serviceAccountService.serviceAccountMap.b3cf907a5a66c1a7f5490fe1 = serviceAccount;
        const spy = jest.spyOn(eventService, 'synchronizeBanksUser').mockReturnValue(Promise.resolve());
        expect(
          controller.controlHook(eventBody, {
            'x-hub-signature': 'sha256=3f5144cedff854d9a7667fd194980e72c256145ca49f6e46b3571b79d8591d4a',
          }),
        ).not.toBeDefined();
        expect(spy).toBeCalledWith(serviceAccount, eventBody.payload);
      });
    });

    describe('when the event is `bankreader_configuration_required`', () => {
      const eventBody: EventDTO = {
        subscription: {
          id: 'b3cf907a5a66c1a7f5490fe1',
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

      it('should get the sandbox token', () => {
        serviceAccountService.serviceAccountMap.b3cf907a5a66c1a7f5490fe1 = serviceAccount;
        const spy = jest.spyOn(hooksService, 'getSandboxToken').mockReturnValue(Promise.resolve());

        expect(
          controller.controlHook(eventBody, {
            'x-hub-signature': 'sha256=7a21851efc6fb1dd6d526d22f9bed739b5a26d54f0ef6b03ef662dc184fdd27d',
          }),
        ).not.toBeDefined();
        expect(spy).toBeCalledWith(serviceAccount, eventBody.payload);
      });
    });

    describe('when the event is service-account-created', () => {
      const eventBody: EventDTO = {
        subscription: {
          id: 'b3cf907a5a66c1a7f5490fe1',
          target: 'https://bankease.com/algoan-hook/',
          eventName: EventName.SERVICE_ACCOUNT_CREATED,
          status: 'ACTIVE',
        },
        payload: {
          applicationId: '8fa7795ff26a471b384daf8b',
          banksUserId: '2a0bf32e3180329b3167e777',
          temporaryCode: 'temporaryCode',
        },
        time: 1560527519000,
        index: 34,
        id: 'eventId',
      };

      it('should start the addition of the serviceAccount', () => {
        serviceAccountService.serviceAccountMap.b3cf907a5a66c1a7f5490fe1 = serviceAccount;
        const spy = jest.spyOn(hooksService, 'addServiceAccount').mockReturnValue(Promise.resolve());

        expect(
          controller.controlHook(eventBody, {
            'x-hub-signature': 'sha256=3920d3b2fc7a5d7282290b28c2b01f06da99d0378086b10e6b9380c3fac078c3',
          }),
        ).not.toBeDefined();
        expect(spy).toBeCalledWith(eventBody.payload);
      });
    });

    describe('when the event is service-account-deleted', () => {
      const eventBody: EventDTO = {
        subscription: {
          id: 'b3cf907a5a66c1a7f5490fe1',
          target: 'https://bankease.com/algoan-hook/',
          eventName: EventName.SERVICE_ACCOUNT_DELETED,
          status: 'ACTIVE',
        },
        payload: {
          applicationId: '8fa7795ff26a471b384daf8b',
          banksUserId: '2a0bf32e3180329b3167e777',
          temporaryCode: 'temporaryCode',
        },
        time: 1560527519000,
        index: 34,
        id: 'eventId',
      };

      it('should start the deletion of the serviceAccount', () => {
        serviceAccountService.serviceAccountMap.b3cf907a5a66c1a7f5490fe1 = serviceAccount;
        const spy = jest.spyOn(hooksService, 'removeServiceAccount').mockReturnValue(Promise.resolve());

        expect(
          controller.controlHook(eventBody, {
            'x-hub-signature': 'sha256=ecfe3389452dc90973d741f8b94e68eb232a50f2da054e1c53dfb595ccaee2e6',
          }),
        ).not.toBeDefined();
        expect(spy).toBeCalledWith(eventBody.payload);
      });

      it('should throw an error when the hash is invalid', async () => {
        serviceAccountService.serviceAccountMap.b3cf907a5a66c1a7f5490fe1 = serviceAccount;
        jest.spyOn(hooksService, 'removeServiceAccount').mockReturnValue(Promise.resolve());

        let errorThrown: boolean = false;
        let res;
        try {
          res = await controller.handleAlgoanEvent(eventBody, {
            'x-hub-signature': 'sha256=badsha256',
          });
        } catch (e) {
          errorThrown = true;
        } finally {
          expect(errorThrown).toBeTruthy();
          expect(res).toEqual(undefined);
        }
      });
    });

    describe('when the event is bankreader_link_required', () => {
      const eventBody: EventDTO = {
        subscription: {
          id: 'b3cf907a5a66c1a7f5490fe1',
          target: 'https://bankease.com/algoan-hook/',
          eventName: EventName.BANKREADER_LINK_REQUIRED,
          status: 'ACTIVE',
        },
        payload: {
          applicationId: '8fa7795ff26a471b384daf8b',
          banksUserId: '2a0bf32e3180329b3167e777',
          temporaryCode: 'temporaryCode',
        },
        time: 1560527519000,
        index: 34,
        id: 'eventId',
      };

      it('send the event to the right service', () => {
        serviceAccountService.serviceAccountMap.b3cf907a5a66c1a7f5490fe1 = serviceAccount;
        const eventServiceSpy = jest.spyOn(hooksService, 'generateRedirectUrl').mockReturnValue(Promise.resolve());
        expect(
          controller.controlHook(eventBody, {
            'x-hub-signature': 'sha256=e6b153073c9db80ffa69f6c21668d4de997f3620c262d9b44c056c8b4db975fa',
          }),
        ).not.toBeDefined();
        expect(eventServiceSpy).toHaveBeenCalled();
      });

      /**
       * controlHook is asynchronous
       * We can't test if it throws an error
       */
      it('throw an error id the service account does not exists', async () => {
        serviceAccountService.serviceAccountMap = {};
        const eventServiceSpy = jest.spyOn(hooksService, 'generateRedirectUrl').mockReturnValue(Promise.resolve());

        let errorThrown: boolean = false;
        let res;
        try {
          res = await controller.handleAlgoanEvent(eventBody, {
            'x-hub-signature': 'sha256=e6b153073c9db80ffa69f6c21668d4de997f3620c262d9b44c056c8b4db975fa',
          });
        } catch (e) {
          errorThrown = true;
        } finally {
          expect(errorThrown).toBeTruthy();
          expect(res).toEqual(undefined);
        }
        expect(eventServiceSpy).not.toHaveBeenCalled();
      });
    });

    describe('when the event is CONNECTION_SYNCED', () => {
      const payload: ConnectionSyncedDTO = ({
        connection: {
          id: 'something',
        },
      } as unknown) as ConnectionSyncedDTO;
      const eventBody: BIEvent = payload;

      it('send the event to the right service', async () => {
        serviceAccountService.serviceAccountMap.b3cf907a5a66c1a7f5490fe1 = serviceAccount;
        const eventServiceSpy = jest
          .spyOn(hooksService, 'patchBanksUserConnectionSync')
          .mockReturnValue(Promise.resolve());

        let errorThrown: boolean = false;
        try {
          expect(await controller.handleBudgetInsightEvent(eventBody)).not.toBeDefined();
        } catch (error) {
          errorThrown = true;
        }

        expect(errorThrown).toBeFalsy();
        expect(eventServiceSpy).toHaveBeenCalled();
      });
    });

    describe('when the event is invalid', () => {
      const eventBody: EventDTO = {
        subscription: {
          id: 'b3cf907a5a66c1a7f5490fe1',
          target: 'https://bankease.com/algoan-hook/',
          eventName: 'iuohjqwd' as EventName,
          status: 'ACTIVE',
        },
        payload: {
          applicationId: '8fa7795ff26a471b384daf8b',
          banksUserId: '2a0bf32e3180329b3167e777',
          temporaryCode: 'temporaryCode',
        },
        time: 1560527519000,
        index: 34,
        id: 'eventId',
      };

      it('it throws an error when the eventName is invalid', async () => {
        let errorThrown: boolean = false;
        let res;
        try {
          res = await controller.handleAlgoanEvent(eventBody, {
            'x-hub-signature': 'sha256=3f5144cedff854d9a7667fd194980e72c256145ca49f6e46b3571b79d8591d4a',
          });
        } catch (e) {
          errorThrown = true;
        } finally {
          expect(errorThrown).toBeTruthy();
          expect(res).toEqual(undefined);
        }
      });
    });
  });
});
