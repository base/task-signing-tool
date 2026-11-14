import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import * as taskCatalog from '@/lib/task-catalog';

let fixtureRoot: string;
let tempDir: string;

jest.unstable_mockModule('@/lib/task-catalog', () => ({
  ...taskCatalog,
  defaultTaskCatalog: () => taskCatalog.createTaskCatalog(fixtureRoot),
}));

const { GET } = await import('../route');

function createRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/upgrade-config');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

function validationsDir(): string {
  return path.join(
    fixtureRoot,
    'active',
    'evm',
    'tasks',
    'task',
    'config',
    'mainnet',
    'validations'
  );
}

describe('GET /api/upgrade-config', () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'profile-route-'));
    fixtureRoot = path.join(tempDir, 'root');
    await fs.mkdir(fixtureRoot);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it.each(['network', 'upgradeId'])('returns 400 when required %s is missing', async missing => {
    const params: Record<string, string> = { network: 'mainnet', upgradeId: 'task' };
    delete params[missing];

    const res = await GET(createRequest(params));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 'Missing required parameters: network and upgradeId are required',
    });
  });

  it('returns 500 with the existing message for other filesystem errors', async () => {
    const validations = validationsDir();
    await fs.mkdir(path.dirname(validations), { recursive: true });
    await fs.writeFile(validations, 'not a directory');

    const res = await GET(createRequest({ network: 'mainnet', upgradeId: 'task' }));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to fetch upgrade configuration' });
  });

  it.each([
    { params: { network: '../network', upgradeId: 'task' }, status: 400 },
    { params: { network: 'mainnet', upgradeId: '../task' }, status: 400 },
    { params: { network: 'mainnet', upgradeId: 'task' }, status: 403 },
    { params: { network: 'mainnet', upgradeId: 'missing' }, status: 404 },
  ])('maps catalog errors to $status for $params', async ({ params, status }) => {
    if (status === 403) {
      const outside = path.join(tempDir, 'outside');
      await fs.mkdir(outside);
      await fs.mkdir(path.dirname(validationsDir()), { recursive: true });
      await fs.symlink(outside, validationsDir());
    }

    const res = await GET(createRequest(params));

    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: expect.any(String) });
  });

  it('returns exactly the catalog profile names and display names', async () => {
    const validations = validationsDir();
    await fs.mkdir(validations, { recursive: true });
    await fs.writeFile(
      path.join(validations, 'signer-role.json'),
      '{"ledgerId": 42, "name": "ignored", "displayName": "Ignored"}'
    );

    const res = await GET(createRequest({ network: 'mainnet', upgradeId: 'task' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      configOptions: [{ name: 'signer-role', displayName: 'Signer Role' }],
    });
  });
});
