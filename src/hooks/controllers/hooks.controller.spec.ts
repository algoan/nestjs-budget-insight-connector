import { Test, TestingModule } from '@nestjs/testing';
import { ContextIdFactory } from '@nestjs/core';
import { EventName } from '../enums/event-name.enum';

import { EventDTO } from '../dto/event.dto';
import { AggregatorModule } from '../../aggregator/aggregator.module';
import { AlgoanModule } from '../../algoan/algoan.module';
import { AppModule } from '../../app.module';
import { ConfigModule } from '../../config/config.module';
import { HooksService } from '../services/hooks.service';
import { HooksController } from './hooks.controller';

describe('Hooks Controller', () => {
  let controller: HooksController;
  let hooksService: HooksService;

  beforeEach(async () => {
    // To mock scoped DI
    const contextId = ContextIdFactory.create();
    jest.spyOn(ContextIdFactory, 'getByRequest').mockImplementation(() => contextId);

    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule, AggregatorModule, AlgoanModule, ConfigModule],
      providers: [HooksService],
      controllers: [HooksController],
    }).compile();

    controller = await module.resolve<HooksController>(HooksController, contextId);
    hooksService = await module.resolve<HooksService>(HooksService, contextId);
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
    });
    expect(spy).toBeCalledWith(event, 'sha256=7a21851efc6fb1dd6d526d22f9bed739b5a26d54f0ef6b03ef662dc184fdd27d');
  });
});
