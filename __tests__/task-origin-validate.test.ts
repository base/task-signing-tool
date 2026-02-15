import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import fs from 'fs/promises';
import crypto from 'crypto';
import * as tar from 'tar';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  createDeterministicTarball,
  buildAndValidateSignature,
} from '../src/lib/task-origin-validate';
import type { TaskOriginRole } from '../src/lib/types';

// Fixture paths
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');
const VALID_TASK_FOLDER = path.join(FIXTURES_DIR, 'valid-task');
const MODIFIED_TASK_FOLDER = path.join(FIXTURES_DIR, 'modified-task');
const VALID_SIGNATURES_DIR = path.join(FIXTURES_DIR, 'signatures/valid');

// Task creator email
const TASK_CREATOR_EMAIL = 'alexis.williams.1@coinbase.com';
const WRONG_TASK_CREATOR_EMAIL = 'test@test.com';

async function computeFileHash(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(new Uint8Array(content)).digest('hex');
}

async function listTarEntries(tarballPath: string): Promise<string[]> {
  const entries: string[] = [];
  await tar.list({
    file: tarballPath,
    onReadEntry: entry => {
      entries.push(entry.path);
    },
  });
  return entries;
}

describe('createDeterministicTarball', () => {
  let tempDir: string;
  let createdTarballs: string[] = [];

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tarball-test-'));
    createdTarballs = [];
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });

    // Clean up any created tarballs
    for (const tarball of createdTarballs) {
      try {
        await fs.unlink(tarball);
      } catch {
        // Ignore errors if file doesn't exist
      }
    }

    jest.restoreAllMocks();
  });

  it('produces a valid tarball', async () => {
    // Create a simple file structure
    await fs.writeFile(path.join(tempDir, 'test.txt'), 'test content');

    const tarballPath = await createDeterministicTarball(tempDir);
    createdTarballs.push(tarballPath);

    // Verify tarball exists and has content
    const stats = await fs.stat(tarballPath);
    expect(stats.size).toBeGreaterThan(0);

    // Verify it's a valid tar by listing entries
    const entries = await listTarEntries(tarballPath);
    expect(entries).toContain('test.txt');
  });

  it('excludes cache/, out/, and signer-tool/ directories', async () => {
    // Create excluded directories with files
    await fs.mkdir(path.join(tempDir, 'cache'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'out'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'signer-tool'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'cache', 'cached.txt'), 'cached data');
    await fs.writeFile(path.join(tempDir, 'out', 'output.txt'), 'output data');
    await fs.writeFile(path.join(tempDir, 'signer-tool', 'tool.txt'), 'tool data');

    // Create an included file
    await fs.writeFile(path.join(tempDir, 'included.txt'), 'included data');

    const tarballPath = await createDeterministicTarball(tempDir);
    createdTarballs.push(tarballPath);

    const entries = await listTarEntries(tarballPath);

    // Verify included file is present
    expect(entries).toContain('included.txt');

    // Verify excluded directories' contents are not present
    expect(entries.some(e => e.includes('cache'))).toBe(false);
    expect(entries.some(e => e.includes('out'))).toBe(false);
    expect(entries.some(e => e.includes('signer-tool'))).toBe(false);
  });

  it('produces deterministic output with identical hash', async () => {
    // Create some files
    await fs.writeFile(path.join(tempDir, 'file1.txt'), 'content 1');
    await fs.writeFile(path.join(tempDir, 'file2.txt'), 'content 2');
    await fs.mkdir(path.join(tempDir, 'subdir'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'subdir', 'file3.txt'), 'content 3');

    // Create first tarball and compute hash
    const tarball1 = await createDeterministicTarball(tempDir);
    createdTarballs.push(tarball1);
    const hash1 = await computeFileHash(tarball1);

    // Delete the tarball
    await fs.unlink(tarball1);
    createdTarballs = createdTarballs.filter(t => t !== tarball1);

    // Create second tarball and compute hash
    const tarball2 = await createDeterministicTarball(tempDir);
    createdTarballs.push(tarball2);
    const hash2 = await computeFileHash(tarball2);

    // Hashes should be identical
    expect(hash1).toBe(hash2);
  });

  it('sorts files alphabetically in the tarball', async () => {
    // Create files and folders out of alphabetical order
    await fs.mkdir(path.join(tempDir, 'zebra'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'apple'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'zebra', 'file.txt'), 'zebra data');
    await fs.writeFile(path.join(tempDir, 'apple', 'file.txt'), 'apple data');
    await fs.writeFile(path.join(tempDir, 'middle.txt'), 'middle data');
    await fs.writeFile(path.join(tempDir, 'aaa.txt'), 'aaa data');
    await fs.writeFile(path.join(tempDir, 'zzz.txt'), 'zzz data');

    const tarballPath = await createDeterministicTarball(tempDir);
    createdTarballs.push(tarballPath);

    const entries = await listTarEntries(tarballPath);

    // Verify entries are in alphabetical order
    const sortedEntries = [...entries].sort();
    expect(entries).toEqual(sortedEntries);
  });

  it('includes nested directories', async () => {
    // Create nested structure
    await fs.mkdir(path.join(tempDir, 'level1', 'level2', 'level3'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'level1', 'l1.txt'), 'level 1');
    await fs.writeFile(path.join(tempDir, 'level1', 'level2', 'l2.txt'), 'level 2');
    await fs.writeFile(path.join(tempDir, 'level1', 'level2', 'level3', 'l3.txt'), 'level 3');

    const tarballPath = await createDeterministicTarball(tempDir);
    createdTarballs.push(tarballPath);

    const entries = await listTarEntries(tarballPath);

    expect(entries).toContain('level1/l1.txt');
    expect(entries).toContain('level1/level2/l2.txt');
    expect(entries).toContain('level1/level2/level3/l3.txt');
  });
});

