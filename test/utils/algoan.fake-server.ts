import { EventStatus } from '@algoan/rest';
import { HttpStatus } from '@nestjs/common';
import * as nock from 'nock';
import { config } from 'node-config-ts';

import { AggregationDetailsAggregatorName } from '../../src/algoan/dto/customer.enums';
import { ANALYSIS_ID, CUSTOMER_ID, EVENT_ID, SUBSCRIPTION_ID } from './tools';

/**
 * Returns a nock interceptor where all mock servers begin with
 * @param nock Nock scope
 */
const baseScenario = (nock: nock.Scope): nock.Interceptor => {
  return nock
    .post('/v1/oauth/token')
    .reply(HttpStatus.OK, {
      access_token: 'token',
      refresh_token: 'refresh_token',
      expires_in: 3000,
      refresh_expires_in: 10000,
    })
    .get(`/v2/customers/${CUSTOMER_ID}`);
};
/**
 * Nock server when application starts and no subscription exist yet
 */
export const onApplicationStart = (): nock.Scope => {
  return nock(config.algoan.baseUrl)
    .post('/v1/oauth/token')
    .times(2)
    .reply(HttpStatus.OK, {
      access_token: 'token',
      refresh_token: 'refresh_token',
      expires_in: 3000,
      refresh_expires_in: 10000,
    })
    .get('/v1/service-accounts')
    .reply(HttpStatus.OK, [
      {
        clientId: 'client1',
        clientSecret: 'secret',
        id: 'id1',
      },
    ])
    .get(`/v1/subscriptions?filter=${JSON.stringify({ eventName: { $in: config.eventList } })}`)
    .reply(HttpStatus.OK, [])
    .post('/v1/subscriptions')
    .reply(HttpStatus.CREATED, {
      id: '1',
      secret: config.restHooksSecret,
      eventName: 'aggregator_link_required',
      target: config.targetUrl,
    })
    .post('/v1/subscriptions')
    .reply(HttpStatus.CREATED, {
      id: '2',
      secret: config.restHooksSecret,
      eventName: 'bank_details_required',
      target: config.targetUrl,
    });
};

/**
 * Mock the PATCH /v1/subscriptions/{subscriptionId}/events/{eventId} API
 * @param subscriptionId Subscription id
 * @param eventId Event id
 * @param status Status patched to check
 * NOTE: No need to mock the API result, the app does not care
 */
export const patchEventStatus = (subscriptionId: string, eventId: string, status: EventStatus): nock.Scope => {
  return nock(config.algoan.baseUrl)
    .patch(`/v1/subscriptions/${subscriptionId}/events/${eventId}`, {
      status,
    })
    .reply(HttpStatus.OK, {});
};

/**
 * Mock Algoan API for the "aggreator_link_required" event with redirect mode
 * The Customer owns a callback URL
 * @param customerId CustomerId
 * @returns
 */
export const mockAggregatorLinkRequiredRedirectModeWithCb = (): nock.Scope => {
  const callbackUrl: string = 'http://callback.url';

  return baseScenario(nock(config.algoan.baseUrl))
    .reply(HttpStatus.OK, {
      id: CUSTOMER_ID,
      aggregationDetails: {
        callbackUrl,
        mode: 'REDIRECT',
      },
    })
    .patch(`/v2/customers/${CUSTOMER_ID}`, {
      aggregationDetails: {
        redirectUrl: `${config.budgetInsight.url}/auth/webview/fr/connect?client_id=${config.budgetInsight.clientId}&redirect_uri=${callbackUrl}&response_type=code&state=&types=banks`,
        aggregatorName: AggregationDetailsAggregatorName.BUDGET_INSIGHT,
        apiUrl: config.budgetInsight.url,
        clientId: config.budgetInsight.clientId,
      },
    })
    .reply(HttpStatus.OK, {})
    .patch(`/v1/subscriptions/${SUBSCRIPTION_ID}/events/${EVENT_ID}`, {
      status: EventStatus.PROCESSED,
    })
    .reply(HttpStatus.OK);
};

/**
 * Mock Algoan API for the "aggreator_link_required" event with redirect mode
 * The Customer does not have a callback URL
 * @param customerId CustomerId
 * @returns
 */
export const mockAggregatorLinkRequiredRedirectModeWithoutCb = (): nock.Scope => {
  return baseScenario(nock(config.algoan.baseUrl))
    .reply(HttpStatus.OK, {
      id: CUSTOMER_ID,
      aggregationDetails: {
        mode: 'REDIRECT',
      },
    })
    .patch(`/v1/subscriptions/${SUBSCRIPTION_ID}/events/${EVENT_ID}`, {
      status: EventStatus.ERROR,
    })
    .reply(HttpStatus.OK);
};

