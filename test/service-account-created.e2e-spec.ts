import { HttpStatus, INestApplication } from '@nestjs/common';
import * as nock from 'nock';
import { buildFakeApp } from './utils/app';
import * as request from 'supertest';
import delay from 'delay';
import * as crypto from 'crypto';
import { config } from 'node-config-ts';
import { patchEventStatus } from './utils/algoan.fake-server';
import { EventStatus } from '@algoan/rest';
import { HooksService } from '../src/hooks/services/hooks.service';

let app: INestApplication;

describe('HooksController (e2e) - service_account_created event handler', () => {
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

  it('HK300 - should successfully create a new service account', async () => {
    const subscriptionId: string = '3';
    const eventId: string = 'eventId';
    const payload = {
      serviceAccountId: 'serviceAccountId',
    };

    jest.spyOn(HooksService.prototype, 'handleServiceAccountCreatedEvent').mockImplementation();
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
          eventName: 'service_account_created',
        },
        id: eventId,
        index: 3,
        time: Date.now(),
        payload: {
          serviceAccountId: 'serviceAccountId',
        },
      })
      .expect(HttpStatus.NO_CONTENT);

    await delay(1000);

    fakePatchEvent.done();
  });
});
