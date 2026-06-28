import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import {
  getUpgradeOptions,
  normalizeUrl,
  resetContractDeploymentsRootCacheForTests,
} from '../deployments';
import { NetworkType, TaskStatus } from '../types';

let originalCwd: string;
let tempDir: string;

beforeEach(async () => {
  originalCwd = process.cwd();
  resetContractDeploymentsRootCacheForTests();
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deployments-'));
});

afterEach(async () => {
  process.chdir(originalCwd);
  resetContractDeploymentsRootCacheForTests();
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe('normalizeUrl', () => {
  describe('valid URLs', () => {
    it('accepts valid https URL', () => {
      const url = 'https://etherscan.io/tx/0x123';
      expect(normalizeUrl(url)).toBe(url);
    });

    it('accepts valid http URL', () => {
      const url = 'http://example.com/path';
      expect(normalizeUrl(url)).toBe(url);
    });

    it('trims whitespace from valid URL', () => {
      expect(normalizeUrl('  https://example.com  ')).toBe('https://example.com');
    });

    it('strips trailing punctuation from valid URL', () => {
      expect(normalizeUrl('https://example.com/path).')).toBe('https://example.com/path');
      expect(normalizeUrl('https://example.com/path],')).toBe('https://example.com/path');
      expect(normalizeUrl('https://example.com/path...')).toBe('https://example.com/path');
    });
  });

  describe('malformed URLs', () => {
    it('rejects empty string', () => {
      expect(normalizeUrl('')).toBeUndefined();
    });

    it('rejects bare http string', () => {
      expect(normalizeUrl('http')).toBeUndefined();
    });

    it('rejects http without proper URL structure', () => {
      expect(normalizeUrl('http://')).toBeUndefined();
    });

    it('rejects httpxyz fake protocol', () => {
      expect(normalizeUrl('httpxyz://not-valid')).toBeUndefined();
    });

    it('rejects http:not-a-url format', () => {
      expect(normalizeUrl('http:not-a-url')).toBeUndefined();
    });

    it('rejects random text', () => {
      expect(normalizeUrl('not a url at all')).toBeUndefined();
    });

    it('rejects ftp protocol', () => {
      expect(normalizeUrl('ftp://files.example.com')).toBeUndefined();
    });

    it('rejects javascript protocol', () => {
      expect(normalizeUrl('javascript:alert(1)')).toBeUndefined();
    });

    it('rejects file protocol', () => {
      expect(normalizeUrl('file:///etc/passwd')).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('handles URL with query parameters', () => {
      const url = 'https://example.com/path?foo=bar&baz=qux';
      expect(normalizeUrl(url)).toBe(url);
    });

    it('handles URL with fragment', () => {
      const url = 'https://example.com/path#section';
      expect(normalizeUrl(url)).toBe(url);
    });

    it('handles URL with port', () => {
      const url = 'https://example.com:8080/path';
      expect(normalizeUrl(url)).toBe(url);
    });

    it('handles URL with authentication', () => {
      const url = 'https://user:pass@example.com/path';
      expect(normalizeUrl(url)).toBe(url);
    });
  });
});

describe('getUpgradeOptions', () => {
  it('discovers active task folders without root-level network folders', async () => {
    const toolDir = path.join(tempDir, 'task-signing-tool');
    const taskPath = path.join(tempDir, 'active', 'evm', 'tasks', '2026-06-19-upgrade');
    await fs.mkdir(path.join(taskPath, 'config', 'mainnet', 'validations'), { recursive: true });
    await fs.mkdir(toolDir, { recursive: true });
    await fs.writeFile(
      path.join(taskPath, 'README.md'),
      [
        '# 2026-06-19 Verifier Hash Update',
        '',
        'Status: READY TO SIGN',
        '',
        '## Description',
        '',
        'Update verifier hashes for mainnet.',
      ].join('\n')
    );
    process.chdir(toolDir);

    const upgrades = getUpgradeOptions(NetworkType.Mainnet);

    expect(upgrades).toEqual([
      expect.objectContaining({
        id: '2026-06-19-upgrade',
        name: '2026-06-19 Verifier Hash Update',
        date: '2026-06-19',
        network: NetworkType.Mainnet,
        status: TaskStatus.ReadyToSign,
        description: 'Update verifier hashes for mainnet.',
      }),
    ]);
  });

  it('returns all active task folders that have validations for the selected network', async () => {
    const toolDir = path.join(tempDir, 'task-signing-tool');
    await fs.mkdir(
      path.join(
        tempDir,
        'active',
        'evm',
        'tasks',
        '2026-06-18-beryl-1',
        'config',
        'mainnet',
        'validations'
      ),
      { recursive: true }
    );
    await fs.mkdir(
      path.join(
        tempDir,
        'active',
        'evm',
        'tasks',
        '2026-06-18-beryl-2',
        'config',
        'mainnet',
        'validations'
      ),
      { recursive: true }
    );
    await fs.mkdir(
      path.join(
        tempDir,
        'active',
        'evm',
        'tasks',
        '2026-06-18-beryl-2',
        'config',
        'zeronet',
        'validations'
      ),
      { recursive: true }
    );
    await fs.mkdir(toolDir, { recursive: true });
    process.chdir(toolDir);

    const upgrades = getUpgradeOptions(NetworkType.Mainnet);

    expect(upgrades.map(upgrade => upgrade.id)).toEqual([
      '2026-06-18-beryl-2',
      '2026-06-18-beryl-1',
    ]);
  });

  it('does not discover old root-level network tasks', async () => {
    const toolDir = path.join(tempDir, 'task-signing-tool');
    await fs.mkdir(path.join(tempDir, 'mainnet', '2026-06-19-upgrade', 'validations'), {
      recursive: true,
    });
    await fs.mkdir(toolDir, { recursive: true });
    await fs.writeFile(
      path.join(tempDir, 'mainnet', '2026-06-19-upgrade', 'README.md'),
      ['# Upgrade', '', 'Status: READY TO SIGN', '', '## Description', '', 'Legacy task.'].join(
        '\n'
      )
    );
    process.chdir(toolDir);

    const upgrades = getUpgradeOptions(NetworkType.Mainnet);

    expect(upgrades).toEqual([]);
  });
});
