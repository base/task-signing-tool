import type { ZodError } from 'zod';

import type { TaskConfig } from './validation-config';

type ParseSuccess = {
  config: TaskConfig;
  result: {
    success: true;
    zodError?: never;
  };
};

type ParseFailure = {
  result: {
    success: false;
    zodError: ZodError;
  };
};

export type ParsedConfig = ParseSuccess | ParseFailure;
export type ParseResult = ParsedConfig['result'];
