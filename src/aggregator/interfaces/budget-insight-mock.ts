import {
  BudgetInsightAccount,
  AccountType,
  BudgetInsightTransaction,
  TransactionType,
} from './budget-insight.interface';

export const mockAccount: BudgetInsightAccount = {
  id: 1,
  id_connection: 2,
  id_user: 3,
  id_source: 4,
  id_parent: 5,
  // eslint-disable-next-line id-blacklist
  number: 'mockNumber',
  original_name: 'mockOrginalName',
  coming: 'mockComing',
  currency: { id: 'id1' },
  balance: 100,
  name: 'mockName',
  last_update: '2011-10-05T14:48:00.000Z',
  type: AccountType.CHECKING,
  iban: 'mockIban',
  bic: 'mockBic',
  disabled: false,
  company_name: 'mockCompany',
};

export const mockTransaction: BudgetInsightTransaction = {
  id_account: 5,
  id: 'mockId',
  application_date: 'mockApplicationDate',
  rdate: 'mockRdate',
  simplified_wording: 'mockSimplifiedWording',
  value: 50,
  card: 'mockCard',
  wording: 'mockWording',
  original_wording: 'mockSimplifiedWording',
  category: { name: 'mockName' },
  type: TransactionType.BANK,
};
