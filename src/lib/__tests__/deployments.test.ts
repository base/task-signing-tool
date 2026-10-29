import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { getUpgradeOptions, resetContractDeploymentsRootCacheForTests } from '../deployments';
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

  it('returns executed status for a task with an executed README status', async () => {
    await makeTask('2025-06-04-upgrade-foo', 'mainnet', 'Status: EXECUTED');

    const upgrades = getUpgradeOptions(NetworkType.Mainnet);

    expect(upgrades).toEqual([expect.objectContaining({ status: TaskStatus.Executed })]);
  });

  it('omits status when the README has no status line', async () => {
    await makeTask('2025-06-04-upgrade-foo', 'mainnet', '# Upgrade Foo');

    const upgrades = getUpgradeOptions(NetworkType.Mainnet);

    expect(upgrades).toHaveLength(1);
    expect(JSON.parse(JSON.stringify(upgrades[0]))).not.toHaveProperty('status');
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
