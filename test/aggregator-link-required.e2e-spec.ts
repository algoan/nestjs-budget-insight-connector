import { INestApplication } from '@nestjs/common';
import * as nock from 'nock';
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
import { runTestScenario } from './utils/tools';

let app: INestApplication;

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
    it('HK100 - should send to Algoan a redirect URL', () =>
      runTestScenario(app, 'aggregator_link_required', {
        algoanMockServerGenerator: mockAggregatorLinkRequiredRedirectModeWithCb,
      }));

    it('HK101 - should fail because no callbackURL is defined in the customer', () =>
      runTestScenario(app, 'aggregator_link_required', {
        algoanMockServerGenerator: mockAggregatorLinkRequiredRedirectModeWithoutCb,
      }));
  });

  describe('API MODE', () => {
    it('HK102 - should get and send a token to Algoan', () =>
      runTestScenario(app, 'aggregator_link_required', {
        algoanMockServerGenerator: mockAggregatorLinkRequiredAPIMode,
        biMockServerGenerator: getUserJwt,
      }));
  });

  describe('UNKNOWN MODE', () => {
    it('HK103 - should fail because mode is unknown', () =>
      runTestScenario(app, 'aggregator_link_required', {
        algoanMockServerGenerator: mockInvalidMode,
      }));
  });

  describe('OTHER ERROR SCENARIOS', () => {
    it('HK104 - should fail because the customer does not exist', () =>
      runTestScenario(app, 'aggregator_link_required', { algoanMockServerGenerator: mockUnknownCustomer }));

    it('HK105 - should fail because no aggregation details', () =>
      runTestScenario(app, 'aggregator_link_required', { algoanMockServerGenerator: mockNoAggregationDetails }));
  });
});
