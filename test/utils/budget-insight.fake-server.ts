import { HttpStatus } from '@nestjs/common';
import * as nock from 'nock';
import { config } from 'node-config-ts';
import { ParsedUrlQueryInput } from 'querystring';

const fakeConnections = [
  {
    id: 'connection_id_1',
    active: false,
  },
  {
    id: 'connection_id_2',
    active: true,
    state: null,
    last_update: Date.now(),
  },
];

const fakeAccounts = [
  {
    id: '1',
    id_connection: 'connection_id_2',
    id_user: 'user_id',
    number: 'account_number',
    original_name: 'account_original_name',
    coming: 0,
    currency: {
      id: 'currency_id',
    },
    balance: 100,
    name: 'account_name',
    last_update: Date.now(),
    type: 'checking',
    iban: 'iban',
    bic: 'bic',
    usage: 'PRIV',
  },
];

const fakeTransactions = [
  {
    id_account: 'account_id_1',
    id: 'transaction_id_1',
    date: new Date().toISOString(),
    rdate: new Date().toISOString(),
    simplified_wording: 'simple_wording',
    value: 50,
    wording: 'long_wording',
    original_wording: 'original_wording',
    type: 'transfer',
    id_category: 'category_id_1',
    original_currency: {
      id: 'currency_id',
    },
    coming: false,
  },
];

/**
 * Mock the /auth/jwt API
 */
export const getUserJwt = (): nock.Scope => {
  return nock(config.budgetInsight.url)
    .post('/auth/jwt')
    .reply(HttpStatus.OK, {
      jwt_token: 'bi_token',
      payload: {
        id_user: 'user_id',
      },
    });
};

/**
 * Mock the classic redirect mode and fetch accounts and transactions from BI
 */
export const getAccountAndTrFromRedirectMode = (): nock.Scope => {
  return nock(config.budgetInsight.url)
    .post('/auth/token/access')
    .reply(HttpStatus.OK, {
      access_token: 'bi_access_token',
    })
    .get('/users/me')
    .reply(HttpStatus.OK, {
      id: 'user_id',
    })
    .get('/users/me/connections?expand=connector')
    .reply(HttpStatus.OK, {
      connections: fakeConnections,
    })
    .get('/users/me/accounts')
    .reply(HttpStatus.OK, {
      accounts: fakeAccounts,
    })
    .get('/users/me/connections/connection_id_2/informations')
    .reply(HttpStatus.OK, {
      owner: {
        name: 'John Doe',
      },
    })
    .get('/users/me/accounts/1/transactions')
    .query((parsedQuery: ParsedUrlQueryInput) => {
      return parsedQuery.min_date !== undefined && parsedQuery.max_date !== undefined;
    })
    .reply(HttpStatus.OK, {
      transactions: fakeTransactions,
    })
    .get('/banks/categories/category_id_1')
    .reply(HttpStatus.OK, {
      id: 'category_id_1',
      name: 'Category 1',
    });
};

/**
 * Mock the classic redirect mode and fetch accounts and transactions from BI without a temporary code
 */
export const getAccountAndTrFromRedirectModeNoTmpCode = (): nock.Scope => {
  return nock(config.budgetInsight.url)
    .post('/auth/jwt')
    .reply(HttpStatus.OK, {
      jwt_token: 'bi_access_token',
      payload: {
        id_user: 'user_id',
      },
    })
    .get('/users/me/connections?expand=connector')
    .reply(HttpStatus.OK, {
      connections: fakeConnections,
    })
    .get('/users/me/accounts')
    .reply(HttpStatus.OK, {
      accounts: fakeAccounts,
    })
    .get('/users/me/connections/connection_id_2/informations')
    .reply(HttpStatus.OK, {
      owner: {
        name: 'John Doe',
      },
    })
    .get('/users/me/accounts/1/transactions')
    .query((parsedQuery: ParsedUrlQueryInput) => {
      return parsedQuery.min_date !== undefined && parsedQuery.max_date !== undefined;
    })
    .reply(HttpStatus.OK, {
      transactions: fakeTransactions,
    })
    .get('/banks/categories/category_id_1')
    .reply(HttpStatus.OK, {
      id: 'category_id_1',
      name: 'Category 1',
    });
};

/**
 * Mock the API mode and fetch accounts and transactions from BI
 */
export const getAccountAndTrFromAPIMode = (): nock.Scope => {
  return nock(config.budgetInsight.url)
    .get('/users/me/connections?expand=connector')
    .reply(HttpStatus.OK, {
      connections: fakeConnections,
    })
    .get('/users/me/accounts')
    .reply(HttpStatus.OK, {
      accounts: fakeAccounts,
    })
    .get('/users/me/connections/connection_id_2/informations')
    .reply(HttpStatus.OK, {
      owner: {
        name: 'John Doe',
      },
    })
    .get('/users/me/accounts/1/transactions')
    .query((parsedQuery: ParsedUrlQueryInput) => {
      return parsedQuery.min_date !== undefined && parsedQuery.max_date !== undefined;
    })
    .reply(HttpStatus.OK, {
      transactions: fakeTransactions,
    })
    .get('/banks/categories/category_id_1')
    .reply(HttpStatus.OK, {
      id: 'category_id_1',
      name: 'Category 1',
    });
};

/**
 * Mock BI if no connections have been found
 */
export const noConnectionFound = (): nock.Scope => {
  return nock(config.budgetInsight.url)
    .get('/users/me/connections?expand=connector')
    .reply(HttpStatus.OK, {
      connections: [],
    })
    .persist();
};

/**
 * Mock BI when connection synchronization has not been done
 */
export const noConnectionSynchronized = (): nock.Scope => {
  return nock(config.budgetInsight.url)
    .get('/users/me/connections?expand=connector')
    .reply(HttpStatus.OK, {
      connections: [
        {
          id: 'connection_id_1',
          active: false,
        },
        {
          id: 'connection_id_2',
          active: true,
          state: 'pending',
          last_update: null,
        },
      ],
    })
    .persist();
};
