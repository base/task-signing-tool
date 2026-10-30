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
  it('omits a Task with a regular-file network config without dropping a ready sibling', async () => {
    await makeTask('2025-06-04-safe', 'mainnet', '# Safe\n\nStatus: READY TO SIGN');
    const config = path.join(tempDir, 'active', 'evm', 'tasks', '2025-06-05-bad', 'config');
    await fs.mkdir(config, { recursive: true });
    await fs.writeFile(path.join(config, 'mainnet'), '{}');

    expect(createTaskCatalog(tempDir).listTasks(NetworkType.Mainnet)).toEqual([
      {
        id: '2025-06-04-safe',
        name: 'Safe',
        description: 'Smart contract upgrade deployment',
        date: '2025-06-04',
        network: NetworkType.Mainnet,
        status: TaskStatus.ReadyToSign,
      },
    ]);
  });

  it.each(['network', 'Task', 'EVM'])(
    'ignores a looping %s README and uses the next usable candidate',
    async level => {
      await makeTask('2025-06-04-safe', 'mainnet');
      const evm = path.join(tempDir, 'active', 'evm');
      const task = path.join(evm, 'tasks', '2025-06-04-safe');
      const config = path.join(task, 'config', 'mainnet');
      const readmeDir = level === 'network' ? config : level === 'Task' ? task : evm;
      const readme = path.join(readmeDir, 'README.md');
      await fs.symlink(readme, readme);
      if (level !== 'EVM') {
        await fs.writeFile(
          path.join(level === 'network' ? task : evm, 'README.md'),
          '# Fallback\n\nStatus: READY TO SIGN\n\nFallback description.'
        );
      }

      expect(createTaskCatalog(tempDir).listTasks(NetworkType.Mainnet)).toEqual([
        {
          id: '2025-06-04-safe',
          name: level === 'EVM' ? 'Safe' : 'Fallback',
          description: level === 'EVM' ? '' : 'Fallback description.',
          date: '2025-06-04',
          network: NetworkType.Mainnet,
          ...(level === 'EVM' ? {} : { status: TaskStatus.ReadyToSign }),
        },
      ]);
    }
  );

  it('returns an empty list for a looping tasks root without throwing', async () => {
    const evm = path.join(tempDir, 'active', 'evm');
    await fs.mkdir(evm, { recursive: true });
    const tasks = path.join(evm, 'tasks');
    await fs.symlink(tasks, tasks);

    expect(createTaskCatalog(tempDir).listTasks(NetworkType.Mainnet)).toEqual([]);
  });

  it('returns an empty list when the EVM root escapes to an outside Task tree', async () => {
    const root = path.join(tempDir, 'catalog');
    const outside = path.join(tempDir, 'outside');
    await fs.mkdir(
      path.join(outside, 'tasks', '2025-06-04-unsafe', 'config', 'mainnet', 'validations'),
      {
        recursive: true,
      }
    );
    await fs.writeFile(
      path.join(outside, 'README.md'),
      '# External\n\nStatus: READY TO SIGN\n\nExternal description.'
    );
    await fs.mkdir(path.join(root, 'active'), { recursive: true });
    await fs.symlink(outside, path.join(root, 'active', 'evm'));

    expect(createTaskCatalog(root).listTasks(NetworkType.Mainnet)).toEqual([]);
  });

  describe.each(['../x', '', 'a/b'])('invalid network %j', network => {
    it.each([false, true])(
      'rejects the network before listing with tasks directory present: %s',
      async hasTasks => {
        if (hasTasks) {
          await fs.mkdir(path.join(tempDir, 'active', 'evm', 'tasks'), { recursive: true });
        }
        expect(() => createTaskCatalog(tempDir).listTasks(network as NetworkType)).toThrow(
          expect.objectContaining({ kind: 'invalid-id' })
        );
      }
    );
  });

  it.each(['network', 'Task', 'EVM'])(
    'ignores an escaping %s README and uses the next contained candidate',
    async level => {
      const root = path.join(tempDir, 'catalog');
      const evm = path.join(root, 'active', 'evm');
      const task = path.join(evm, 'tasks', '2025-06-04-safe');
      const config = path.join(task, 'config', 'mainnet');
      await fs.mkdir(path.join(config, 'validations'), { recursive: true });
      const outside = path.join(tempDir, 'README.md');
      await fs.writeFile(outside, '# External title\n\nStatus: EXECUTED\n\nExternal description.');
      const readmeDir = level === 'network' ? config : level === 'Task' ? task : evm;
      await fs.symlink(outside, path.join(readmeDir, 'README.md'));
      if (level !== 'EVM') {
        await fs.writeFile(
          path.join(level === 'network' ? task : evm, 'README.md'),
          '# Internal title\n\nStatus: READY TO SIGN\n\nInternal description.'
        );
      }

      expect(createTaskCatalog(root).listTasks(NetworkType.Mainnet)).toEqual([
        {
          id: '2025-06-04-safe',
          name: level === 'EVM' ? 'Safe' : 'Internal title',
          description: level === 'EVM' ? '' : 'Internal description.',
          date: '2025-06-04',
          network: NetworkType.Mainnet,
          ...(level === 'EVM' ? {} : { status: TaskStatus.ReadyToSign }),
        },
      ]);
    }
  );

  it.each(['config/mainnet', 'config/mainnet/validations'])(
    'omits a Task escaping through %s without dropping a safe sibling',
    async relativePath => {
      const root = path.join(tempDir, 'catalog');
      const tasks = path.join(root, 'active', 'evm', 'tasks');
      const unsafeTask = path.join(tasks, '2025-06-05-unsafe');
      const outside = path.join(tempDir, 'outside');
      await fs.mkdir(path.join(tasks, '2025-06-04-safe', 'config', 'mainnet', 'validations'), {
        recursive: true,
      });
      await fs.mkdir(path.join(outside, 'validations'), { recursive: true });
      await fs.writeFile(path.join(outside, 'README.md'), '# External title');
      const link = path.join(unsafeTask, relativePath);
      await fs.mkdir(path.dirname(link), { recursive: true });
      await fs.symlink(outside, link);

      expect(createTaskCatalog(root).listTasks(NetworkType.Mainnet)).toEqual([
        {
          id: '2025-06-04-safe',
          name: 'Safe',
          description: '',
          date: '2025-06-04',
          network: NetworkType.Mainnet,
        },
      ]);
    }
  );

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
