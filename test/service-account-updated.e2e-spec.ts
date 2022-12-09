import { HttpStatus, INestApplication } from '@nestjs/common';
import * as nock from 'nock';
import { buildFakeApp } from './utils/app';
import * as crypto from 'crypto';
import { config } from 'node-config-ts';
import * as request from 'supertest';
import delay from 'delay';
import { patchEventStatus } from './utils/algoan.fake-server';
import { EventStatus } from '@algoan/rest';

let app: INestApplication;

describe('HooksController (e2e) - service_account_updated event handler', () => {
  beforeAll(async () => {
    app = await buildFakeApp();
  });

  beforeEach(() => {
    if (!nock.isActive()) {
      nock.activate();
    }
  });

  afterEach(() => {
    nock.cleanAll();
  });

  afterAll(async () => {
    nock.cleanAll();
    await app.close();
  });

  it('HK400 - should update the service account configuration', async () => {
    const subscriptionId: string = '4';
    const eventId: string = 'eventId';
    const payload = {
      serviceAccountId: '4',
      config: {
        description: 'new description',
      },
    };

    // Simulate the fact that the event has been well handled
    //jest.spyOn(HooksService.prototype, 'handleServiceAccountUpdatedEvent').mockImplementation();
    const fakePatchEvent: nock.Scope = patchEventStatus(subscriptionId, eventId, EventStatus.PROCESSED);

    const encryptedSignature: string = crypto
      .createHmac('sha256', config.restHooksSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    await request(app.getHttpServer())
      .post('/hooks')
      .set('x-hub-signature', `sha256=${encryptedSignature}`)
      .send({
        subscription: {
          id: subscriptionId,
          target: config.targetUrl,
          status: 'ACTIVE',
          eventName: 'service_account_updated',
        },
        id: eventId,
        index: 4,
        time: Date.now(),
        payload,
      })
      .expect(HttpStatus.NO_CONTENT);

    await delay(1000);

    fakePatchEvent.done();
  });

  it('HK401 - should be unauthorized because the subscription id is wrong', async () => {
    const subscriptionId: string = '5';
    const eventId: string = 'eventId';
    const payload = {
      serviceAccountId: '5',
      config: {
        description: 'new description',
      },
    };

    const encryptedSignature: string = crypto
      .createHmac('sha256', config.restHooksSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    await request(app.getHttpServer())
      .post('/hooks')
      .set('x-hub-signature', `sha256=${encryptedSignature}`)
      .send({
        subscription: {
          id: subscriptionId,
          target: config.targetUrl,
          status: 'ACTIVE',
          eventName: 'service_acocunt_updated',
        },
        id: eventId,
        index: 5,
        time: Date.now(),
        payload,
      })
      .expect(HttpStatus.UNAUTHORIZED);

    await delay(1000);
  });
});
