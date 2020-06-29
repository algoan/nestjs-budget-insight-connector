/* eslint-disable max-lines */
import { Test, TestingModule } from '@nestjs/testing';
import { BanksUser } from '@algoan/rest/dist/src/core/BanksUser';

import { ServiceAccount } from '@algoan/rest/dist/src/core/ServiceAccount';
import { AggregatorModule } from '../../../aggregator/aggregator.module';
import { AggregatorService } from '../../../aggregator/services/aggregator.service';
import { CoreModule } from '../../../core/core.module';
import { ServiceAccountCreatedDTO } from '../../dto/service-account-created.dto';
import { AlgoanModule } from '../../../algoan/algoan.module';
import { UserStatus } from '../../../algoan/interfaces/algoan.interface';
import { AppModule } from '../../../app.module';
import { ConnectionSyncedDTO } from '../../dto/connection-synced.dto';
import { EventService } from './event.service';

describe('EventService', () => {
  let eventService: EventService;
  let aggregatorService: AggregatorService;
  let banksUserMapService: BanksUserMapService;
  let banksUserService: BanksUser;
  let serviceAccount: ServiceAccount;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule, CoreModule, AggregatorModule, AlgoanModule],
      providers: [EventService],
    }).compile();

    eventService = module.get<EventService>(EventService);
    aggregatorService = module.get<AggregatorService>(AggregatorService);
    banksUserMapService = module.get<BanksUserMapService>(BanksUserMapService);
    banksUserService = module.get<BanksUser>(BanksUser);
    serviceAccount = module.get<ServiceAccount>(ServiceAccount);
    serviceAccount.biCredentialsMap.set('serviceAccountId', {
      clientId: 'clientId',
      clientSecret: 'clientSecret',
      baseUrl: 'https://budget-insight/',
      name: 'connector-budgetInsight-psm',
    });
  });

  it('should be defined', () => {
    expect(eventService).toBeDefined();
  });

  describe('when synchroniseBanksUser is called', () => {
    it('calls the aggregator with tmpCode', async () => {
      const tmpCode = 'tmpCode';
      const finalCode = 'finalCode';

      jest.spyOn(banksUserService, 'getBanksUser').mockReturnValue(Promise.resolve(({} as unknown) as BanksUser));

      const registerSpy = jest.spyOn(aggregatorService, 'registerClient').mockReturnValue(Promise.resolve(finalCode));
      const getAccountsSpy = jest.spyOn(aggregatorService, 'getAccounts').mockReturnValue(Promise.resolve([]));
      const getTransactionsSpy = jest.spyOn(aggregatorService, 'getTransactions').mockReturnValue(Promise.resolve([]));
      const synchroniseBanksUser = jest
        .spyOn(banksUserService, 'synchronizeBanksUser')
        .mockReturnValue(Promise.resolve());

      await eventService.synchronizeBanksUser(
        {
          id: 'serviceAccountId',
          clientId: 'clientId',
        },
        {
          applicationId: 'applicationId',
          banksUserId: 'banksUserId',
          temporaryCode: tmpCode,
        },
      );

      expect(registerSpy).toHaveBeenCalledWith('serviceAccountId', tmpCode);
      expect(getAccountsSpy).toHaveBeenCalledWith('serviceAccountId', finalCode);
      expect(getTransactionsSpy).toHaveBeenCalledWith('serviceAccountId', finalCode);
      expect(synchroniseBanksUser).toHaveBeenCalledWith(
        [],
        {
          id: 'serviceAccountId',
          clientId: 'clientId',
        },
        'banksUserId',
      );
    });

    it('calls the aggregator with tmpCode retrieved from the BanksUser', async () => {
      const testToken = 'test_token';
      const registerSpy = jest.spyOn(aggregatorService, 'registerClient');
      jest.spyOn(banksUserService, 'getBanksUser').mockReturnValue(
        Promise.resolve(({
          plugIn: {
            budgetInsightBank: {
              token: testToken,
            },
          },
        } as unknown) as BanksUser),
      );
      const getAccountsSpy = jest.spyOn(aggregatorService, 'getAccounts').mockReturnValue(Promise.resolve([]));
      const getTransactionsSpy = jest.spyOn(aggregatorService, 'getTransactions').mockReturnValue(Promise.resolve([]));
      const synchroniseBanksUser = jest
        .spyOn(banksUserService, 'synchronizeBanksUser')
        .mockReturnValue(Promise.resolve());

      await eventService.synchronizeBanksUser(
        {
          id: 'serviceAccountId',
          clientId: 'clientId',
        },
        {
          applicationId: 'applicationId',
          banksUserId: 'banksUserId',
          temporaryCode: '',
        },
      );

      expect(registerSpy).not.toHaveBeenCalled();
      expect(getAccountsSpy).toHaveBeenCalledWith('serviceAccountId', testToken);
      expect(getTransactionsSpy).toHaveBeenCalledWith('serviceAccountId', testToken);
      expect(synchroniseBanksUser).toHaveBeenCalledWith(
        [],
        {
          id: 'serviceAccountId',
          clientId: 'clientId',
        },
        'banksUserId',
      );
    });

    it('calls the aggregator with tmpCode and store connections into  database if webhook = true', async () => {
      serviceAccount.biCredentialsMap.set('serviceAccountId', {
        clientId: 'clientId',
        clientSecret: 'clientSecret',
        baseUrl: 'https://budget-insight/',
        name: 'connector-budgetInsight-psm',
        webhook: true,
      });
      const testToken = 'test_token';
      const registerSpy = jest.spyOn(aggregatorService, 'registerClient');
      jest.spyOn(banksUserService, 'getBanksUser').mockReturnValue(
        Promise.resolve(({
          plugIn: {
            budgetInsightBank: {
              token: testToken,
            },
          },
        } as unknown) as BanksUser),
      );
      const getAccountsSpy = jest.spyOn(aggregatorService, 'getAccounts').mockReturnValue(Promise.resolve([]));
      const getTransactionsSpy = jest.spyOn(aggregatorService, 'getTransactions').mockReturnValue(Promise.resolve([]));
      const getConnectionsSpy = jest
        .spyOn(aggregatorService, 'getConnections')
        .mockReturnValue(Promise.resolve([{ id: 'idCon', accounts: [], last_update: '', active: true }]));
      const synchroniseBanksUser = jest
        .spyOn(banksUserService, 'synchronizeBanksUser')
        .mockReturnValue(Promise.resolve());
      const createBanksUserMap = jest.spyOn(banksUserMapService, 'create').mockReturnValue(
        Promise.resolve({
          banksUserId: 'banksUserId',
          connectionId: 'idCon',
          clientId: 'clientId',
        }),
      );

      await eventService.synchronizeBanksUser(
        {
          id: 'serviceAccountId',
          clientId: 'clientId',
        },
        {
          applicationId: 'applicationId',
          banksUserId: 'banksUserId',
          temporaryCode: '',
        },
      );

      expect(registerSpy).not.toHaveBeenCalled();
      expect(getAccountsSpy).not.toHaveBeenCalled();
      expect(getTransactionsSpy).not.toHaveBeenCalled();
      expect(synchroniseBanksUser).not.toHaveBeenCalled();

      expect(getConnectionsSpy).toHaveBeenCalledWith('serviceAccountId', testToken);
      expect(createBanksUserMap).toHaveBeenCalledWith({
        banksUserId: 'banksUserId',
        connectionId: 'idCon',
        clientId: 'clientId',
      });
    });
  });

  describe('when generateRedirectUrl is called', () => {
    it('get the corresponding banksUser, generate the webviewUrl and register it on the banksUser', async () => {
      const banksUser: BanksUser = {
        id: 'banksUserId',
        callbackUrl: 'callbackUrl',
        status: UserStatus.NEW,
      };

      const mockServiceAccount: ServiceAccount = {
        id: 'serviceAccountId',
        clientId: 'clientId',
      };

      const aggregatorSpy = jest.spyOn(aggregatorService, 'generateRedirectUrl').mockReturnValue('redirectUrl');
      const banksUserGetSpy = jest.spyOn(banksUserService, 'getBanksUser').mockReturnValue(Promise.resolve(banksUser));
      const banksUserRegisterSpy = jest
        .spyOn(banksUserService, 'registerRedirectUrl')
        .mockReturnValue(Promise.resolve(banksUser));

      await eventService.generateRedirectUrl(mockServiceAccount, {
        applicationId: 'applicationId',
        banksUserId: 'banksUserId',
      });

      expect(banksUserGetSpy).toHaveBeenCalledWith(
        {
          id: 'serviceAccountId',
          clientId: 'clientId',
        },
        'banksUserId',
      );
      expect(aggregatorSpy).toHaveBeenCalledWith('serviceAccountId', banksUser);
      expect(banksUserRegisterSpy).toHaveBeenCalledWith(mockServiceAccount, banksUser, 'redirectUrl');
    });
  });

  describe('when addServiceAccount is called', () => {
    const serviceAccountCreated: ServiceAccountCreatedDTO = {
      serviceAccountId: '123abc',
    };

    it('calls the serviceAccount', async () => {
      const serviceAccountMock = jest.spyOn(serviceAccount, 'add').mockReturnValue(Promise.resolve());

      await eventService.addServiceAccount(serviceAccountCreated);
      expect(serviceAccountMock).toHaveBeenCalledWith('123abc');
    });
  });

  describe('when removeServiceAccount is called', () => {
    const serviceAccountDeleted = {
      serviceAccountId: '123abc',
    };

    it('calls the serviceAccount', async () => {
      const serviceAccountMock = jest.spyOn(serviceAccount, 'remove').mockReturnValue(undefined);

      await eventService.removeServiceAccount(serviceAccountDeleted);
      expect(serviceAccountMock).toHaveBeenCalledWith('123abc');
    });
  });

  describe('when getSandboxToken is called', () => {
    it('calls the aggregator with tmpCode', async () => {
      const tokenSpy = jest.spyOn(aggregatorService, 'getJWToken').mockReturnValue(
        Promise.resolve({
          jwt_token: 'token',
          payload: {
            domain: 'base_url',
          },
        }),
      );
      const patchBanksUserSpy = jest.spyOn(banksUserService, 'patchBanksUser').mockReturnValue(
        Promise.resolve({
          id: 'banksUserId',
          status: UserStatus.NEW,
          callbackUrl: 'callbackUrl',
        }),
      );

      await eventService.getSandboxToken(
        {
          id: 'serviceAccountId',
          clientId: 'clientId',
        },
        {
          banksUserId: 'banksUserId',
        },
      );

      expect(tokenSpy).toHaveBeenCalled();
      expect(patchBanksUserSpy).toHaveBeenCalledWith(
        {
          id: 'serviceAccountId',
          clientId: 'clientId',
        },
        'banksUserId',
        {
          budgetInsightBank: {
            baseUrl: 'https://base_url/2.0/',
            token: 'token',
          },
        },
      );
    });
  });

  describe('when patchBanksUserConnectionSync is called', () => {
    it('patch the BanksUser by calling synchronizeBanksUser', async () => {
      const banksUserMapServiceSpy = jest.spyOn(banksUserMapService, 'getByConnectionId').mockReturnValue(
        Promise.resolve({
          banksUserId: 'banksUserId',
          clientId: 'serviceAccountClientId',
          connectionId: 'connectionId',
        }),
      );
      const banksUserServiceSpy = jest
        .spyOn(banksUserService, 'synchronizeBanksUser')
        .mockReturnValue(Promise.resolve());

      const payload: ConnectionSyncedDTO = ({
        user: {
          signin: '2019-11-25 17:36:55',
          platform: 'sharedAccess',
          id: 1,
        },
        connection: {
          bank: {
            name: 'This name',
          },
          connector_uuid: '338178e6-3d01-564f-9a7b-52ca442459bf',
          id_user: 1,
          created: '2020-01-23 18:38:43',
          id_provider: 59,
          error_message: undefined,
          last_push: undefined,
          last_update: '2020-05-18 10:36:50',
          connector: {
            sync_frequency: undefined,
            code: undefined,
            color: '5c2963',
            auth_mechanism: 'credentials',
            id: 59,
            uuid: '338178e6-3d01-564f-9a7b-52ca442459bf',
            account_types: ['perco', 'checking', 'loan', 'savings', 'card', 'pee', 'market', 'lifeinsurance'],
            documents_type: [],
            restricted: false,
            available_transfer_mechanisms: ['credentials'],
            capabilities: [
              'profile',
              'banktransfer',
              'banktransferaddrecipient',
              'contact',
              'bankwealth',
              'document',
              'bank',
            ],
            transfer_beneficiary_types: ['recipient'],
            transfer_execution_date_types: ['first_open_day', 'deferred'],
            months_to_fetch: undefined,
            siret: undefined,
            hidden: false,
            beta: false,
            slug: 'EXA',
            categories: [],
            name: 'Connecteur de test',
            available_auth_mechanisms: ['credentials', 'webauth'],
            urls: [],
            charged: false,
          },
          active: true,
          state: undefined,
          expire: undefined,
          accounts: [
            {
              ownership: 'owner',
              loan: undefined,
              webid: '3002900000',
              // eslint-disable-next-line id-blacklist
              number: '3002900000',
              disabled: undefined,
              currency: {
                name: 'Euro',
                symbol: '€',
                crypto: false,
                precision: 2,
                prefix: false,
                marketcap: undefined,
                datetime: undefined,
                id: 'EUR',
              },
              id: 274,
              bookmarked: 0,
              formatted_balance: '2381,86 {',
              id_connection: 76,
              original_name: 'Compte chèque',
              last_update: '2020-05-18 10:36:40',
              id_source: 133,
              company_name: undefined,
              usage: 'PRIV',
              type: 'checking',
              recipients: [],
              information: {},
              deleted: undefined,
              id_parent: undefined,
              bic: 'CDTBFRBIXXX',
              iban: 'EX6713679564637300290000028',
              id_type: 2,
              coming_balance: 2381.86,
              coming: undefined,
              transfers: [],
              id_user: 1,
              name: 'Compte chèque',
              display: true,
              transactions: [
                {
                  comment: undefined,
                  informations: {
                    weboob: 'yes',
                  },
                  webid: undefined,
                  active: true,
                  simplified_wording: 'DEBIT MENSUEL CARTE',
                  original_gross_value: undefined,
                  id: 6394,
                  original_value: undefined,
                  original_wording: 'DEBIT MENSUEL CARTE',
                  id_account: 274,
                  id_cluster: undefined,
                  deleted: undefined,
                  last_update: '2020-05-18 10:36:41',
                  commission: undefined,
                  state: 'fail_categorizing',
                  gross_value: undefined,
                  new: true,
                  type: 'summary_card',
                  commission_currency: undefined,
                  id_category: 9998,
                  counterparty: undefined,
                  original_currency: undefined,
                  nopurge: 0,
                  formatted_value: '-837,95 €',
                  rdate: '2020-01-31',
                  coming: false,
                  date: '2020-01-31',
                  application_date: '2020-01-31',
                  card: undefined,
                  date_scraped: '2020-02-01 17:24:05',
                  bdate: '2020-01-31',
                  vdate: undefined,
                  country: undefined,
                  value: -837.95,
                  documents_count: 0,
                  stemmed_wording: 'DEBIT MENSUEL CARTE',
                  wording: 'DEBIT MENSUEL CARTE',
                },
              ],
              error: undefined,
              balance: 2381.86,
            },
          ],
          error: undefined,
          id_bank: 59,
          next_try: '2020-05-19 13:06:50',
          id_connector: 59,
          id: 'connectionId',
        },
        push_type: 'partial_history',
      } as unknown) as ConnectionSyncedDTO;

      await eventService.patchBanksUserConnectionSync(payload);

      const expectedAccountsWithTransactions = [
        {
          balance: 2381.86,
          balanceDate: 1589791000000,
          bank: 'This name',
          bic: 'CDTBFRBIXXX',
          connectionSource: 'BUDGET_INSIGHT',
          currency: 'EUR',
          iban: 'EX6713679564637300290000028',
          loanDetails: undefined,
          name: 'Compte chèque',
          reference: '274',
          savingsDetails: 'checking',
          status: 'ACTIVE',
          transactions: [
            {
              amount: -837.95,
              banksUserCardId: undefined,
              category: undefined,
              date: '2020-01-30T23:00:00.000Z',
              description: 'DEBIT MENSUEL CARTE',
              reference: '6394',
              simplifiedDescription: 'DEBIT MENSUEL CARTE',
              type: 'OTHER',
              userDescription: 'DEBIT MENSUEL CARTE',
            },
          ],
          type: 'CHECKINGS',
          usage: 'PERSONAL',
        },
      ];
      const expectedServiceAccount = { clientId: 'serviceAccountClientId' };
      const expectedBanksUserId = 'banksUserId';

      expect(banksUserMapServiceSpy).toHaveBeenCalledWith('connectionId');
      expect(banksUserServiceSpy).toHaveBeenCalledWith(
        expectedAccountsWithTransactions,
        expectedServiceAccount,
        expectedBanksUserId,
      );
    });
  });
});
