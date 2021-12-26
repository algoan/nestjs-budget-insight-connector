import * as nock from 'nock';
import { config } from 'node-config-ts';

/**
 * Mock the /auth/jwt API
 */
export const getUserJwt = (): nock.Scope => {
  return nock(config.budgetInsight.url)
    .post('/auth/jwt')
    .reply(200, {
      jwt_token: 'bi_token',
      payload: {
        id_user: 'user_id',
      },
    });
};
