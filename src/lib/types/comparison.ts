import type { BalanceChange, Change, Override } from './validation-config';

export interface SigningDataComparison {
  contractName: string;
  contractAddress?: string;
  expected: {
    dataToSign: string;
    address: string;
    domainHash: string;
    messageHash: string;
    description?: string;
  };
  actual?: {
    dataToSign: string;
    address: string;
    domainHash: string;
    messageHash: string;
    description?: string;
  };
}

export interface OverrideComparison {
  contractName: string;
  contractAddress?: string;
  expected: Override;
  actual?: Override;
}

export interface StateChangeComparison {
  contractName: string;
  contractAddress?: string;
  expected: Change;
  actual?: Change;
}

export interface BalanceChangeComparison {
  contractName: string;
  contractAddress?: string;
  expected: BalanceChange;
  actual?: BalanceChange;
}

export interface ValidationItemsByStep {
  signing: SigningDataComparison[];
  overrides: OverrideComparison[];
  changes: StateChangeComparison[];
  balance: BalanceChangeComparison[];
}
