import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { NetworkType, TaskStatus } from '@/lib/types';
import { createTaskCatalog } from '@/lib/task-catalog';

let fixtureRoot: string;

jest.unstable_mockModule('@/lib/task-catalog', () => ({
  defaultTaskCatalog: () => createTaskCatalog(fixtureRoot),
}));

const { GET } = await import('../route');

function createRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/upgrades');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

async function makeTask(id: string, network: NetworkType, name: string, status?: TaskStatus) {
  const taskDir = path.join(fixtureRoot, 'active', 'evm', 'tasks', id);
  await fs.mkdir(path.join(taskDir, 'config', network, 'validations'), { recursive: true });
  await fs.writeFile(
    path.join(taskDir, 'README.md'),
    `# ${name}\n\n${status ? `Status: ${status}\n\n` : ''}Description for ${name}.`
  );
}

describe('GET /api/upgrades', () => {
  beforeEach(async () => {
    fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'task-route-'));
  });

  afterEach(async () => {
    await fs.rm(fixtureRoot, { recursive: true, force: true });
  });

  it('returns 400 when readyToSign is missing', async () => {
    const res = GET(createRequest({}));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Missing required parameter: readyToSign' });
  });

  it('sorts aggregated ready-to-sign tasks newest-first across networks', async () => {
    await makeTask('2025-01-01-upgrade-old', NetworkType.Mainnet, 'Old', TaskStatus.ReadyToSign);
    await makeTask('2025-12-31-upgrade-new', NetworkType.Zeronet, 'New', TaskStatus.ReadyToSign);

    const res = GET(createRequest({ readyToSign: 'true' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      {
        id: '2025-12-31-upgrade-new',
        name: 'New',
        description: 'Description for New.',
        date: '2025-12-31',
        network: NetworkType.Zeronet,
        status: TaskStatus.ReadyToSign,
      },
      {
        id: '2025-01-01-upgrade-old',
        name: 'Old',
        description: 'Description for Old.',
        date: '2025-01-01',
        network: NetworkType.Mainnet,
        status: TaskStatus.ReadyToSign,
      },
    ]);
  });

  it('omits an escaping Task while returning a safe ready-to-sign sibling', async () => {
    const root = fixtureRoot;
    fixtureRoot = path.join(root, 'catalog');
    try {
      await makeTask('2025-06-04-safe', NetworkType.Mainnet, 'Safe', TaskStatus.ReadyToSign);
      const outside = path.join(root, 'outside');
      await fs.mkdir(path.join(outside, 'validations'), { recursive: true });
      await fs.writeFile(
        path.join(outside, 'README.md'),
        '# External\n\nStatus: READY TO SIGN\n\nExternal description.'
      );
      const config = path.join(
        fixtureRoot,
        'active',
        'evm',
        'tasks',
        '2025-06-05-unsafe',
        'config'
      );
      await fs.mkdir(config, { recursive: true });
      await fs.symlink(outside, path.join(config, 'mainnet'));

      const res = GET(createRequest({ readyToSign: 'true' }));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([
        {
          id: '2025-06-04-safe',
          name: 'Safe',
          description: 'Description for Safe.',
          date: '2025-06-04',
          network: NetworkType.Mainnet,
          status: TaskStatus.ReadyToSign,
        },
      ]);
    } finally {
      fixtureRoot = root;
    }
  });

  it('returns only ready-to-sign tasks', async () => {
    await makeTask(
      '2025-08-01-upgrade-ready',
      NetworkType.Mainnet,
      'Ready',
      TaskStatus.ReadyToSign
    );
    await makeTask(
      '2025-08-02-upgrade-pending',
      NetworkType.Mainnet,
      'Pending',
      TaskStatus.Pending
    );
    await makeTask(
      '2025-08-03-upgrade-executed',
      NetworkType.Mainnet,
      'Executed',
      TaskStatus.Executed
    );
    await makeTask('2025-08-04-upgrade-unknown', NetworkType.Mainnet, 'Unknown');

    const res = GET(createRequest({ readyToSign: 'true' }));

    expect(await res.json()).toEqual([
      {
        id: '2025-08-01-upgrade-ready',
        name: 'Ready',
        description: 'Description for Ready.',
        date: '2025-08-01',
        network: NetworkType.Mainnet,
        status: TaskStatus.ReadyToSign,
      },
    ]);
  });
});
