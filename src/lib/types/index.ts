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

// ------------------------------- Script Runner Output -------------------------------
export interface SimulationLink {
  url: string;
  network: string;
  contractAddress: string;
  from: string;
  stateOverrides?: string;
  rawFunctionInput?: string;
}

export interface NestedHash {
  safeAddress: string;
  hash: string;
}

export interface ApprovalHash {
  safeAddress: string;
  hash: string;
}

export interface SigningData {
  dataToSign: string;
}

export interface ExtractedData {
  nestedHashes: NestedHash[];
  simulationLink?: SimulationLink;
  approvalHash?: ApprovalHash;
  signingData?: SigningData;
}

export interface ScriptRunnerOptions {
  scriptPath: string;
  rpcUrl: string;
  scriptName: string;
  signature?: string;
  args?: string[];
  sender?: string;
  saveOutput?: string; // Optional: save raw output to file
  extractOnly?: boolean; // Extract from existing file
}

// ------------------------------- Diff Comparison Types -------------------------------
export type DiffType = 'added' | 'removed' | 'modified' | 'unchanged';

export interface StringDiff {
  type: DiffType;
  value: string;
  startIndex?: number;
  endIndex?: number;
}

export interface FieldDiff {
  field: string;
  path: string; // e.g., "name", "overrides[0].key", "changes[1].description"
  expected: string;
  actual: string;
  diffs: StringDiff[]; // Character-level or word-level diffs
  type: DiffType;
}

export interface ObjectDiff {
  type: 'StateOverride' | 'StateChange' | 'Override' | 'Change';
  index?: number;
  fieldDiffs: FieldDiff[];
  status: 'match' | 'mismatch' | 'added' | 'removed';
}

export interface ComparisonResult {
  // Human-readable summary
  summary: string;
  status: 'match' | 'mismatch';

  // Structured diff data for frontend highlighting
  diffs: ObjectDiff[];

  // Statistics
  stats: {
    totalFields: number;
    matchingFields: number;
    mismatchedFields: number;
    addedFields: number;
    removedFields: number;
  };
}

// ------------------------------- State Diff Types -------------------------------
export interface StateDiffOptions {
  rpcUrl: string;
  workdir: string;
  sender: string;
  scriptArgs?: string[];
  prefix?: string;
  suffix?: string;
}

export interface ExtractedStateDiffOptions {
  rpcUrl: string;
  extractedData: ExtractedData;
}

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
  };
  extractedData?: ExtractedData;
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
