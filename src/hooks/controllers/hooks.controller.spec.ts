import { Test, TestingModule } from '@nestjs/testing';
import { EventName } from '@algoan/rest';
import { EventDTO } from '../dto/event.dto';
import { AggregatorModule } from '../../aggregator/aggregator.module';
import { AlgoanModule } from '../../algoan/algoan.module';
import { HooksService } from '../services/hooks.service';
import { AppModule } from '../../app.module';
import { HooksController } from './hooks.controller';

describe('Hooks Controller', () => {
  let controller: HooksController;
  let hooksService: HooksService;

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

  it('should handle the webhook connection', () => {
    const event: EventDTO = {
      subscription: {
        id: 'b3cf907a5a66c1a7f5490fe1',
        target: 'https://bankease.com/algoan-hook/',
        eventName: EventName.SERVICE_ACCOUNT_CREATED,
        status: 'ACTIVE',
      },
      payload: {
        serviceAccountId: 'serviceAccountId',
      },
      time: 1586177798388,
      index: 32,
      id: 'eventId',
    };

    const spy = jest.spyOn(hooksService, 'handleWebhook').mockReturnValue(Promise.resolve());
    controller.controlHook(event, {
      'x-hub-signature': 'sha256=7a21851efc6fb1dd6d526d22f9bed739b5a26d54f0ef6b03ef662dc184fdd27d',
    }),
      expect(spy).toBeCalledWith(event, 'sha256=7a21851efc6fb1dd6d526d22f9bed739b5a26d54f0ef6b03ef662dc184fdd27d');
  });
});
