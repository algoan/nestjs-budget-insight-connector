import { HttpStatus, INestApplication } from '@nestjs/common';
import * as crypto from 'crypto';
import * as delay from 'delay';
import { Scope } from 'nock';
import { config } from 'node-config-ts';
import * as request from 'supertest';

export const CUSTOMER_ID: string = 'customer_id';
export const ANALYSIS_ID: string = 'analysis_id';
export const SUBSCRIPTION_ID: string = '1';
export const EVENT_ID: string = 'event_id';
export const TMP_CODE: string = 'tmp_code';

type EventType =
  | 'aggregator_link_required'
  | 'bank_details_required'
  | 'service_account_created'
  | 'service_account_updated';
/**
 * Generate a header and a payload to simulate a call to the hook controller
 */
const fakeAndTestRequest = async (
  app: INestApplication,
  event: EventType,
  withTmpCode: boolean = false,
): Promise<void> => {
  const payload: { customerId: string; analysisId?: string; temporaryCode?: string } = {
    customerId: CUSTOMER_ID,
  };

  if (event === 'bank_details_required') {
    payload.analysisId = ANALYSIS_ID;
  }

  if (withTmpCode) {
    payload.temporaryCode = TMP_CODE;
  }

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
        id: SUBSCRIPTION_ID,
        target: config.targetUrl,
        status: 'ACTIVE',
        eventName: event,
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
 * @param app Nest application to run
 * @param event Event to handle for tests
 * @param mocks Mock Algoan and optionally BI servers
 * @param options Option related to specific tests
 */
export async function runTestScenario(
  app: INestApplication,
  event: EventType,
  mocks: { algoanMockServerGenerator: (...args) => Scope; biMockServerGenerator?: (...args) => Scope },
  options: { tmpCode: boolean } = { tmpCode: false },
): Promise<void> {
  const mockServer: Scope = mocks.algoanMockServerGenerator(CUSTOMER_ID);
  let biMockServer: Scope | undefined;

  if (mocks.biMockServerGenerator) {
    biMockServer = mocks.biMockServerGenerator();
  }

  await fakeAndTestRequest(app, event, options.tmpCode);
  await delay(200);

  mockServer.done();

  if (biMockServer) {
    biMockServer.done();
  }
}
