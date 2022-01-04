import { EventStatus } from '@algoan/rest';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as assert from 'assert';
import * as crypto from 'crypto';
import delay from 'delay';
import * as nock from 'nock';
import { config } from 'node-config-ts';
import { HooksService } from '../src/hooks/services/hooks.service';
import * as request from 'supertest';
import { patchEventStatus } from './utils/algoan.fake-server';
import { buildFakeApp } from './utils/app';

describe('HooksController (e2e) - Basic scenario', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await buildFakeApp();
  });

  afterAll(async () => {
    nock.restore();
    jest.clearAllMocks();
    await app.close();
  });

  describe('POST /hooks', () => {
    it('HK001 - should be a bad request - no request body', async () => {
      return request(app.getHttpServer()).post('/hooks').send({}).expect(HttpStatus.BAD_REQUEST);
    });

    it('HK002 - should be a bad request - no event id', async () => {
      return request(app.getHttpServer())
        .post('/hooks')
        .send({
          subscription: {
            id: '1',
          },
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('HK003 - should be unauthorized - no service account found', async () => {
      return request(app.getHttpServer())
        .post('/hooks')
        .send({
          subscription: {
            id: 'unknown',
            target: 'http://',
            status: 'ACTIVE',
            eventName: 'bankreader_link_required',
          },
          id: 'random',
          index: 1,
          time: Date.now(),
          payload: {
            customerId: 'customer_id',
          },
        })
        .expect(HttpStatus.UNAUTHORIZED);
    });

    // NOTE: this scenario should never happen in real life
    it('HK004 - should be ok, but the event status is patched to fail because unknown event', async () => {
      const subscriptionId: string = '1';
      const eventId: string = 'random';
      const fakePatchEvent: nock.Scope = patchEventStatus(subscriptionId, eventId, EventStatus.FAILED);
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
            eventName: 'unknown_event',
          },
          id: eventId,
          index: 1,
          time: Date.now(),
          payload,
        })
        .expect(HttpStatus.NO_CONTENT);

      await delay(1000);

      assert.strictEqual(fakePatchEvent.isDone(), true);
    });

    it('HK005 - should be unauthorized - invalid signature', async () => {
      const subscriptionId: string = '1';
      const eventId: string = 'random';

      await request(app.getHttpServer())
        .post('/hooks')
        .set('x-hub-signature', 'sha256=random_signature')
        .send({
          subscription: {
            id: subscriptionId,
            target: config.targetUrl,
            status: 'ACTIVE',
            eventName: 'aggregation_link_required',
          },
          id: eventId,
          index: 1,
          time: Date.now(),
          payload: {
            customerId: 'customerId',
          },
        })
        .expect(HttpStatus.UNAUTHORIZED, {
          message: 'Invalid X-Hub-Signature: you cannot call this API',
          statusCode: HttpStatus.UNAUTHORIZED,
          error: 'Unauthorized',
        });
    });

    it('HK006 - should be ok - correct signature', async () => {
      const subscriptionId: string = '1';
      const eventId: string = 'eventId';
      const payload = {
        customerId: 'customer_id',
      };
      // Simulate the fact that the event has been well handled
      jest.spyOn(HooksService.prototype, 'handleAggregatorLinkRequiredEvent').mockImplementation();
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
            eventName: 'aggregator_link_required',
          },
          id: eventId,
          index: 1,
          time: Date.now(),
          payload,
        })
        .expect(HttpStatus.NO_CONTENT);

      await delay(1000);

      fakePatchEvent.done();
    });
  });
});
