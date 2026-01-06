/**
 * Test suite for parser utility functions
 */

import { parseConfig, parseFromString, getValidationSummary } from '../lib/parser';

describe('Parser Utilities', () => {
  const validConfig = {
    taskName: 'test-task',
    scriptName: 'simulate',
    signature: 'run()',
    sender: '0x9855054731540A48b28990B63DcF4f33d8AE46A1',
    args: '',
    ledgerId: 0,
    rpcUrl: 'https://mainnet.example.com',
    cmd: 'forge script Test --sig "run()"',
    expectedDomainAndMessageHashes: {
      address: '0x9C4a57Feb77e294Fd7BF5EBE9AB01CAA0a90A110',
      domainHash: '0x88aac3dc27cc1618ec43a87b3df21482acd24d172027ba3fbb5a5e625d895a0b',
      messageHash: '0x9ef8cce91c002602265fd0d330b1295dc002966e87cd9dc90e2a76efef2517dc',
    },
    stateOverrides: [],
    stateChanges: [],
  };

  describe('parseConfig', () => {
    it('should parse valid config successfully', () => {
      const result = parseConfig(validConfig);
      expect(result.result.success).toBe(true);
      expect(result).toHaveProperty('config');
    });

    it('should fail for missing required fields', () => {
      const invalidConfig = {
        taskName: 'test-task',
        // Missing other required fields
      };
      const result = parseConfig(invalidConfig);
      expect(result.result.success).toBe(false);
    });

    it('should fail for invalid sender address', () => {
      const invalidConfig = {
        ...validConfig,
        sender: 'not-an-address',
      };
      const result = parseConfig(invalidConfig);
      expect(result.result.success).toBe(false);
    });

    it('should fail for invalid rpcUrl', () => {
      const invalidConfig = {
        ...validConfig,
        rpcUrl: 'not-a-url',
      };
      const result = parseConfig(invalidConfig);
      expect(result.result.success).toBe(false);
    });

    it('should fail for negative ledgerId', () => {
      const invalidConfig = {
        ...validConfig,
        ledgerId: -1,
      };
      const result = parseConfig(invalidConfig);
      expect(result.result.success).toBe(false);
    });
  });

  describe('parseFromString', () => {
    it('should parse valid JSON string', () => {
      const jsonString = JSON.stringify(validConfig);
      const result = parseFromString(jsonString);
      expect(result.result.success).toBe(true);
    });

    it('should fail for invalid JSON', () => {
      const result = parseFromString('{ invalid json }');
      expect(result.result.success).toBe(false);
    });

    it('should fail for empty string', () => {
      const result = parseFromString('');
      expect(result.result.success).toBe(false);
    });

    it('should fail for non-object JSON', () => {
      const result = parseFromString('"just a string"');
      expect(result.result.success).toBe(false);
    });
  });

  describe('getValidationSummary', () => {
    it('should return success message for valid result', () => {
      const result = { success: true as const };
      const summary = getValidationSummary(result);
      expect(summary).toContain('✅');
      expect(summary).toContain('valid');
    });

    it('should return error details for invalid result', () => {
      const { z } = require('zod');
      const zodError = new z.ZodError([
        {
          code: 'custom',
          path: ['taskName'],
          message: 'Required field missing',
        },
      ]);
      const result = { success: false as const, zodError };
      const summary = getValidationSummary(result);
      expect(summary).toContain('❌');
      expect(summary).toContain('errors');
    });
  });
});
