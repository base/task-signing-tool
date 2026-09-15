import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import { NextRequest } from 'next/server';
import os from 'os';
import path from 'path';

type ExecResult = { stdout: string; stderr: string };
type ExecCallback = (error: Error | null, result: ExecResult) => void;

const mockExec =
  jest.fn<(command: string, options: { cwd?: string }, callback: ExecCallback) => void>();
const mockFindContractDeploymentsRoot = jest.fn<() => string>();

jest.unstable_mockModule('child_process', () => ({
  exec: mockExec,
}));

jest.unstable_mockModule('@/lib/deployments', () => ({
  findContractDeploymentsRoot: mockFindContractDeploymentsRoot,
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
  let repoRoot: string;
  let taskPath: string;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});

    repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'install-deps-'));
    taskPath = path.join(repoRoot, 'active', 'evm', 'tasks', UPGRADE_ID);
    await fs.mkdir(taskPath, { recursive: true });

    mockFindContractDeploymentsRoot.mockReturnValue(repoRoot);
    mockExec.mockImplementation((_command, _options, callback) => {
      callback(null, { stdout: '', stderr: '' });
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await fs.rm(repoRoot, { recursive: true, force: true });
  });

  it('selects the network the task Makefile builds against', async () => {
    const res = await POST(createRequest({ network: 'Zeronet', upgradeId: UPGRADE_ID }));

    expect(res.status).toBe(200);
    expect(mockExec).toHaveBeenCalledTimes(1);

    const [command, options] = mockExec.mock.calls[0];
    expect(command).toBe('make TASK_NETWORK=zeronet deps');
    expect(options.cwd).toBe(taskPath);
  });

  it('rejects a network that would escape the make command', async () => {
    const res = await POST(createRequest({ network: 'zeronet; rm -rf /', upgradeId: UPGRADE_ID }));

    expect(res.status).toBe(400);
    expect(mockExec).not.toHaveBeenCalled();
  });
});