/**
 * Mock Algoan API for the "aggreator_link_required" event with iframe mode
 * The Customer owns a callback URL
 * @param customerId CustomerId
 * @returns
 */
export const mockAggregatorLinkRequiredIframeModeWithCb = (): nock.Scope => {
  const callbackUrl: string = 'http://callback.url';

  return baseScenario(nock(config.algoan.baseUrl))
    .reply(HttpStatus.OK, {
      id: CUSTOMER_ID,
      aggregationDetails: {
        callbackUrl,
        mode: 'IFRAME',
      },
    })
    .patch(`/v2/customers/${CUSTOMER_ID}`, {
      aggregationDetails: {
        iframeUrl: `${config.budgetInsight.url}/auth/webview/fr/connect?client_id=${config.budgetInsight.clientId}&redirect_uri=${callbackUrl}&response_type=code&state=&types=banks`,
        aggregatorName: AggregationDetailsAggregatorName.BUDGET_INSIGHT,
        apiUrl: config.budgetInsight.url,
        clientId: config.budgetInsight.clientId,
      },
    })
    .reply(HttpStatus.OK, {})
    .patch(`/v1/subscriptions/${SUBSCRIPTION_ID}/events/${EVENT_ID}`, {
      status: EventStatus.PROCESSED,
    })
    .reply(HttpStatus.OK);
};

/**
 * Mock Algoan API for the "aggreator_link_required" event with iframe mode
 * The Customer does not have a callback URL
 * @param customerId CustomerId
 * @returns
 */
export const mockAggregatorLinkRequiredIframeModeWithoutCb = (): nock.Scope => {
  return baseScenario(nock(config.algoan.baseUrl))
    .reply(HttpStatus.OK, {
      id: CUSTOMER_ID,
      aggregationDetails: {
        mode: 'IFRAME',
      },
    })
    .patch(`/v1/subscriptions/${SUBSCRIPTION_ID}/events/${EVENT_ID}`, {
      status: EventStatus.ERROR,
    })
    .reply(HttpStatus.OK);
};

/**
 * Mock Algoan API when handling "aggregator_link_required" event in API Mode
 * @param customerId Customer ID
 */
export const mockAggregatorLinkRequiredAPIMode = (): nock.Scope => {
  return baseScenario(nock(config.algoan.baseUrl))
    .reply(HttpStatus.OK, {
      id: CUSTOMER_ID,
      aggregationDetails: {
        mode: 'API',
      },
    })
    .patch(`/v2/customers/${CUSTOMER_ID}`, {
      aggregationDetails: {
        token: 'bi_token',
        userId: 'user_id',
        aggregatorName: AggregationDetailsAggregatorName.BUDGET_INSIGHT,
        apiUrl: config.budgetInsight.url,
        clientId: config.budgetInsight.clientId,
      },
    })
    .reply(HttpStatus.OK, {})
    .patch(`/v1/subscriptions/${SUBSCRIPTION_ID}/events/${EVENT_ID}`, {
      status: EventStatus.PROCESSED,
    })
    .reply(HttpStatus.OK);
};

/**
 * Mock a customer with a unknown mode
 * @param customerId CustomerId
 */
export const mockInvalidMode = (): nock.Scope => {
  return baseScenario(nock(config.algoan.baseUrl))
    .reply(HttpStatus.OK, {
      id: CUSTOMER_ID,
      aggregationDetails: {
        mode: 'UNKNOWN',
      },
    })
    .patch(`/v1/subscriptions/${SUBSCRIPTION_ID}/events/${EVENT_ID}`, {
      status: EventStatus.ERROR,
    })
    .reply(HttpStatus.OK);
};

/**
 * Mock a unknown customer
 * @param customerId CustomerId
 */
export const mockUnknownCustomer = (): nock.Scope => {
  return baseScenario(nock(config.algoan.baseUrl))
    .reply(HttpStatus.NOT_FOUND)
    .patch(`/v1/subscriptions/${SUBSCRIPTION_ID}/events/${EVENT_ID}`, {
      status: EventStatus.ERROR,
    })
    .reply(HttpStatus.OK);
};

/**
 * Mock a customer without aggregationDetails
 * @param customerId CustomerId
 */
export const mockNoAggregationDetails = (): nock.Scope => {
  return baseScenario(nock(config.algoan.baseUrl))
    .reply(HttpStatus.OK, {
      id: CUSTOMER_ID,
    })
    .patch(`/v1/subscriptions/${SUBSCRIPTION_ID}/events/${EVENT_ID}`, {
      status: EventStatus.ERROR,
    })
    .reply(HttpStatus.OK);
};

/**
 * Mock "bank_details_required" event in redirect mode.
 * A temporary code is defined in the hook payload
 */
