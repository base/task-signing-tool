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
  expected_nested_hash: string;
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

// ------------------------------- State Diff Types -------------------------------
export interface StateDiffResult {
  domain_hash: string;
  message_hash: string;
  target_safe: string;
  state_overrides: StateOverride[];
  state_changes: StateChange[];
}

// ------------------------------- Validation Data (Last Steps) Types -------------------------------
export interface ValidationData {
  expected: {
    stateOverrides: StateOverride[];
    stateChanges: StateChange[];
    domainAndMessageHashes?: {
      address: string;
      domain_hash: string;
      message_hash: string;
    };
  };
  actual: {
    stateOverrides: StateOverride[];
    stateChanges: StateChange[];
    domainAndMessageHashes?: {
      address: string;
      domain_hash: string;
      message_hash: string;
    };
  };
  stateDiffOutput?: string;
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
