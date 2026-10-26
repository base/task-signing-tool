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
  it.each([
    ['https://etherscan.io/tx/0x123', 'https://etherscan.io/tx/0x123'],
    ['http://example.com/path', 'http://example.com/path'],
    ['  https://example.com  ', 'https://example.com'],
    ['https://example.com/path).', 'https://example.com/path'],
    ['https://example.com/path],', 'https://example.com/path'],
    ['https://example.com/path...', 'https://example.com/path'],
    ['https://example.com/path?foo=bar&baz=qux', 'https://example.com/path?foo=bar&baz=qux'],
    ['https://example.com/path#section', 'https://example.com/path#section'],
    ['https://example.com:8080/path', 'https://example.com:8080/path'],
    ['https://user:pass@example.com/path', 'https://user:pass@example.com/path'],
  ])('normalizes %p to %p', (input, expected) => {
    expect(normalizeUrl(input)).toBe(expected);
  });

  it.each([
    '',
    'http',
    'http://',
    'httpxyz://not-valid',
    'http:not-a-url',
    'not a url at all',
    'ftp://files.example.com',
    'javascript:alert(1)',
    'file:///etc/passwd',
  ])('rejects %p', input => {
    expect(normalizeUrl(input)).toBeUndefined();
  });
});

describe('getUpgradeOptions', () => {
  async function makeTask(id: string, network: string, readme?: string) {
    const taskDir = path.join(tempDir, 'active', 'evm', 'tasks', id);
    await fs.mkdir(path.join(taskDir, 'config', network, 'validations'), { recursive: true });
    if (readme !== undefined) {
      await fs.writeFile(path.join(taskDir, 'README.md'), readme);
    }
    const toolDir = path.join(tempDir, 'task-signing-tool');
    await fs.mkdir(toolDir, { recursive: true });
    process.chdir(toolDir);
  }

  it('discovers active task folders without root-level network folders', async () => {
    await makeTask(
      '2025-06-04-upgrade-foo',
      'mainnet',
      [
        '# Upgrade Foo',
        '',
        'Status: READY TO SIGN',
        '',
        '## Description',
        '',
        'Example upgrade task.',
      ].join('\n')
    );

    const upgrades = getUpgradeOptions(NetworkType.Mainnet);

    expect(upgrades).toEqual([
      expect.objectContaining({
        id: '2025-06-04-upgrade-foo',
        name: 'Upgrade Foo',
        date: '2025-06-04',
        network: NetworkType.Mainnet,
        status: TaskStatus.ReadyToSign,
        description: 'Example upgrade task.',
      }),
    ]);
  });

  it('returns pending status for a task with a pending README status', async () => {
    await makeTask('2025-06-04-upgrade-foo', 'mainnet', 'Status: PENDING');

    const upgrades = getUpgradeOptions(NetworkType.Mainnet);

    expect(upgrades).toEqual([expect.objectContaining({ status: TaskStatus.Pending })]);
  });

  it('omits execution links from serialized executed tasks with no URLs', async () => {
    await makeTask('2025-06-04-upgrade-foo', 'mainnet', 'Status: EXECUTED');

    const upgrades = getUpgradeOptions(NetworkType.Mainnet);

    expect(upgrades).toEqual([expect.objectContaining({ status: TaskStatus.Executed })]);
    expect(JSON.parse(JSON.stringify(upgrades[0]))).not.toHaveProperty('executionLinks');
  });

  it('returns all active task folders that have validations for the selected network', async () => {
    await makeTask('2025-06-04-upgrade-foo', 'mainnet');
    await makeTask('2025-07-12-upgrade-bar', 'mainnet');
    await makeTask('2025-07-12-upgrade-bar', 'zeronet');

    const upgrades = getUpgradeOptions(NetworkType.Mainnet);

    expect(upgrades.map(upgrade => upgrade.id)).toEqual([
      '2025-07-12-upgrade-bar',
      '2025-06-04-upgrade-foo',
    ]);
  });

  it('does not discover old root-level network tasks', async () => {
    const toolDir = path.join(tempDir, 'task-signing-tool');
    await fs.mkdir(path.join(tempDir, 'mainnet', '2025-06-04-upgrade-foo', 'validations'), {
      recursive: true,
    });
    await fs.mkdir(toolDir, { recursive: true });
    await fs.writeFile(
      path.join(tempDir, 'mainnet', '2025-06-04-upgrade-foo', 'README.md'),
      ['# Upgrade', '', 'Status: READY TO SIGN', '', '## Description', '', 'Legacy task.'].join(
        '\n'
      )
    );
    process.chdir(toolDir);

    const upgrades = getUpgradeOptions(NetworkType.Mainnet);

    expect(upgrades).toEqual([]);
  });

  it('ignores non-date-prefixed directories such as templates or archives', async () => {
    await makeTask('template', 'mainnet');
    await makeTask('2025-06-04-upgrade-foo', 'mainnet');

    const upgrades = getUpgradeOptions(NetworkType.Mainnet);

    expect(upgrades.map(u => u.id)).toEqual(['2025-06-04-upgrade-foo']);
  });
});
