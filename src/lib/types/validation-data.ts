import type {
  BalanceChange,
  ExpectedHashes,
  StateChange,
  StateOverride,
} from './validation-config';
import type { SafeTxTypedData } from '../safe-typed-data';

// Task Origin Validation Types
export type TaskOriginRole = 'taskCreator' | 'baseFacilitator' | 'securityCouncilFacilitator';

export interface TaskOriginSignerResult {
  role: TaskOriginRole;
  success: boolean;
  error?: string;
}

export interface TaskOriginValidation {
  enabled: boolean;
  results: TaskOriginSignerResult[];
  hidden?: boolean;
}

export interface ValidationData {
  ledgerId: number;
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
    // Present when the task simulation emitted a SafeTx; required for Trezor signing.
    safeTxTypedData?: SafeTxTypedData;
  };
  taskOriginValidation?: TaskOriginValidation;
}
