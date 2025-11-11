import type { ZodError } from 'zod';

import type { TaskConfig } from './validation-config';

export type ParseResult =
  | {
      success: true;
      zodError?: never;
    }
  | {
      success: false;
      zodError: ZodError;
    };

export interface ParsedConfig {
  config: TaskConfig;
  result: ParseResult;
}
