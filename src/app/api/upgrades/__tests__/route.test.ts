import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { NetworkType, TaskStatus } from '@/lib/types';
import type { DeploymentInfo } from '@/lib/deployments';

const mockGetUpgradeOptions = jest.fn<(network: NetworkType) => DeploymentInfo[]>();

jest.unstable_mockModule('@/lib/deployments', () => ({
  getUpgradeOptions: mockGetUpgradeOptions,
}));

const { GET } = await import('../route');

function createRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/upgrades');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

describe('GET /api/upgrades', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUpgradeOptions.mockImplementation((network: NetworkType) => {
      if (network === NetworkType.Zeronet) {
        return [
          {
            id: '2025-08-01-upgrade-qux',
            name: 'Upgrade Qux',
            description: 'Zeronet upgrade',
            date: '2025-08-01',
            network: NetworkType.Zeronet,
            status: TaskStatus.ReadyToSign,
          },
        ];
      }
      return [];
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('accepts zeronet as a valid network query', async () => {
    const res = GET(createRequest({ network: 'zeronet' }));

    expect(res.status).toBe(200);
    expect(mockGetUpgradeOptions).toHaveBeenCalledWith(NetworkType.Zeronet);

    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].network).toBe(NetworkType.Zeronet);
  });

  it('includes zeronet when aggregating ready-to-sign tasks', async () => {
    const res = GET(createRequest({ readyToSign: 'true' }));

    expect(res.status).toBe(200);
    expect(mockGetUpgradeOptions).toHaveBeenCalledWith(NetworkType.Zeronet);

    const body = await res.json();
    expect(body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: '2025-08-01-upgrade-qux',
          network: NetworkType.Zeronet,
          status: TaskStatus.ReadyToSign,
        }),
      ])
    );
  });
});
