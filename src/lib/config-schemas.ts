import { z } from 'zod';

export const AddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');

export const HashSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid hash format');

export const ExpectedHashesSchema = z.object({
  address: AddressSchema,
  domainHash: HashSchema,
  messageHash: HashSchema,
});

export const OverrideSchema = z.object({
  key: HashSchema,
  value: HashSchema,
  description: z.string(),
  allowDifference: z.boolean().optional(),
});

export const StateOverrideSchema = z.object({
  name: z.string().min(1),
  address: AddressSchema,
  overrides: z.array(OverrideSchema),
});

export const ChangeSchema = z.object({
  key: HashSchema,
  before: HashSchema,
  after: HashSchema,
  description: z.string(),
  allowDifference: z.boolean(),
});

export const StateChangeSchema = z.object({
  name: z.string().min(1),
  address: AddressSchema,
  changes: z.array(ChangeSchema),
});

export const BalanceChangeSchema = z.object({
  name: z.string().min(1),
  address: AddressSchema,
  field: z.string().min(1),
  before: HashSchema,
  after: HashSchema,
  description: z.string(),
  allowDifference: z.boolean(),
});

// Only taskCreator needs a config for the commonName parameter
// All other fields are hardcoded including the signature file names
export const TaskOriginValidationConfigSchema = z.object({
  taskCreator: z.object({
    commonName: z.string().min(1),
  }),
});

export const TaskConfigSchema = z.object({
  cmd: z.string(),
  ledgerId: z.number().int().nonnegative(),
  rpcUrl: z.string().url().min(1),
  expectedDomainAndMessageHashes: ExpectedHashesSchema,
  stateOverrides: z.array(StateOverrideSchema),
  stateChanges: z.array(StateChangeSchema),
  balanceChanges: z.array(BalanceChangeSchema).optional(),
  // Task origin validation (opt-in, per-task configuration)
  validateTaskOrigin: z.boolean().optional(),
  taskOriginConfig: TaskOriginValidationConfigSchema.optional(),
});
