import { HttpStatus, INestApplication } from '@nestjs/common';
import * as crypto from 'crypto';
import * as delay from 'delay';
import * as nock from 'nock';
import { config } from 'node-config-ts';
import * as request from 'supertest';
import {
  mockAggregatorLinkRequiredAPIMode,
  mockAggregatorLinkRequiredRedirectModeWithCb,
  mockAggregatorLinkRequiredRedirectModeWithoutCb,
  mockInvalidMode,
  mockNoAggregationDetails,
  mockUnknownCustomer,
} from './utils/algoan.fake-server';

import { buildFakeApp } from './utils/app';
import { getUserJwt } from './utils/budget-insight.fake-server';

let app: INestApplication;

/**
 * Generate a header and a payload to simulate a call to the hook controller
 */
const fakeAndTestRequest = async (): Promise<void> => {
  const payload = {
    customerId: 'customer_id',
  };

  await request(app.getHttpServer())
    .post('/hooks')
    .set({
      'x-hub-signature': `sha256=${crypto
        .createHmac('sha256', config.restHooksSecret)
        .update(JSON.stringify(payload))
        .digest('hex')}`,
    })
    .send({
      subscription: {
        id: '1',
        target: config.targetUrl,
        status: 'ACTIVE',
        eventName: 'aggregator_link_required',
      },
      id: 'event_id',
      index: 1,
      time: Date.now(),
      payload,
    })
    .expect(HttpStatus.NO_CONTENT);
};

/**
 * Run common test scenarios and ensure mock servers have been called
 * @param algoanMockServerGenerator Mock Algoan server generator method
 * @param biMockServerGenerator Mock Budget Insight server generator method
 */
function runTestScenario(
  algoanMockServerGenerator: (...args) => nock.Scope,
  biMockServerGenerator?: (...args) => nock.Scope,
): () => Promise<void> {
  return async (): Promise<void> => {
    const mockServer: nock.Scope = algoanMockServerGenerator('customer_id');
    let biMockServer: nock.Scope | undefined;

    if (biMockServerGenerator) {
      biMockServer = biMockServerGenerator();
    }

    await fakeAndTestRequest();
    await delay(200);

    mockServer.done();

    if (biMockServer) {
      biMockServer.done();
    }
  };
}

describe('HooksController (e2e) - aggregation_link_required event handler', () => {
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
    nock.restore();
    jest.clearAllMocks();
    await app.close();
  });

  describe('REDIRECT MODE', () => {
    it('HK100 - should send to Algoan a redirect URL', runTestScenario(mockAggregatorLinkRequiredRedirectModeWithCb));

    it(
      'HK101 - should fail because no callbackURL is defined in the customer',
      runTestScenario(mockAggregatorLinkRequiredRedirectModeWithoutCb),
    );
  });

  describe('API MODE', () => {
    it('HK102 - should get and send a token to Algoan', runTestScenario(mockAggregatorLinkRequiredAPIMode, getUserJwt));
  });

  describe('UNKNOWN MODE', () => {
    it('HK103 - should fail because mode is unknown', runTestScenario(mockInvalidMode));
  });

  describe('OTHER ERROR SCENARIOS', () => {
    it('HK104 - should fail because the customer does not exist', runTestScenario(mockUnknownCustomer));

    it('HK105 - should fail because no aggregation details', runTestScenario(mockNoAggregationDetails));
  });
});
