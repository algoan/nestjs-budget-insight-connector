import { EnrichedConnection } from '../../aggregator/interfaces/enriched-budget-insight.interface';
import {
  AccountType,
  AccountUsage,
  AccountSavingType,
  AccountLoanType,
  AnalysisStatus,
  AccountOwnership,
} from './analysis.enum';
import { AnalysisError } from './analysis.objects';

/**
 * Analysis Update Input
 */
export type AnalysisUpdateInput =
  | {
      status?: AnalysisStatus;
      error?: AnalysisError;
    }
  | {
      connections?: EnrichedConnection[];
      format: 'BUDGET_INSIGHT_V2_0';
    }
  | {
      accounts?: Account[];
    };

/**
 * Account
 */
export interface Account {
  balance: number;
  balanceDate: string; // IsoDateString
  currency: string; // ISO4217
  type: AccountType;
  usage: AccountUsage;
  ownership?: AccountOwnership;
  owners?: AccountOwner[];
  iban?: string;
  bic?: string;
  name?: string;
  bank?: AccountBank;
  country?: string; // format ISO 3166-1 alpha-2
  coming?: number;
  details?: AccountDetails;
  aggregator: AccountAggregator;
  transactions?: AccountTransactions[];
  // eslint-disable-next-line id-blacklist
  number?: string;
}

/**
 * Account Owner
 */
export interface AccountOwner {
  name?: string;
}

/**
 * Account Bank
 */
export interface AccountBank {
  id?: string;
  logoUrl?: string;
  name?: string;
  country?: string;
}

/**
 * Account Details
 */
export interface AccountDetails {
  savings?: AccountDetailsSavings;
  loan?: AccountDetailsLoans;
}

/**
 * Account Details Savings
 */
export interface AccountDetailsSavings {
  type?: AccountSavingType;
  openedAt?: string; // IsoDateString
  maximumAmount?: number;
  interestRate?: number;
}
/**
 * Account Details Loans
 */
export interface AccountDetailsLoans {
  type?: AccountLoanType;
  amount?: number;
  startDate?: string; // IsoDateString
  endDate?: string; // IsoDateString
  duration?: number; // in month
  insuranceLabel?: string;
  payment?: number; // By Month
  remainingCapital?: number;
  interestRate?: number;
}

/**
 * Account Aggregator
 */
export interface AccountAggregator {
  id: string;
}

/**
 * Account Transactions
 */
export interface AccountTransactions {
  dates: AccountTransactionDates;
  description: string;
  amount: number;
  currency: string; // format ISO 3166-1 alpha-2 // Default EUR
  isComing?: boolean;
  aggregator?: AccountTransactionAggregator;
}

/**
 * Account Transaction Dates
 */
export interface AccountTransactionDates {
  debitedAt?: string; // IsoDateString
  bookedAt?: string; // IsoDateString
}

/**
 * Account Transaction Aggregator
 */
export interface AccountTransactionAggregator {
  id?: string;
  category?: string;
  type?: string;
}
