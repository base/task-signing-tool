import type { BalanceChange, Change, Override } from './validation-config';
import type { TaskOriginSignerResult } from './validation-data';

export interface TaskOriginComparison {
  results: TaskOriginSignerResult[];
  allPassed: boolean;
  isDisabled?: boolean;
}

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
  taskOrigin: TaskOriginComparison[];
  signing: SigningDataComparison[];
  overrides: OverrideComparison[];
  changes: StateChangeComparison[];
  balance: BalanceChangeComparison[];
}
