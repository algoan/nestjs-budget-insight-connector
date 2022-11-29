import { INestApplication } from '@nestjs/common';
import nock from 'nock/types';
import { buildFakeApp } from './utils/app';
import * as request from 'supertest';
import delay from 'delay';
import * as crypto from 'crypto';
import { config } from 'node-config-ts';

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
    const subscriptionId: string = '1';
    const eventId: string = 'eventId';
    const payload = {
      customerId: 'customer_id',
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
          eventName: 'service_account_created',
        },
        id: eventId,
        index: 1,
        time: Date.now(),
        payload: {
          serviceAccountId: 'serviceAccountId',
        },
      });
  });
});