describe('buildAndValidateSignature', () => {
  let createdTarballs: string[] = [];

  beforeEach(() => {
    createdTarballs = [];
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    // Clean up any created tarballs
    for (const tarball of createdTarballs) {
      try {
        await fs.unlink(tarball);
      } catch {
        // Ignore errors if file doesn't exist
      }
    }

    jest.restoreAllMocks();
  });

  // Helper to track tarballs created during tests
  const trackTarball = (taskFolder: string) => {
    const folderName = taskFolder.split('/').pop();
    const tarballPath = path.resolve(process.cwd(), `${folderName}.tar`);
    createdTarballs.push(tarballPath);
  };

  describe('valid signatures', () => {
    it('validates a valid signature with matching tarball', async () => {
      trackTarball(VALID_TASK_FOLDER);

      await expect(
        buildAndValidateSignature({
          taskFolderPath: VALID_TASK_FOLDER,
          signatureFile: path.join(VALID_SIGNATURES_DIR, 'creator-signature.json'),
          commonName: TASK_CREATOR_EMAIL,
          role: 'taskCreator' as TaskOriginRole,
        })
      ).resolves.not.toThrow();
    });
  });

  describe('tarball mismatch', () => {
    it('fails validation when signature does not match tarball content', async () => {
      trackTarball(MODIFIED_TASK_FOLDER);

      // Use valid signature but with modified task folder
      await expect(
        buildAndValidateSignature({
          taskFolderPath: MODIFIED_TASK_FOLDER,
          signatureFile: path.join(VALID_SIGNATURES_DIR, 'creator-signature.json'),
          commonName: TASK_CREATOR_EMAIL,
          role: 'taskCreator' as TaskOriginRole,
        })
      ).rejects.toThrow();
    });
  });

  describe('SAN mismatch', () => {
    it('fails validation with wrong email for task creator', async () => {
      trackTarball(VALID_TASK_FOLDER);

      await expect(
        buildAndValidateSignature({
          taskFolderPath: VALID_TASK_FOLDER,
          signatureFile: path.join(VALID_SIGNATURES_DIR, 'creator-signature.json'),
          commonName: WRONG_TASK_CREATOR_EMAIL,
          role: 'taskCreator' as TaskOriginRole,
        })
      ).rejects.toThrow();
    });

    it('fails validation when task creator signature is verified as facilitator role', async () => {
      trackTarball(VALID_TASK_FOLDER);

      // Try to verify a task creator signature with facilitator role
      // This should fail because SAN prefix is user:/// but we expect ldap:///
      await expect(
        buildAndValidateSignature({
          taskFolderPath: VALID_TASK_FOLDER,
          signatureFile: path.join(VALID_SIGNATURES_DIR, 'creator-signature.json'),
          commonName: TASK_CREATOR_EMAIL,
          role: 'baseFacilitator' as TaskOriginRole,
        })
      ).rejects.toThrow();
    });

    it('fails validation when facilitator signature is verified as task creator role', async () => {
      trackTarball(VALID_TASK_FOLDER);

      // Try to verify a facilitator signature with task creator role
      // This should fail because SAN prefix is ldap:/// but we expect user:///
      await expect(
        buildAndValidateSignature({
          taskFolderPath: VALID_TASK_FOLDER,
          signatureFile: path.join(VALID_SIGNATURES_DIR, 'base-facilitator-signature.json'),
          commonName: 'base-facilitators',
          role: 'taskCreator' as TaskOriginRole,
        })
      ).rejects.toThrow();
    });
  });
});
