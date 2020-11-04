/**
 * Budget Insight ConnectionWrapper
 * https://docs.budget-insight.com/reference/connections#list-connections
 */
export interface ConnectionWrapper {
  connections: Connection[];
}

/**
 * Budget insight account wrapper
 * https://docs.budget-insight.com/reference/bank-accounts#list-bank-accounts
 */
export interface AccountWrapper {
  accounts: BudgetInsightAccount[];
}

/**
 * Budget insight transaction wrapper
 * https://docs.budget-insight.com/reference/bank-transactions#list-transactions
 */
export interface TransactionWrapper {
  transactions: BudgetInsightTransaction[];
}

/**
 * Budget Insight Connection
 * https://docs.budget-insight.com/reference/connections#get-a-connection
 */
export interface Connection {
  id: number;
  id_user: number | null;
  id_connector: number;
  last_update: string | null;
  state: ConnectionErrorState | null;
  active: boolean;
  created: Date | null;
  next_try: Date | null;
  connector?: Bank;
}

/**
 * Budget Insight Account
 * https://docs.budget-insight.com/reference/bank-accounts
 */
export interface BudgetInsightAccount {
  id: number;
  id_connection: number | null;
  id_user: number | null;
  id_source: number | null;
  id_parent: number | null;
  // eslint-disable-next-line id-blacklist
  number: string | null;
  original_name: string;
  coming: string | null;
  currency: Currency;
  balance: number;
  error?: Error;
  name: string;
  last_update: string;
  type: AccountType;
  iban: string | null;
  bic: string;
  loan?: Loan | null;
  usage: BankAccountUsage;
  disabled: boolean;
  company_name: string | null;
}

/**
 * Budget Insight Loan
 */
export interface Loan {
  total_amount: number;
  id_account: string;
  maturity_date: string;
  rate: number;
  next_payment_amount: number;
  subscription_date: string;
  type: AccountType;
}

/**
 * Budget Insight Bank
 */
export interface Bank {
  name: string;
}

/**
 * Budget Insight Currency
 */
export interface Currency {
  id: string;
}

/**
 * Budget Insight AccountType
 */
export enum AccountType {
  CHECKING = 'checking',
  SAVINGS = 'savings',
  DEPOSIT = 'deposit',
  LOAN = 'loan',
  MARKET = 'market',
  JOINT = 'joint',
  CARD = 'card',
  LIFE_INSURANCE = 'lifeinsurance',
  PEE = 'pee',
  PERCO = 'perco',
  ARTICLE_83 = 'article83',
  RSP = 'rsp',
  PEA = 'pea',
  CAPITALISATION = 'capitalisation',
  PERP = 'perp',
  MADELIN = 'madelin',
  UNKNOWN = 'unknown',
}

/**
 * Budget Insight Error
 */
export enum ConnectionErrorState {
  WRONGPASS = 'wrongpass',
  ADDITIONAL_INFORMATION_NEEDED = 'additionalInformationNeeded',
  WEBSITE_UNAVAILABLE = 'websiteUnavailable',
  ACTION_NEEDED = 'actionNeeded',
  BUG = 'bug',
  SCA_REQUIRED = 'SCARequired',
  DECOUPLED = 'decoupled',
  PASSWORD_EXPIRED = 'passwordExpired',
  WEBAUTH_REQUIRED = 'webauthRequired',
}

/**
 * Budget Insight Transaction
 * https://docs.budget-insight.com/reference/bank-transactions#get-a-transaction
 */
export interface BudgetInsightTransaction {
  id_account: number;
  id: string;
  application_date: string | null;
  date: string;
  rdate: string;
  simplified_wording: string;
  value: number;
  card: string;
  wording: string;
  original_wording: string;
  type: TransactionType;
  id_category: number | null;
  original_currency: Currency | null;
}

/**
 * TransactionType
 */
export enum TransactionType {
  TRANSFER = 'transfer',
  ORDER = 'order',
  CHECK = 'check',
  DEPOSIT = 'deposit',
  PAYBACK = 'payback',
  WITHDRAWAL = 'withdrawal',
  LOAN_PAYMENT = 'loan_payment',
  BANK = 'bank',
  CARD = 'card',
  DEFERRED_CARD = 'deferred_card',
  CARD_SUMMARY = 'card_summary',
}

/**
 * UsageType
 */
export enum UsageType {
  PRIVATE = 'private',
  ORGANIZATION = 'organization',
  ASSOCIATION = 'association',
}

/**
 * JSON Web Token Response
 */
export interface JWTokenResponse {
  jwt_token: string;
  payload: {
    domain: string;
  };
}

/**
 * Body returned after registration
 */
export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
}

/**
 * Bank account usage
 * https://docs.budget-insight.com/reference/bank-accounts#get-a-bank-account
 */
export enum BankAccountUsage {
  PRIVATE = 'PRIV',
  PROFESSIONAL = 'ORGA',
  ASSOCIATION = 'ASSO',
}

/**
 * Budget Insight Category
 * https://docs.budget-insight.com/reference/categories
 */
export interface BudgetInsightCategory {
  id: number;
  id_parent_category: number;
  name: string;
  color: string;
  income: boolean | null;
  refundable: boolean;
  id_logo: number | null;
}