export const mockBankDetailsRequiredRedirectMode = (customerId: string): nock.Scope => {
  return baseScenario(nock(config.algoan.baseUrl))
    .reply(HttpStatus.OK, {
      id: customerId,
      aggregationDetails: {
        mode: 'REDIRECT',
      },
    })
    .patch(`/v2/customers/${CUSTOMER_ID}`, {
      aggregationDetails: {
        userId: 'user_id',
      },
    })
    .reply(HttpStatus.OK)
    .patch(`/v2/customers/${CUSTOMER_ID}/analyses/${ANALYSIS_ID}`)
    .reply(HttpStatus.OK, {})
    .patch(`/v1/subscriptions/${SUBSCRIPTION_ID}/events/${EVENT_ID}`, {
      status: EventStatus.PROCESSED,
    })
    .reply(HttpStatus.OK);
};

/**
 * Mock "bank_details_required" event in redirect mode.
 * A temporary code is not defined in the hook payload
 */
export const mockBankDetailsRequiredRedirectModeRefresh = (customerId: string): nock.Scope => {
  return baseScenario(nock(config.algoan.baseUrl))
    .reply(HttpStatus.OK, {
      id: customerId,
      aggregationDetails: {
        mode: 'REDIRECT',
        userId: 'user_id',
      },
    })
    .patch(`/v2/customers/${CUSTOMER_ID}/analyses/${ANALYSIS_ID}`)
    .reply(HttpStatus.OK, {})
    .patch(`/v1/subscriptions/${SUBSCRIPTION_ID}/events/${EVENT_ID}`, {
      status: EventStatus.PROCESSED,
    })
    .reply(HttpStatus.OK);
};

/**
 * Mock "bank_details_required" event in API mode.
 */
export const mockBankDetailsRequiredAPIMode = (customerId: string): nock.Scope => {
  return baseScenario(nock(config.algoan.baseUrl))
    .reply(HttpStatus.OK, {
      id: customerId,
      aggregationDetails: {
        mode: 'API',
        userId: 'user_id',
        apiUrl: config.budgetInsight.url,
        clientId: config.budgetInsight.clientId,
        token: 'jwt_token',
      },
    })
    .patch(`/v2/customers/${CUSTOMER_ID}/analyses/${ANALYSIS_ID}`)
    .reply(HttpStatus.OK, {})
    .patch(`/v1/subscriptions/${SUBSCRIPTION_ID}/events/${EVENT_ID}`, {
      status: EventStatus.PROCESSED,
    })
    .reply(HttpStatus.OK);
};

/**
 * Mock "bank_details_required" event in API mode
 * No aggregation details are defined in the customer
 */
export const mockBankDetailsRequiredNoAggregationDetails = (customerId: string): nock.Scope => {
  return baseScenario(nock(config.algoan.baseUrl))
    .reply(HttpStatus.OK, {
      id: customerId,
      aggregationDetails: {},
    })
    .patch(`/v1/subscriptions/${SUBSCRIPTION_ID}/events/${EVENT_ID}`, {
      status: EventStatus.PROCESSED,
    })
    .reply(HttpStatus.OK);
};

/**
 * Mock "bank_details_required" event in API mode
 * No aggregation details are defined in the customer
 */
export const mockBankDetailsRequiredAPIModeNoBIConnection = (): nock.Scope => {
  return baseScenario(nock(config.algoan.baseUrl))
    .reply(HttpStatus.OK, {
      id: CUSTOMER_ID,
      aggregationDetails: {
        mode: 'API',
        userId: 'user_id',
        apiUrl: config.budgetInsight.url,
        clientId: config.budgetInsight.clientId,
        token: 'jwt_token',
      },
    })
    .patch(`/v1/subscriptions/${SUBSCRIPTION_ID}/events/${EVENT_ID}`, {
      status: EventStatus.PROCESSED,
    })
    .reply(HttpStatus.OK);
};

/**
 * Mock "bank_details_required" event in API mode
 * No aggregation details are defined in the customer
 */
export const mockBankDetailsRequiredAPIModeNoConnectionSync = (): nock.Scope => {
  return baseScenario(nock(config.algoan.baseUrl))
    .reply(HttpStatus.OK, {
      id: CUSTOMER_ID,
      aggregationDetails: {
        mode: 'API',
        userId: 'user_id',
        apiUrl: config.budgetInsight.url,
        clientId: config.budgetInsight.clientId,
        token: 'jwt_token',
      },
    })
    .patch(`/v2/customers/${CUSTOMER_ID}/analyses/${ANALYSIS_ID}`, {
      status: 'ERROR',
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occured when fetching data from the aggregator',
      },
    })
    .reply(HttpStatus.OK)
    .patch(`/v1/subscriptions/${SUBSCRIPTION_ID}/events/${EVENT_ID}`, {
      status: EventStatus.ERROR,
    })
    .reply(HttpStatus.OK);
};
