import { EventStatus, SubscriptionEvent } from '@algoan/rest';
import { HttpStatus } from '@nestjs/common';
import * as nock from 'nock';
import { config } from 'node-config-ts';

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
