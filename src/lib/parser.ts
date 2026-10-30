import { z } from 'zod';
import { TaskConfigSchema } from './config-schemas';
import type { TaskConfig } from './types/index';

type ParsingOutcome =
  | { success: true; config: TaskConfig }
  | { success: false; zodError: z.ZodError };

export function parseFromString(jsonString: string): ParsingOutcome {
  try {
    const parsed = TaskConfigSchema.safeParse(JSON.parse(jsonString));
    if (parsed.success) {
      return { success: true, config: parsed.data };
    }
    return { success: false, zodError: parsed.error };
  } catch (error) {
    return { success: false, zodError: createJsonParseError(error) };
  }
}

export function getValidationSummary(result: Extract<ParsingOutcome, { success: false }>): string {
  const parts: string[] = [
    '❌ Configuration has errors',
    `\nErrors (${result.zodError.issues.length}):`,
  ];

  result.zodError.issues.forEach(issue => {
    const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    parts.push(`  • ${path}${issue.message}`);
  });

  return parts.join('\n');
}

function createJsonParseError(error: unknown): z.ZodError {
  const message = error instanceof Error ? error.message : 'Unknown error';

  return new z.ZodError([
    {
      code: z.ZodIssueCode.custom,
      path: [],
      message: `Invalid JSON: ${message}`,
    },
  ]);
}
