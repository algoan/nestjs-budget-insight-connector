import { HttpStatus, INestApplication } from '@nestjs/common';
import * as nock from 'nock';
import { buildFakeApp } from './utils/app';
import * as crypto from 'crypto';
import { config } from 'node-config-ts';
import * as request from 'supertest';
import delay from 'delay';

let app: INestApplication;

describe('HooksController (e2e) - service_account_required event handler', () => {
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
    const subscriptionId: string = '1';
    const eventId: string = 'eventId';
    const payload = {
      serviceAccountId: '1',
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
          eventName: 'service_account_updated',
        },
        id: eventId,
        index: 1,
        time: Date.now(),
        payload,
      })
      .expect(HttpStatus.NO_CONTENT);

    await delay(1000);
  });
});
