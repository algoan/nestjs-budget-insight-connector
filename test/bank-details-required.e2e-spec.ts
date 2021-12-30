import { INestApplication } from '@nestjs/common';
import * as nock from 'nock';
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
import { runTestScenario } from './utils/tools';

let app: INestApplication;

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

  it('HK200 - REDIRECT - should successfully fetch bank accounts from BI and send them to Algoan', () =>
    runTestScenario(
      app,
      'bank_details_required',
      {
        algoanMockServerGenerator: mockBankDetailsRequiredRedirectMode,
        biMockServerGenerator: getAccountAndTrFromRedirectMode,
      },
      {
        tmpCode: true,
      },
    ));

  it('HK201 - REDIRECT - should successfully fetch bank accounts from BI without tmp code', () =>
    runTestScenario(app, 'bank_details_required', {
      algoanMockServerGenerator: mockBankDetailsRequiredRedirectModeRefresh,
      biMockServerGenerator: getAccountAndTrFromRedirectModeNoTmpCode,
    }));

  it('HK202 - API - should successfully fetch bank accounts from BI', () =>
    runTestScenario(app, 'bank_details_required', {
      algoanMockServerGenerator: mockBankDetailsRequiredAPIMode,
      biMockServerGenerator: getAccountAndTrFromAPIMode,
    }));

  it('HK203 - ERROR - should not fetch bank accounts from BI - no aggregation details', () =>
    runTestScenario(app, 'bank_details_required', {
      algoanMockServerGenerator: mockBankDetailsRequiredNoAggregationDetails,
    }));

  it('HK204 - ERROR - should not send accounts to Algoan because no connections have been fetched', () =>
    runTestScenario(app, 'bank_details_required', {
      algoanMockServerGenerator: mockBankDetailsRequiredAPIModeNoBIConnection,
      biMockServerGenerator: noConnectionFound,
    }));

  it('HK205 - ERROR - should update the Algoan analysis in an error state - connection not synchronized', () =>
    runTestScenario(app, 'bank_details_required', {
      algoanMockServerGenerator: mockBankDetailsRequiredAPIModeNoConnectionSync,
      biMockServerGenerator: noConnectionSynchronized,
    }));
});
