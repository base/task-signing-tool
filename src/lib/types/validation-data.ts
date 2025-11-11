import type {
  BalanceChange,
  ExpectedHashes,
  StateChange,
  StateOverride,
} from './validation-config';

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
}
