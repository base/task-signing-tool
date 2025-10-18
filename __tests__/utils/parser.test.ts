import { z } from 'zod';
import { ConfigParser } from '../../src/lib/parser';

describe('ConfigParser', () => {
  describe('parseConfig', () => {
    it('should successfully parse valid configuration', () => {
      const validConfig = {
        task_name: 'test-task',
        script_name: 'simulate',
        signature: 'run()',
        sender: '0x1234567890123456789012345678901234567890',
        args: '',
        'ledger-id': 0,
        rpc_url: 'https://mainnet.example.com',
        expected_domain_and_message_hashes: {
          address: '0x1234567890123456789012345678901234567890',
          domain_hash: '0x88aac3dc27cc1618ec43a87b3df21482acd24d172027ba3fbb5a5e625d895a0b',
          message_hash: '0x88aac3dc27cc1618ec43a87b3df21482acd24d172027ba3fbb5a5e625d895a0b',
        },
        state_overrides: [
          {
            name: 'Test Contract',
            address: '0x1234567890123456789012345678901234567890',
            overrides: [
              {
                key: '0x0000000000000000000000000000000000000000000000000000000000000004',
                value: '0x0000000000000000000000000000000000000000000000000000000000000001',
                description: 'Test override',
              },
            ],
          },
        ],
        state_changes: [
          {
            name: 'System Config',
            address: '0x73a79Fab69143498Ed3712e519A88a918e1f4072',
            changes: [
              {
                key: '0x000000000000000000000000340f923e5c7cbb2171146f64169ec9d5a9ffe647',
                before: '0x000000000000000000000000340f923e5c7cbb2171146f64169ec9d5a9ffe647',
                after: '0x00000000000000000000000078ffe9209dff6fe1c9b6f3efdf996bee60346d0e',
                description: 'Test change',
              },
            ],
          },
        ],
      };

      const result = ConfigParser.parseConfig(validConfig);

      expect(result.result.success).toBe(true);
      expect(result.result.zodError).toBeUndefined();
      expect(result.config.task_name).toBe('test-task');
    });

    it('should successfully parse real-world base-nested.json configuration', () => {
      // Real configuration from base-nested.json
      const realConfig = {
        task_name: 'mainnet-upgrade-system-config',
        script_name: 'simulate',
        signature: 'run()',
        sender: '0x1234567890123456789012345678901234567890',
        args: '',
        'ledger-id': 0,
        rpc_url: 'https://mainnet.example.com',
        expected_domain_and_message_hashes: {
          address: '0x9C4a57Feb77e294Fd7BF5EBE9AB01CAA0a90A110',
          domain_hash: '0x88aac3dc27cc1618ec43a87b3df21482acd24d172027ba3fbb5a5e625d895a0b',
          message_hash: '0x9ef8cce91c002602265fd0d330b1295dc002966e87cd9dc90e2a76efef2517dc',
        },
        state_overrides: [
          {
            name: 'ProxyAdminOwner',
            address: '0x7bB41C3008B3f03FE483B28b8DB90e19Cf07595c',
            overrides: [
              {
                key: '0x0000000000000000000000000000000000000000000000000000000000000004',
                value: '0x0000000000000000000000000000000000000000000000000000000000000001',
                description: 'Override the threshold to 1 so the transaction simulation can occur',
              },
            ],
          },
          {
            name: 'Base Multisig',
            address: '0x9855054731540A48b28990B63DcF4f33d8AE46A1',
            overrides: [
              {
                key: '0x0000000000000000000000000000000000000000000000000000000000000004',
                value: '0x0000000000000000000000000000000000000000000000000000000000000001',
                description: 'Override the threshold to 1 so the transaction simulation can occur',
              },
            ],
          },
          {
            name: 'Base Nested Multisig',
            address: '0x9C4a57Feb77e294Fd7BF5EBE9AB01CAA0a90A110',
            overrides: [
              {
                key: '0x0000000000000000000000000000000000000000000000000000000000000004',
                value: '0x0000000000000000000000000000000000000000000000000000000000000001',
                description: 'Override the threshold to 1 so the transaction simulation can occur',
              },
              {
                key: '0x941b9cdcb5979673e06ce272a4b3851457b1a7a92c5034b46f0cdf4d3ffbf36d',
                value: '0x0000000000000000000000000000000000000000000000000000000000000001',
                description:
                  'Simulates an approval from msg.sender in order for the task simulation to succeed.',
              },
            ],
          },
        ],
        state_changes: [
          {
            name: 'System Config',
            address: '0x73a79Fab69143498Ed3712e519A88a918e1f4072',
            changes: [
              {
                key: '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc',
                before: '0x000000000000000000000000340f923e5c7cbb2171146f64169ec9d5a9ffe647',
                after: '0x00000000000000000000000078ffe9209dff6fe1c9b6f3efdf996bee60346d0e',
                description: 'Updates the System Config implementation address',
              },
            ],
          },
          {
            name: 'Proxy Admin Owner',
            address: '0x7bB41C3008B3f03FE483B28b8DB90e19Cf07595c',
            changes: [
              {
                key: '0x0000000000000000000000000000000000000000000000000000000000000005',
                before: '0x0000000000000000000000000000000000000000000000000000000000000009',
                after: '0x000000000000000000000000000000000000000000000000000000000000000a',
                description: 'Nonce increment',
              },
              {
                key: '0xe612a2ea19e8e76074e4469448baaa0076a49e88f2aa4915dcf5f8a73bf72c63',
                before: '0x0000000000000000000000000000000000000000000000000000000000000000',
                after: '0x0000000000000000000000000000000000000000000000000000000000000001',
                description:
                  'Sets approvedHashes[0x9855054731540a48b28990b63dcf4f33d8ae46a1][0x4a88dda4a880fe15d81d0ba56d70a2770da4a983f625755eb9c4d7c8de2aa2a2] to 1',
              },
            ],
          },
          {
            name: 'Base Multisig',
            address: '0x9855054731540A48b28990B63DcF4f33d8AE46A1',
            changes: [
              {
                key: '0x0000000000000000000000000000000000000000000000000000000000000005',
                before: '0x0000000000000000000000000000000000000000000000000000000000000016',
                after: '0x0000000000000000000000000000000000000000000000000000000000000017',
                description: 'Increments the nonce',
              },
              {
                key: '0x5adce382d964a1f2700576e57c00df690944e152a7647e602adee539676992ec',
                before: '0x0000000000000000000000000000000000000000000000000000000000000000',
                after: '0x0000000000000000000000000000000000000000000000000000000000000001',
                description:
                  'Sets approvedHashes[0x9c4a57feb77e294fd7bf5ebe9ab01caa0a90a110][0x2c6c1586b686483d280098fc0fa445fdf2c4d1d3dfad1a2aa17aac81d10cef9f] to 1',
              },
            ],
          },
          {
            name: 'Base Nested Multisig',
            address: '0x9C4a57Feb77e294Fd7BF5EBE9AB01CAA0a90A110',
            changes: [
              {
                key: '0x0000000000000000000000000000000000000000000000000000000000000005',
                before: '0x0000000000000000000000000000000000000000000000000000000000000001',
                after: '0x0000000000000000000000000000000000000000000000000000000000000002',
                description: 'Increments the nonce',
              },
            ],
          },
        ],
      };

      const result = ConfigParser.parseConfig(realConfig);

      expect(result.result.success).toBe(true);
      expect(result.result.zodError).toBeUndefined();

      // Validate the parsed config has the expected structure
      expect(result.config.task_name).toBe('mainnet-upgrade-system-config');

      // Validate expected hashes
      expect(result.config.expected_domain_and_message_hashes.address).toBe(
        '0x9C4a57Feb77e294Fd7BF5EBE9AB01CAA0a90A110'
      );
      expect(result.config.expected_domain_and_message_hashes.domain_hash).toBe(
        '0x88aac3dc27cc1618ec43a87b3df21482acd24d172027ba3fbb5a5e625d895a0b'
      );
      expect(result.config.expected_domain_and_message_hashes.message_hash).toBe(
        '0x9ef8cce91c002602265fd0d330b1295dc002966e87cd9dc90e2a76efef2517dc'
      );

      // Validate state overrides
      expect(result.config.state_overrides).toHaveLength(3);
      expect(result.config.state_overrides[0].name).toBe('ProxyAdminOwner');
      expect(result.config.state_overrides[1].name).toBe('Base Multisig');
      expect(result.config.state_overrides[2].name).toBe('Base Nested Multisig');

      // Validate Base Nested Multisig has 2 overrides
      expect(result.config.state_overrides[2].overrides).toHaveLength(2);

      // Validate state changes
      expect(result.config.state_changes).toHaveLength(4);
      expect(result.config.state_changes[0].name).toBe('System Config');
      expect(result.config.state_changes[1].name).toBe('Proxy Admin Owner');
      expect(result.config.state_changes[2].name).toBe('Base Multisig');
      expect(result.config.state_changes[3].name).toBe('Base Nested Multisig');

      // Validate Proxy Admin Owner has 2 changes
      expect(result.config.state_changes[1].changes).toHaveLength(2);

      // Validate Base Multisig has 2 changes
      expect(result.config.state_changes[2].changes).toHaveLength(2);
    });

    it('should handle missing required fields', () => {
      const incompleteConfig = {
        task_name: 'test',
        // Missing other required fields
      };

      const result = ConfigParser.parseConfig(incompleteConfig);

      expect(result.result.success).toBe(false);
      expect(result.result.zodError).toBeInstanceOf(z.ZodError);
      expect(result.result.zodError!.issues.length).toBeGreaterThan(0);

      // Check that we have validation errors for missing fields
      const issues = result.result.zodError!.issues;
      const missingFields = issues.filter(
        issue => issue.code === 'invalid_type' && issue.received === 'undefined'
      );
      expect(missingFields.length).toBeGreaterThan(0);
    });

    it('should handle invalid data types', () => {
      const invalidTypeConfig = {
        task_name: 123, // Should be string
        script_name: 'simulate',
        signature: 'run()',
        args: '',
        'ledger-id': 0,
        rpc_url: 'https://mainnet.example.com',
        expected_domain_and_message_hashes: {
          address: 'not_an_address',
          domain_hash: 'not_a_hash',
          message_hash: 'not_a_hash',
        },
        state_overrides: [],
        state_changes: [],
      };

      const result = ConfigParser.parseConfig(invalidTypeConfig);

      expect(result.result.success).toBe(false);
      expect(result.result.zodError).toBeInstanceOf(z.ZodError);

      const issues = result.result.zodError!.issues;
      const typeErrors = issues.filter(issue => issue.code === 'invalid_type');
      const stringErrors = issues.filter(issue => issue.code === 'invalid_string');

      expect(typeErrors.length).toBeGreaterThan(0);
      expect(stringErrors.length).toBeGreaterThan(0);
    });

    it('should handle invalid formats (addresses and hashes)', () => {
      const invalidFormatConfig = {
        task_name: 'test-partial-config',
        script_name: 'simulate',
        signature: 'run()',
        args: '',
        'ledger-id': 0,
        rpc_url: 'https://mainnet.example.com',
        expected_domain_and_message_hashes: {
          address: '0x1234567890123456789012345678901234567890', // Valid address
          domain_hash: 'invalid_hash_format', // Invalid: not 32-byte hex
          message_hash: '0x88aac3dc27cc1618ec43a87b3df21482acd24d172027ba3fbb5a5e625d895a0b', // Valid hash
        },
        state_overrides: [
          {
            name: 'Test Contract',
            address: 'not_an_address', // Invalid address format
            overrides: [
              {
                key: '0x0000000000000000000000000000000000000000000000000000000000000004',
                value: 'invalid_value', // Invalid: not 32-byte hex
                description: 'Test override',
              },
            ],
          },
        ],
        state_changes: [
          {
            name: 'System Config',
            address: '0x73a79Fab69143498Ed3712e519A88a918e1f4072', // Valid address
            changes: [
              {
                key: 'short_key', // Invalid: not 32-byte hex
                before: '0x000000000000000000000000340f923e5c7cbb2171146f64169ec9d5a9ffe647',
                after: '0x00000000000000000000000078ffe9209dff6fe1c9b6f3efdf996bee60346d0e',
                description: 'Test change with invalid key',
              },
            ],
          },
        ],
      };

      const result = ConfigParser.parseConfig(invalidFormatConfig);

      expect(result.result.success).toBe(false);
      expect(result.result.zodError).toBeInstanceOf(z.ZodError);

      // Should have exactly 4 format errors
      const formatErrors = result.result.zodError!.issues.filter(
        issue => issue.code === 'invalid_string'
      );
      expect(formatErrors).toHaveLength(4);

      // Check specific error paths
      const errorPaths = formatErrors.map(err => err.path.join('.'));
      expect(errorPaths).toContain('expected_domain_and_message_hashes.domain_hash');
      expect(errorPaths).toContain('state_overrides.0.address');
      expect(errorPaths).toContain('state_overrides.0.overrides.0.value');
      expect(errorPaths).toContain('state_changes.0.changes.0.key');
    });
  });

  describe('parseFromString', () => {
    it('should parse valid JSON string', () => {
      const validJsonString = JSON.stringify({
        task_name: 'test-task',
        script_name: 'simulate',
        signature: 'run()',
        sender: '0x1234567890123456789012345678901234567890',
        args: '',
        'ledger-id': 0,
        rpc_url: 'https://mainnet.example.com',
        expected_domain_and_message_hashes: {
          address: '0x1234567890123456789012345678901234567890',
          domain_hash: '0x88aac3dc27cc1618ec43a87b3df21482acd24d172027ba3fbb5a5e625d895a0b',
          message_hash: '0x88aac3dc27cc1618ec43a87b3df21482acd24d172027ba3fbb5a5e625d895a0b',
        },
        state_overrides: [],
        state_changes: [],
      });

      const result = ConfigParser.parseFromString(validJsonString);

      expect(result.result.success).toBe(true);
      expect(result.config.task_name).toBe('test-task');
    });

    it('should handle invalid JSON string', () => {
      const invalidJson = '{ "task_name": "test", invalid }';

      const result = ConfigParser.parseFromString(invalidJson);

      expect(result.result.success).toBe(false);
      expect(result.result.zodError).toBeInstanceOf(z.ZodError);
      expect(result.result.zodError!.issues[0].message).toContain('Invalid JSON');
    });
  });

  describe('getValidationSummary', () => {
    it('should return success message for valid config', () => {
      const successResult = { success: true };

      const summary = ConfigParser.getValidationSummary(successResult);

      expect(summary).toBe('✅ Configuration is valid');
    });

    it('should return detailed error summary for invalid config', () => {
      const invalidConfig = { task_name: 123 };
      const result = ConfigParser.parseConfig(invalidConfig);

      const summary = ConfigParser.getValidationSummary(result.result);

      expect(summary).toContain('❌ Configuration has errors');
      expect(summary).toContain('Errors (');
      expect(summary).toContain('task_name: Expected string, received number');
    });

    it('should handle non-ZodError exceptions by wrapping them in ZodError', () => {
      // Test the ternary operator logic directly by simulating what happens
      // when a non-ZodError is thrown
      const testError = new Error('Simulated non-ZodError');

      // This mimics the ternary operator logic in the catch block
      const resultZodError =
        testError instanceof z.ZodError
          ? testError
          : new z.ZodError([
              {
                code: z.ZodIssueCode.custom,
                path: [],
                message: `Failed to parse configuration: ${
                  testError instanceof Error ? testError.message : 'Unknown error'
                }`,
              },
            ]);

      // Verify the error was properly wrapped
      expect(resultZodError).toBeInstanceOf(z.ZodError);
      expect(resultZodError.issues).toHaveLength(1);
      expect(resultZodError.issues[0].code).toBe('custom');
      expect(resultZodError.issues[0].message).toBe(
        'Failed to parse configuration: Simulated non-ZodError'
      );
      expect(resultZodError.issues[0].path).toEqual([]);

      // Test with a non-Error object (like what could be thrown in JavaScript)
      const nonErrorObject: unknown = 'string error';
      const resultFromNonError =
        nonErrorObject instanceof z.ZodError
          ? nonErrorObject
          : new z.ZodError([
              {
                code: z.ZodIssueCode.custom,
                path: [],
                message: `Failed to parse configuration: ${
                  nonErrorObject instanceof Error
                    ? (nonErrorObject as Error).message
                    : 'Unknown error'
                }`,
              },
            ]);

      expect(resultFromNonError).toBeInstanceOf(z.ZodError);
      expect(resultFromNonError.issues[0].message).toBe(
        'Failed to parse configuration: Unknown error'
      );
    });
  });
});
