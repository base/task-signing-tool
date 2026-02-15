import path from 'path';
import { fileURLToPath } from 'url';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  verifyTaskOrigin,
  verifyAllSignatures,
  FacilitatorType,
} from '../scripts/genTaskOriginSig';

// Fixture paths
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');
const VALID_TASK_FOLDER = path.join(FIXTURES_DIR, 'valid-task');
const VALID_SIGNATURES_DIR = path.join(FIXTURES_DIR, 'signatures/valid');
const INVALID_SIGNATURES_DIR = path.join(FIXTURES_DIR, 'signatures/invalid');
const MISSING_SIGNATURES_DIR = path.join(FIXTURES_DIR, 'signatures/missing');

// Task creator email
const TASK_CREATOR_EMAIL = 'alexis.williams.1@coinbase.com';
const WRONG_TASK_CREATOR_EMAIL = 'test@test.com';

describe('verifyTaskOrigin', () => {
  let originalExitCode: number | undefined;

  beforeEach(() => {
    originalExitCode = process.exitCode as number | undefined;
    process.exitCode = undefined;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.exitCode = originalExitCode;
    jest.restoreAllMocks();
  });

  describe('valid signatures', () => {
    it('validates a valid task creator signature', async () => {
      await verifyTaskOrigin(
        VALID_TASK_FOLDER,
        VALID_SIGNATURES_DIR,
        undefined, // no facilitator = task creator
        TASK_CREATOR_EMAIL
      );

      expect(process.exitCode).toBeUndefined();
    });

    it('validates a valid base facilitator signature', async () => {
      await verifyTaskOrigin(
        VALID_TASK_FOLDER,
        VALID_SIGNATURES_DIR,
        'base' as FacilitatorType,
        undefined // common name derived from facilitator type
      );

      expect(process.exitCode).toBeUndefined();
    });

    it('validates a valid security council facilitator signature', async () => {
      await verifyTaskOrigin(
        VALID_TASK_FOLDER,
        VALID_SIGNATURES_DIR,
        'security-council' as FacilitatorType,
        undefined // common name derived from facilitator type
      );

      expect(process.exitCode).toBeUndefined();
    });
  });

  describe('invalid signatures', () => {
    it('fails validation with an invalid task creator signature', async () => {
      await verifyTaskOrigin(
        VALID_TASK_FOLDER,
        INVALID_SIGNATURES_DIR,
        undefined,
        TASK_CREATOR_EMAIL
      );

      expect(process.exitCode).toBe(1);
    });

    it('fails validation with an invalid base facilitator signature', async () => {
      await verifyTaskOrigin(
        VALID_TASK_FOLDER,
        INVALID_SIGNATURES_DIR,
        'base' as FacilitatorType,
        undefined
      );

      expect(process.exitCode).toBe(1);
    });

    it('fails validation with an invalid security council facilitator signature', async () => {
      await verifyTaskOrigin(
        VALID_TASK_FOLDER,
        INVALID_SIGNATURES_DIR,
        'security-council' as FacilitatorType,
        undefined
      );

      expect(process.exitCode).toBe(1);
    });
  });

  describe('missing common name', () => {
    it('sets exitCode to 1 when common-name is missing for task creator', async () => {
      await verifyTaskOrigin(
        VALID_TASK_FOLDER,
        VALID_SIGNATURES_DIR,
        undefined, // no facilitator
        undefined // no common name
      );

      expect(process.exitCode).toBe(1);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('--common-name is required')
      );
    });
  });
});

describe('verifyAllSignatures', () => {
  let originalExitCode: number | undefined;

  beforeEach(() => {
    originalExitCode = process.exitCode as number | undefined;
    process.exitCode = undefined;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.exitCode = originalExitCode;
    jest.restoreAllMocks();
  });

  it('validates successfully when all 3 signatures are valid', async () => {
    await verifyAllSignatures(VALID_TASK_FOLDER, VALID_SIGNATURES_DIR, TASK_CREATOR_EMAIL);

    expect(process.exitCode).toBeUndefined();
  });

  it('fails validation when one or more signatures are missing', async () => {
    await verifyAllSignatures(VALID_TASK_FOLDER, MISSING_SIGNATURES_DIR, TASK_CREATOR_EMAIL);

    expect(process.exitCode).toBe(1);
  });

  it('fails validation when all signatures are invalid', async () => {
    await verifyAllSignatures(VALID_TASK_FOLDER, INVALID_SIGNATURES_DIR, TASK_CREATOR_EMAIL);

    expect(process.exitCode).toBe(1);
  });

  it('fails validation with wrong common name for task creator', async () => {
    await verifyAllSignatures(VALID_TASK_FOLDER, VALID_SIGNATURES_DIR, WRONG_TASK_CREATOR_EMAIL);

    expect(process.exitCode).toBe(1);
  });
});
