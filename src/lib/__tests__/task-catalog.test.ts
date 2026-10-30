import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import {
  createTaskCatalog,
  defaultTaskCatalog,
  resetContractDeploymentsRootCacheForTests,
  TaskCatalogError,
} from '../task-catalog';
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

it('discovers the default root from cwd and caches the catalog across cwd changes', async () => {
  const toolDir = path.join(tempDir, 'tools', 'signing');
  await fs.mkdir(path.join(tempDir, 'active', 'evm', 'tasks'), { recursive: true });
  await fs.mkdir(toolDir, { recursive: true });
  process.chdir(toolDir);
  const catalog = defaultTaskCatalog();
  expect(await fs.realpath(catalog.root)).toBe(await fs.realpath(tempDir));
  process.chdir(originalCwd);
  expect(defaultTaskCatalog()).toBe(catalog);
});

describe('taskDirs', () => {
  it('rejects a dangling task symlink targeting a missing path outside the root', async () => {
    const root = path.join(tempDir, 'root');
    const tasks = path.join(root, 'active', 'evm', 'tasks');
    await fs.mkdir(tasks, { recursive: true });
    await fs.symlink(path.join(tempDir, 'missing-outside'), path.join(tasks, 'task'));
    expect(() => createTaskCatalog(root).taskDirs('task', 'mainnet')).toThrow(
      expect.objectContaining({ kind: 'outside-root' })
    );
  });

  it('allows internal symlinks and returns lexical paths through a symlinked root', async () => {
    const root = path.join(tempDir, 'root');
    const alias = path.join(tempDir, 'alias');
    const taskDir = path.join(root, 'active', 'evm', 'tasks', 'task');
    await fs.mkdir(path.dirname(taskDir), { recursive: true });
    await fs.mkdir(path.join(root, 'shared'));
    await fs.symlink(root, alias);
    await fs.symlink(path.join(root, 'shared'), taskDir);
    expect(createTaskCatalog(alias).taskDirs('task', 'mainnet')).toEqual({
      evmDir: `${alias}/active/evm`,
      taskDir: `${alias}/active/evm/tasks/task`,
      signaturesDir: `${alias}/active/evm/tasks/task/signatures/mainnet`,
      taskOriginDir: `${alias}/active/evm/tasks/task/config/mainnet`,
    });
  });

  it.each([
    'active/evm',
    'active/evm/tasks/task',
    'active/evm/tasks/task/signatures',
    'active/evm/tasks/task/config/mainnet',
  ])('rejects a symlink escaping the root at %s', async relativePath => {
    const root = path.join(tempDir, 'catalog');
    const outside = path.join(tempDir, 'catalog-outside');
    const link = path.join(root, relativePath);
    await fs.mkdir(outside, { recursive: true });
    await fs.mkdir(path.dirname(link), { recursive: true });
    await fs.symlink(outside, link);
    const call = () => createTaskCatalog(root).taskDirs('task', 'mainnet');
    expect(call).toThrow(TaskCatalogError);
    expect(call).toThrow(expect.objectContaining({ kind: 'outside-root' }));
  });

  describe.each(['../x', 'a/b', '', '.', 'a\\b', 'space here'])('invalid id %j', invalid => {
    it.each(['taskId', 'network'])('rejects invalid %s', field => {
      const taskId = field === 'taskId' ? invalid : 'valid-task';
      const network = field === 'network' ? invalid : 'mainnet';
      const call = () => createTaskCatalog(tempDir).taskDirs(taskId, network);
      expect(call).toThrow(TaskCatalogError);
      expect(call).toThrow(expect.objectContaining({ kind: 'invalid-id' }));
    });
  });

  it('returns the Task layout without requiring directories to exist', () => {
    const catalog = createTaskCatalog(tempDir);
    expect(catalog.root).toBe(tempDir);
    expect(catalog.taskDirs('2025-06-04-upgrade_foo', 'mainnet')).toEqual({
      evmDir: `${tempDir}/active/evm`,
      taskDir: `${tempDir}/active/evm/tasks/2025-06-04-upgrade_foo`,
      signaturesDir: `${tempDir}/active/evm/tasks/2025-06-04-upgrade_foo/signatures/mainnet`,
      taskOriginDir: `${tempDir}/active/evm/tasks/2025-06-04-upgrade_foo/config/mainnet`,
    });
  });
});

