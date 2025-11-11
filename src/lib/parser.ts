import { z } from 'zod';
import { TaskConfigSchema } from './config-schemas';
import { ParsedConfig, ParseResult } from './types/index';

export function parseConfig(jsonData: unknown): ParsedConfig {
  const parsed = TaskConfigSchema.safeParse(jsonData);

  if (parsed.success) {
    return {
      config: parsed.data,
      result: {
        success: true,
      },
    };
  }

  return {
    result: {
      success: false,
      zodError: parsed.error,
    },
  };
}

export function parseFromString(jsonString: string): ParsedConfig {
  try {
    return parseConfig(JSON.parse(jsonString));
  } catch (error) {
    return {
      result: {
        success: false,
        zodError: createJsonParseError(error),
      },
    };
  }
}

export function getValidationSummary(result: ParseResult): string {
  if (result.success) {
    return '✅ Configuration is valid';
  }

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
