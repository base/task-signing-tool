import { z } from 'zod';
import {
  BalanceChangeSchema,
  ChangeSchema,
  ExpectedHashesSchema,
  OverrideSchema,
  StateChangeSchema,
  StateOverrideSchema,
  TaskConfigSchema,
  TaskOriginSignerSchema,
  TaskOriginValidationConfigSchema,
} from '@/lib/config-schemas';

export type ExpectedHashes = z.infer<typeof ExpectedHashesSchema>;
export type Override = z.infer<typeof OverrideSchema>;
export type StateOverride = z.infer<typeof StateOverrideSchema>;
export type Change = z.infer<typeof ChangeSchema>;
export type StateChange = z.infer<typeof StateChangeSchema>;
export type BalanceChange = z.infer<typeof BalanceChangeSchema>;
export type TaskConfig = z.infer<typeof TaskConfigSchema>;

// Task Origin Validation Types
export type TaskOriginSigner = z.infer<typeof TaskOriginSignerSchema>;
export type TaskOriginValidationConfig = z.infer<typeof TaskOriginValidationConfigSchema>;