describe('listTasks', () => {
  it('uses network, Task, then EVM README precedence', async () => {
    const id = '2025-06-04-upgrade-foo';
    await makeTask(id, 'mainnet', '# Task title\n\nStatus: EXECUTED\n\nTask description.');
    const evmDir = path.join(tempDir, 'active', 'evm');
    const taskDir = path.join(evmDir, 'tasks', id);
    const networkReadme = path.join(taskDir, 'config', 'mainnet', 'README.md');
    await fs.writeFile(path.join(evmDir, 'README.md'), '# EVM title\n\nEVM description.');
    await fs.writeFile(
      networkReadme,
      '# Network title\r\n\r\nStatus: READY TO SIGN\r\n\r\n## Description\r\nNetwork description.\r\n\r\n## Other\r\nIgnored.'
    );
    const catalog = createTaskCatalog(tempDir);
    const base = { id, date: '2025-06-04', network: NetworkType.Mainnet };
    expect(catalog.listTasks(NetworkType.Mainnet)).toEqual([
      {
        ...base,
        name: 'Network title',
        description: 'Network description.',
        status: TaskStatus.ReadyToSign,
      },
    ]);
    await fs.unlink(networkReadme);
    expect(catalog.listTasks(NetworkType.Mainnet)).toEqual([
      {
        ...base,
        name: 'Task title',
        description: 'Task description.',
        status: TaskStatus.Executed,
      },
    ]);
    await fs.unlink(path.join(taskDir, 'README.md'));
    expect(catalog.listTasks(NetworkType.Mainnet)).toEqual([
      { ...base, name: 'EVM title', description: 'EVM description.', status: undefined },
    ]);
  });

  async function makeTask(id: string, network: string, readme?: string) {
    const taskDir = path.join(tempDir, 'active', 'evm', 'tasks', id);
    await fs.mkdir(path.join(taskDir, 'config', network, 'validations'), { recursive: true });
    if (readme !== undefined) {
      await fs.writeFile(path.join(taskDir, 'README.md'), readme);
    }
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

    const upgrades = createTaskCatalog(tempDir).listTasks(NetworkType.Mainnet);

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

    const upgrades = createTaskCatalog(tempDir).listTasks(NetworkType.Mainnet);

    expect(upgrades).toEqual([expect.objectContaining({ status: TaskStatus.Pending })]);
  });

  it('returns executed status for a task with an executed README status', async () => {
    await makeTask('2025-06-04-upgrade-foo', 'mainnet', 'Status: EXECUTED');

    const upgrades = createTaskCatalog(tempDir).listTasks(NetworkType.Mainnet);

    expect(upgrades).toEqual([expect.objectContaining({ status: TaskStatus.Executed })]);
  });

  it('omits status when the README has no status line', async () => {
    await makeTask('2025-06-04-upgrade-foo', 'mainnet', '# Upgrade Foo');

    const upgrades = createTaskCatalog(tempDir).listTasks(NetworkType.Mainnet);

    expect(JSON.parse(JSON.stringify(upgrades))).toEqual([
      {
        id: '2025-06-04-upgrade-foo',
        name: 'Upgrade Foo',
        description: 'Smart contract upgrade deployment',
        date: '2025-06-04',
        network: NetworkType.Mainnet,
      },
    ]);
  });

  it('uses the default description when the README has no descriptive text', async () => {
    await makeTask('2025-06-04-upgrade-foo', 'mainnet', '# Upgrade Foo\n\nStatus: PENDING');

    const upgrades = createTaskCatalog(tempDir).listTasks(NetworkType.Mainnet);

    expect(upgrades).toEqual([
      expect.objectContaining({ description: 'Smart contract upgrade deployment' }),
    ]);
  });

  it('returns all active task folders that have validations for the selected network', async () => {
    await makeTask('2025-06-04-upgrade-foo', 'mainnet');
    await makeTask('2025-07-12-upgrade-bar', 'mainnet');
    await makeTask('2025-07-12-upgrade-bar', 'zeronet');
    await makeTask('2025-08-01-other-network', 'zeronet');
    const fileOnly = path.join(
      tempDir,
      'active',
      'evm',
      'tasks',
      '2025-09-01-file-only',
      'config',
      'mainnet'
    );
    await fs.mkdir(fileOnly, { recursive: true });
    await fs.writeFile(path.join(fileOnly, 'validations'), '{}');

    const upgrades = createTaskCatalog(tempDir).listTasks(NetworkType.Mainnet);

    expect(upgrades).toEqual([
      {
        id: '2025-07-12-upgrade-bar',
        name: 'Upgrade Bar',
        description: '',
        date: '2025-07-12',
        network: NetworkType.Mainnet,
      },
      {
        id: '2025-06-04-upgrade-foo',
        name: 'Upgrade Foo',
        description: '',
        date: '2025-06-04',
        network: NetworkType.Mainnet,
      },
    ]);
  });

  it('does not discover old root-level network tasks', async () => {
    await fs.mkdir(path.join(tempDir, 'mainnet', '2025-06-04-upgrade-foo', 'validations'), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(tempDir, 'mainnet', '2025-06-04-upgrade-foo', 'README.md'),
      ['# Upgrade', '', 'Status: READY TO SIGN', '', '## Description', '', 'Legacy task.'].join(
        '\n'
      )
    );

    const upgrades = createTaskCatalog(tempDir).listTasks(NetworkType.Mainnet);

    expect(upgrades).toEqual([]);
  });

  it('ignores non-date-prefixed directories such as templates or archives', async () => {
    await makeTask('template', 'mainnet');
    await makeTask('2025-06-04-upgrade-foo', 'mainnet');

    const upgrades = createTaskCatalog(tempDir).listTasks(NetworkType.Mainnet);

    expect(upgrades.map(u => u.id)).toEqual(['2025-06-04-upgrade-foo']);
  });
});
