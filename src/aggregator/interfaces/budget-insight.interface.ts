/**
 * Budget Insight ConnectionWrapper
 */
export interface ConnectionWrapper {
  connections: Connection[];
}

/**
 * Budget Insight Connection
 */
export interface Connection {
  id?: string;
  accounts: Account[];
  last_update: string;
  error?: Error;
  active: boolean;
  bank?: Bank;
}

/**
 * Budget Insight Account
 */
export interface Account {
  currency: Currency;
  balance: number;
  error?: Error;
  name: string;
  last_update: string;
  type: AccountType;
  iban: string;
  bic: string;
  id: number;
  loan?: Loan;
  usage?: string;
  transactions?: Transaction[];
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
export enum Error {
  WRONGPASS = 'wrongpass',
  ADDITIONAL_INFORMATION_NEEDED = 'additionalInformationNeeded',
  WEBSITE_UNAVAILABLE = 'websiteUnavailable',
  ACTION_NEEDED = 'actionNeeded',
  BUG = 'bug',
}

/**
 * Budget Insight TransactionWrapper
 */
export interface TransactionWrapper {
  transactions: Transaction[];
}

/**
 * Budget Insight Transaction
 */
export interface Transaction {
  id_account: number;
  id: string;
  rdate: string;
  simplified_wording: string;
  value: number;
  card: string;
  wording: string;
  original_wording: string;
  category: Category;
  type: TransactionType;
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
 * TransactionType
 */
export enum OwnerType {
  PRIVATE = 'private',
  ORGANIZATION = 'organization',
  ASSOCIATION = 'association',
}

/**
 * Category
 */
export interface Category {
  name: string;
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
 * Budget Insight configurations
 */
export interface BIConfigurations {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  name: string;
  webhook?: boolean;
}

/**
 * Budget insight credentials mapped to service account ids
 */
export type BudgetInsightCredentials = Map<string, BIConfigurations>;
