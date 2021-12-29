import { HttpStatus, INestApplication } from '@nestjs/common';
import * as crypto from 'crypto';
import * as delay from 'delay';
import * as nock from 'nock';
import { config } from 'node-config-ts';
import * as request from 'supertest';
import {
  mockBankDetailsRequiredAPIMode,
  mockBankDetailsRequiredAPIModeNoBIConnection,
  mockBankDetailsRequiredAPIModeNoConnectionSync,
  mockBankDetailsRequiredNoAggregationDetails,
  mockBankDetailsRequiredRedirectMode,
  mockBankDetailsRequiredRedirectModeRefresh,
} from './utils/algoan.fake-server';

import { buildFakeApp } from './utils/app';
import {
  getAccountAndTrFromAPIMode,
  getAccountAndTrFromRedirectMode,
  getAccountAndTrFromRedirectModeNoTmpCode,
  noConnectionFound,
  noConnectionSynchronized,
} from './utils/budget-insight.fake-server';

let app: INestApplication;

/**
 * Generate a header and a payload to simulate a call to the hook controller
 */
const fakeAndTestRequest = async (requestPayload: any = { customerId: 'customer_id' }): Promise<void> => {
  await request(app.getHttpServer())
    .post('/hooks')
    .set({
      'x-hub-signature': `sha256=${crypto
        .createHmac('sha256', config.restHooksSecret)
        .update(JSON.stringify(requestPayload))
        .digest('hex')}`,
    })
    .send({
      subscription: {
        id: '1',
        target: config.targetUrl,
        status: 'ACTIVE',
        eventName: 'bank_details_required',
      },
      id: 'event_id',
      index: 1,
      time: Date.now(),
      payload: requestPayload,
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
  requestPayload: any = { customerId: 'customer_id', analysisId: 'analysis_id' },
): () => Promise<void> {
  return async (): Promise<void> => {
    const mockServer: nock.Scope = algoanMockServerGenerator('customer_id');
    let biMockServer: nock.Scope | undefined;

    if (biMockServerGenerator) {
      biMockServer = biMockServerGenerator();
    }

    await fakeAndTestRequest(requestPayload);
    await delay(200);

    mockServer.done();

    if (biMockServer) {
      biMockServer.done();
    }
  };
}

describe('HooksController (e2e) - bank_details_required event handler', () => {
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

  it(
    'HK200 - REDIRECT - should successfully fetch bank accounts from BI and send them to Algoan',
    runTestScenario(mockBankDetailsRequiredRedirectMode, getAccountAndTrFromRedirectMode, {
      customerId: 'customer_id',
      temporaryCode: 'tmp_code',
      analysisId: 'analysis_id',
    }),
  );

  it(
    'HK201 - REDIRECT - should successfully fetch bank accounts from BI without tmp code',
    runTestScenario(mockBankDetailsRequiredRedirectModeRefresh, getAccountAndTrFromRedirectModeNoTmpCode),
  );

  it(
    'HK202 - API - should successfully fetch bank accounts from BI',
    runTestScenario(mockBankDetailsRequiredAPIMode, getAccountAndTrFromAPIMode),
  );

  it(
    'HK203 - ERROR - should not fetch bank accounts from BI - no aggregation details',
    runTestScenario(mockBankDetailsRequiredNoAggregationDetails),
  );

  it(
    'HK204 - ERROR - should not send accounts to Algoan because no connections have been fetched',
    runTestScenario(mockBankDetailsRequiredAPIModeNoBIConnection, noConnectionFound),
  );

  it(
    'HK205 - ERROR - should update the Algoan analysis in an error state - connection not synchronized',
    runTestScenario(mockBankDetailsRequiredAPIModeNoConnectionSync, noConnectionSynchronized),
  );
});
