import type {
  BalanceChange,
  ExpectedHashes,
  StateChange,
  StateOverride,
} from './validation-config';

// Task Origin Validation Types
export type TaskOriginRole = 'taskCreator' | 'baseFacilitator' | 'securityCouncilFacilitator';

export interface TaskOriginSignerResult {
  role: TaskOriginRole;
  commonName: string;
  signatureFileName: string;
  success: boolean;
  error?: string;
}

export interface TaskOriginValidation {
  enabled: boolean;
  results: TaskOriginSignerResult[];
}

export interface ValidationData {
  expected: {
    stateOverrides: StateOverride[];
    stateChanges: StateChange[];
    balanceChanges?: BalanceChange[];
    domainAndMessageHashes?: ExpectedHashes;
  };
  actual: {
    stateOverrides: StateOverride[];
    stateChanges: StateChange[];
    balanceChanges?: BalanceChange[];
    domainAndMessageHashes?: ExpectedHashes;
  };
  taskOriginValidation?: TaskOriginValidation;
}
