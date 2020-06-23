/**
 * An interface representing a BanksUser
 */
import { EventName } from '@algoan/rest';
import { BIEventName } from '../../hooks/dto/subscription.dto';

/**
 * BanksUser
 */
export interface BanksUser {
  id: string;
  status: UserStatus;
  redirectUrl?: string;
  redirectUrlCreatedAt?: number;
  redirectUrlTTL?: number;
  callbackUrl: string;
  plugIn?: PlugIn;
}

/**
 * A BanksUser status
 */
export enum UserStatus {
  NEW = 'NEW',
  SYNCHRONIZING = 'SYNCHRONIZING',
  FINISHED = 'FINISHED',
}

/**
 * BanksUser Account
 */
export interface Account {
  balance: number;
  balanceDate: number;
  connectionSource: string;
  currency: string;
  type: AccountType;
  usage: string;
  bank?: string;
  bic?: string;
  iban?: string;
  loanDetails?: LoanDetails;
  name?: string;
  reference?: string;
  savingsDetails?: string;
  status?: string;
}

/**
 * BanksUser Account with transactions
 */
export interface AccountWithTransactions extends Account {
  transactions: Transaction[];
}

/**
 * BanksUser LoanDetails
 */
export interface LoanDetails {
  amount?: number;
  debitedAccountId?: string;
  endDate?: number;
  interestRate?: number;
  payment?: number;
  remainingCapital?: number;
  startDate?: number;
  type?: string;
}

/**
 * BanksUser AccountType
 */
export enum AccountType {
  CHECKINGS = 'CHECKINGS',
  SAVINGS = 'SAVINGS',
  LOAN = 'LOAN',
  CREDIT_CARD = 'CREDIT_CARD',
}

/**
 * Transaction
 */
export interface Transaction {
  amount: number;
  description: string;
  type: TransactionType;
  banksUserCardId: string;
  currency?: string;
  reference: string;
  simplifiedDescription: string;
  userDescription: string;
  category: string;
  date: string;
}

/**
 * TransactionType
 */
export enum TransactionType {
  'ATM' = 'ATM',
  'BANK_FEE' = 'BANK_FEE',
  'CASH' = 'CASH',
  'CHECK' = 'CHECK',
  'CREDIT' = 'CREDIT',
  'CREDIT_CARD_PAYMENT' = 'CREDIT_CARD_PAYMENT',
  'DEBIT' = 'DEBIT',
  'DEPOSIT' = 'DEPOSIT',
  'DIRECT_DEBIT' = 'DIRECT_DEBIT',
  'DIRECT_DEPOSIT' = 'DIRECT_DEPOSIT',
  'DIVIDEND' = 'DIVIDEND',
  'ELECTRONIC_PAYMENT' = 'ELECTRONIC_PAYMENT',
  'INTEREST' = 'INTEREST',
  'INTERNAL_TRANSFERT' = 'INTERNAL_TRANSFERT',
  'POINT_OF_SALE' = 'POINT_OF_SALE',
  'POTENTIAL_TRANSFER' = 'POTENTIAL_TRANSFER',
  'REPEATING_PAYMENT' = 'REPEATING_PAYMENT',
  'OTHER' = 'OTHER',
  'UNKNOWN' = 'UNKNOWN',
}

/**
 * OwnerType
 */
export enum OwnerType {
  'PERSONAL' = 'PERSONAL',
  'PROFESSIONAL' = 'PROFESSIONAL',
}

/**
 * Login
 */
export interface Login {
  access_token: string;
}

/**
 * PlugIn to open the interface of BudgetInsight in the Chatbot
 */
export interface PlugIn {
  budgetInsightBank?: {
    baseUrl: string;
    token: string;
  };
}

/**
 * A service account represents a service subscription for a chatflow sent by algoan
 * @export
 */
export interface ServiceAccountDTO {
  /**
   * The id of the client
   */
  readonly clientId: string;
  /**
   * Secret associated to the clientId
   */
  readonly clientSecret: string;

  /**
   * Unique file identifier
   */
  readonly id: string;
  /**
   * The chatflowId linked to the service account
   */
  readonly chatflowId?: string;
  /**
   * The OAuth2.0 refreshToken of the service account
   */
  readonly refreshToken?: string;
  /**
   * The timestamp of when the service account was created
   */
  readonly createdAt?: number;
  /**
   * The OAuth2.0 scope of the service account
   */
  readonly scope?: string;
  /**
   * The list of RestHooks subscription associated to the service account
   */
  restHookSubscriptions?: RestHookSubscription[];
}

/**
 * A service account represents a service subscription for a chatflow with Oauth2 client
 */
export interface ServiceAccount {
  /**
   * The id of the client
   */
  readonly clientId: string;
  /**
   * Unique identifier
   */
  readonly id: string;
  /**
   * The chatflowId linked to the service account
   */
  readonly chatflowId?: string;
  /**
   * The OAuth2.0 refreshToken of the service account
   */
  readonly refreshToken?: string;
  /**
   * The timestamp of when the service account was created
   */
  readonly createdAt?: number;
  /**
   * The OAuth2.0 scope of the service account
   */
  readonly scope?: string;
  /**
   * The list of RestHooks subscription associated to the service account
   */
  restHookSubscriptions?: RestHookSubscription[];
}
/**
 * Event Resthook subscription information
 * @export
 */
export interface RestHookSubscription {
  /**
   * Unique id of the Resthook subscription
   */
  readonly id: string;
  /**
   * EventName
   */
  eventName?: EventName | BIEventName;
  /**
   * Secret shared between the Algoan Platform and the Resthook owner
   */
  readonly secret?: string;
  /**
   * The url of the resthook that will be called when an event subscribed is emitted by the Algoan platform
   */
  target?: string;
  /**
   * Whether the resthook is active or not. INACTIVE at the creation
   */
  status?: RestHookSubscriptionStatusEnum;
}

/**
 * RestHookSubscriptionStatusEnum
 * @export
 */
export enum RestHookSubscriptionStatusEnum {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

/**
 * Interface for the Multi status response
 * @template T - Type of the resource
 */
export interface Response<T> {
  elements: ResponseElement<T>[];
  metadata: {
    success: number;
    failure: number;
    total: number;
  };
}

/**
 * Element interface in the Multi status response
 *
 * ResponseElement
 * @template T - Type of the resource
 */
interface ResponseElement<T> {
  status: number;
  httpCode: string;
  message?: string;
  resource: T;
}
