import { z } from 'zod';
import { ParsedConfig, ParseResult, TaskConfig } from './types/index';

// Zod validation schemas
const AddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');
const HashSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid hash format');

const ExpectedHashesSchema = z.object({
  address: AddressSchema,
  domain_hash: HashSchema,
  message_hash: HashSchema,
});

const OverrideSchema = z.object({
  key: HashSchema,
  value: HashSchema,
  description: z.string(),
});

const StateOverrideSchema = z.object({
  name: z.string().min(1),
  address: AddressSchema,
  overrides: z.array(OverrideSchema),
});

const ChangeSchema = z.object({
  key: HashSchema,
  before: HashSchema,
  after: HashSchema,
  description: z.string(),
});

const StateChangeSchema = z.object({
  name: z.string().min(1),
  address: AddressSchema,
  changes: z.array(ChangeSchema),
});

const TaskConfigSchema = z.object({
  task_name: z.string().min(1),
  script_name: z.string().min(1),
  signature: z.string().regex(/^[xX0-9a-zA-Z\[\](),]+$/, 'Invalid signature format'),
  sender: z.string().regex(/^[xX0-9a-fA-F\[\](),]+$/, 'Invalid sender format'),
  args: z.string().regex(/^[xX0-9a-zA-Z\[\](),]*$/, 'Invalid args format'), // Allow empty string for scripts with no arguments
  'ledger-id': z.number().int().nonnegative(), // Required ledger account index
  rpc_url: z.string().url().min(1), // The actual RPC URL to use
  expected_domain_and_message_hashes: ExpectedHashesSchema,
  state_overrides: z.array(StateOverrideSchema),
  state_changes: z.array(StateChangeSchema),
});

export class ConfigParser {
  /**
   * Parse a JSON configuration file using Zod for validation
   *
   * @param jsonData - Raw JSON object containing multisig configuration
   * @returns ParsedConfig object with config and validation results
   */
  static parseConfig(jsonData: unknown): ParsedConfig {
    try {
      // Parse and validate using Zod
      const config = TaskConfigSchema.parse(jsonData);
      return {
        config,
        result: {
          success: true,
        },
      };
    } catch (error) {
      return {
        config: this.getDefaultConfig(),
        result: {
          success: false,
          zodError:
            error instanceof z.ZodError
              ? error
              : new z.ZodError([
                  {
                    code: z.ZodIssueCode.custom,
                    path: [],
                    message: `Failed to parse configuration: ${
                      error instanceof Error ? error.message : 'Unknown error'
                    }`,
                  },
                ]),
        },
      };
    }
  }

  /**
   * Parse JSON string and return parsed config
   */
  static parseFromString(jsonString: string): ParsedConfig {
    try {
      const jsonData = JSON.parse(jsonString);
      return this.parseConfig(jsonData);
    } catch (error) {
      // Create a ZodError for JSON parsing errors
      const jsonError = new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: [],
          message: `Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ]);

      return {
        config: this.getDefaultConfig(),
        result: {
          success: false,
          zodError: jsonError,
        },
      };
    }
  }

  /**
   * Helper method to get validation summary using ZodError
   */
  static getValidationSummary(result: ParseResult): string {
    if (result.success) {
      return '✅ Configuration is valid';
    }

    // We always have zodError when success is false
    const parts: string[] = ['❌ Configuration has errors'];

    parts.push(`\nErrors (${result.zodError!.issues.length}):`);
    result.zodError!.issues.forEach(issue => {
      const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
      parts.push(`  • ${path}${issue.message}`);
    });

    return parts.join('\n');
  }

  private static getDefaultConfig(): TaskConfig {
    return {
      task_name: '',
      script_name: '',
      signature: '',
      sender: '',
      args: '',
      'ledger-id': 0,
      rpc_url: 'https://eth-mainnet.public.blastapi.io',
      expected_domain_and_message_hashes: { address: '', domain_hash: '', message_hash: '' },
      state_overrides: [],
      state_changes: [],
    };
  }
}
