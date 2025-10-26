// ------------------------------- Validation Task Configs -------------------------------
export interface TaskConfig {
  task_name: string;
  script_name: string;
  signature: string;
  sender: string;
  args: string;
  'ledger-id': number;
  rpc_url: string;
  expected_domain_and_message_hashes: ExpectedHashes;
  state_overrides: StateOverride[];
  state_changes: StateChange[];
}

export interface ExpectedHashes {
  address: string;
  domain_hash: string;
  message_hash: string;
}

export interface StateOverride {
  name: string;
  address: string;
  overrides: Override[];
}

export interface Override {
  key: string;
  value: string;
  description: string;
}

export interface StateChange {
  name: string;
  address: string;
  changes: Change[];
}

export interface Change {
  key: string;
  before: string;
  after: string;
  description: string;
  allowDifference: boolean;
}

export interface ParseResult {
  success: boolean;
  zodError?: import('zod').ZodError;
}

export interface ParsedConfig {
  config: TaskConfig;
  result: ParseResult;
}

// ------------------------------- Diff Comparison Types -------------------------------
export interface StringDiff {
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  value: string;
  startIndex?: number;
  endIndex?: number;
}

// ------------------------------- Validation Data (Last Steps) Types -------------------------------
export interface ValidationData {
  expected: {
    stateOverrides: StateOverride[];
    stateChanges: StateChange[];
    domainAndMessageHashes?: ExpectedHashes;
  };
  actual: {
    stateOverrides: StateOverride[];
    stateChanges: StateChange[];
    domainAndMessageHashes?: ExpectedHashes;
  };
  stateDiffOutput?: string;
}

// ------------------------------- UI Comparison Types -------------------------------
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

export interface ValidationItemsByStep {
  signing: SigningDataComparison[];
  overrides: OverrideComparison[];
  changes: StateChangeComparison[];
}

// ------------------------------------------ Shared Types ------------------------------------------
export enum NetworkType {
  Sepolia = 'sepolia',
  Mainnet = 'mainnet',
}

export enum TaskStatus {
  Executed = 'EXECUTED',
  ReadyToSign = 'READY TO SIGN',
  Pending = 'PENDING',
}
