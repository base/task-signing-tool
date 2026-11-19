import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import { NextRequest } from 'next/server';
import os from 'os';
import path from 'path';
import * as taskCatalog from '@/lib/task-catalog';

type ExecResult = { stdout: string; stderr: string };
type ExecCallback = (error: unknown, result: ExecResult) => void;

const mockExec =
  jest.fn<(command: string, options: { cwd?: string }, callback: ExecCallback) => void>();
let fixtureRoot: string;

jest.unstable_mockModule('child_process', () => ({
  exec: mockExec,
}));

jest.unstable_mockModule('@/lib/task-catalog', () => ({
  ...taskCatalog,
  defaultTaskCatalog: () => taskCatalog.createTaskCatalog(fixtureRoot),
}));

const { POST } = await import('../route');

const UPGRADE_ID = '2025-08-01-upgrade-qux';

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/install-deps', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/install-deps', () => {
  let tempDir: string;
  let taskPath: string;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'install-deps-'));
    fixtureRoot = path.join(tempDir, 'catalog');
    taskPath = path.join(fixtureRoot, 'active', 'evm', 'tasks', UPGRADE_ID);
    await fs.mkdir(taskPath, { recursive: true });

    mockExec.mockImplementation((_command, _options, callback) => {
      callback(null, { stdout: '', stderr: '' });
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('selects the network the task Makefile builds against', async () => {
    const res = await POST(createRequest({ network: 'Zeronet', upgradeId: UPGRADE_ID }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockExec).toHaveBeenCalledTimes(1);

    const [command, options] = mockExec.mock.calls[0];
    expect(command).toBe('make TASK_NETWORK=zeronet deps');
    expect(options.cwd).toBe(taskPath);
    expect(options).toEqual({ cwd: taskPath, timeout: 20 * 60 * 1000, env: process.env });
  });

  it.each([{}, { network: 'Zeronet' }, { upgradeId: UPGRADE_ID }])(
    'rejects missing required parameters %j before running make',
    async body => {
      const res = await POST(createRequest(body));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: 'Missing required parameters: network and upgradeId are required',
      });
      expect(mockExec).not.toHaveBeenCalled();
    }
  );

  it.each([
    {
      name: 'command failure',
      failure: new Error('Command failed: make TASK_NETWORK=zeronet deps'),
      message: 'make deps command failed. Command failed: make TASK_NETWORK=zeronet deps',
    },
    {
      name: 'timeout',
      failure: new Error('timeout'),
      message:
        'Dependency installation timed out (20 minutes). This upgrade may require manual setup.',
    },
    {
      name: 'missing make',
      failure: new Error('spawn make ENOENT'),
      message: 'make command not found. Please ensure make is installed on the system.',
    },
    {
      name: 'other error',
      failure: new Error('Unexpected failure'),
      message: 'Unexpected failure',
    },
  ])('returns the existing 500 message for $name', async ({ failure, message }) => {
    mockExec.mockImplementation((_command, _options, callback) => {
      callback(failure, { stdout: '', stderr: '' });
    });

    const res = await POST(createRequest({ network: 'Zeronet', upgradeId: UPGRADE_ID }));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: message });
    expect(mockExec).toHaveBeenCalledTimes(1);
  });

  it('returns the shared catalog status for an invalid-profile error', async () => {
    mockExec.mockImplementation((_command, _options, callback) => {
      callback(new taskCatalog.TaskCatalogError('invalid-profile', 'Invalid validation profile'), {
        stdout: '',
        stderr: '',
      });
    });

    const res = await POST(createRequest({ network: 'Zeronet', upgradeId: UPGRADE_ID }));

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'Invalid validation profile' });
  });

  it('rejects a missing Task folder before running make', async () => {
    const res = await POST(createRequest({ network: 'Zeronet', upgradeId: 'missing-task' }));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: 'Task folder not found: active/evm/tasks/missing-task',
    });
    expect(mockExec).not.toHaveBeenCalled();
  });

  it('rejects a Task folder symlink outside the catalog root before running make', async () => {
    const outside = path.join(tempDir, 'outside');
    await fs.mkdir(outside);
    await fs.rm(taskPath, { recursive: true });
    await fs.symlink(outside, taskPath);

    const res = await POST(createRequest({ network: 'Zeronet', upgradeId: UPGRADE_ID }));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: `Task path is outside the catalog root: ${await fs.realpath(outside)}`,
    });
    expect(mockExec).not.toHaveBeenCalled();
  });

  it.each([
    { network: 'zeronet; rm -rf /', upgradeId: UPGRADE_ID, invalid: 'zeronet; rm -rf /' },
    { network: '../x', upgradeId: UPGRADE_ID, invalid: '../x' },
    { network: 'Zeronet', upgradeId: '../x', invalid: '../x' },
  ])(
    'rejects invalid input $network/$upgradeId before running make',
    async ({ network, upgradeId, invalid }) => {
      const res = await POST(createRequest({ network, upgradeId }));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: `Invalid Task id or network: ${invalid}` });
      expect(mockExec).not.toHaveBeenCalled();
    }
  );
});
