import { EventStatus, SubscriptionEvent } from '@algoan/rest';
import { HttpStatus } from '@nestjs/common';
import * as nock from 'nock';
import { config } from 'node-config-ts';

import { AggregationDetailsAggregatorName } from '../../src/algoan/dto/customer.enums';

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
export const mockAggregatorLinkRequiredRedirectModeWithCb = (customerId: string): nock.Scope => {
  const callbackUrl: string = 'http://callback.url';
  return nock(config.algoan.baseUrl)
    .post('/v1/oauth/token')
    .reply(HttpStatus.OK, {
      access_token: 'token',
      refresh_token: 'refresh_token',
      expires_in: 3000,
      refresh_expires_in: 10000,
    })
    .get(`/v2/customers/${customerId}`)
    .reply(HttpStatus.OK, {
      id: customerId,
      aggregationDetails: {
        callbackUrl,
        mode: 'REDIRECT',
      },
    })
    .patch(`/v2/customers/${customerId}`, {
      aggregationDetails: {
        redirectUrl: `${config.budgetInsight.url}auth/webview/fr/connect?client_id=${config.budgetInsight.clientId}&redirect_uri=${callbackUrl}&response_type=code&state=&types=banks`,
        aggregatorName: AggregationDetailsAggregatorName.BUDGET_INSIGHT,
        apiUrl: config.budgetInsight.url,
        clientId: config.budgetInsight.clientId,
      },
    })
    .reply(HttpStatus.OK, {})
    .patch('/v1/subscriptions/1/events/event_id', {
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
export const mockAggregatorLinkRequiredRedirectModeWithoutCb = (customerId: string): nock.Scope => {
  return nock(config.algoan.baseUrl)
    .post('/v1/oauth/token')
    .reply(HttpStatus.OK, {
      access_token: 'token',
      refresh_token: 'refresh_token',
      expires_in: 3000,
      refresh_expires_in: 10000,
    })
    .get(`/v2/customers/${customerId}`)
    .reply(HttpStatus.OK, {
      id: customerId,
      aggregationDetails: {
        mode: 'REDIRECT',
      },
    })
    .patch('/v1/subscriptions/1/events/event_id', {
      status: EventStatus.ERROR,
    })
    .reply(HttpStatus.OK);
};

/**
 * Mock Algoan API when handling "aggregator_link_required" event in API Mode
 * @param customerId Customer ID
 */
export const mockAggregatorLinkRequiredAPIMode = (customerId: string): nock.Scope => {
  return nock(config.algoan.baseUrl)
    .post('/v1/oauth/token')
    .reply(HttpStatus.OK, {
      access_token: 'token',
      refresh_token: 'refresh_token',
      expires_in: 3000,
      refresh_expires_in: 10000,
    })
    .get(`/v2/customers/${customerId}`)
    .reply(HttpStatus.OK, {
      id: customerId,
      aggregationDetails: {
        mode: 'API',
      },
    })
    .patch(`/v2/customers/${customerId}`, {
      aggregationDetails: {
        token: 'bi_token',
        userId: 'user_id',
        aggregatorName: AggregationDetailsAggregatorName.BUDGET_INSIGHT,
        apiUrl: config.budgetInsight.url,
        clientId: config.budgetInsight.clientId,
      },
    })
    .reply(HttpStatus.OK, {})
    .patch('/v1/subscriptions/1/events/event_id', {
      status: EventStatus.PROCESSED,
    })
    .reply(HttpStatus.OK);
};

/**
 * Mock a customer with a unknown mode
 * @param customerId CustomerId
 */
export const mockInvalidMode = (customerId: string): nock.Scope => {
  return nock(config.algoan.baseUrl)
    .post('/v1/oauth/token')
    .reply(HttpStatus.OK, {
      access_token: 'token',
      refresh_token: 'refresh_token',
      expires_in: 3000,
      refresh_expires_in: 10000,
    })
    .get(`/v2/customers/${customerId}`)
    .reply(HttpStatus.OK, {
      id: customerId,
      aggregationDetails: {
        mode: 'UNKNOWN',
      },
    })
    .patch('/v1/subscriptions/1/events/event_id', {
      status: EventStatus.ERROR,
    })
    .reply(HttpStatus.OK);
};

/**
 * Mock a unknown customer
 * @param customerId CustomerId
 */
export const mockUnknownCustomer = (customerId: string): nock.Scope => {
  return nock(config.algoan.baseUrl)
    .post('/v1/oauth/token')
    .reply(HttpStatus.OK, {
      access_token: 'token',
      refresh_token: 'refresh_token',
      expires_in: 3000,
      refresh_expires_in: 10000,
    })
    .get(`/v2/customers/${customerId}`)
    .reply(HttpStatus.NOT_FOUND)
    .patch('/v1/subscriptions/1/events/event_id', {
      status: EventStatus.ERROR,
    })
    .reply(HttpStatus.OK);
};

/**
 * Mock a customer without aggregationDetails
 * @param customerId CustomerId
 */
export const mockNoAggregationDetails = (customerId: string): nock.Scope => {
  return nock(config.algoan.baseUrl)
    .post('/v1/oauth/token')
    .reply(HttpStatus.OK, {
      access_token: 'token',
      refresh_token: 'refresh_token',
      expires_in: 3000,
      refresh_expires_in: 10000,
    })
    .get(`/v2/customers/${customerId}`)
    .reply(HttpStatus.OK, {
      id: customerId,
    })
    .patch('/v1/subscriptions/1/events/event_id', {
      status: EventStatus.ERROR,
    })
    .reply(HttpStatus.OK);
};
