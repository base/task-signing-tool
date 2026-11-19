import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import type { ValidationServiceOpts } from '@/lib/validation-service';
import { NetworkType, type ValidationData } from '@/lib/types';
import { TaskCatalogError, type TaskCatalogErrorKind } from '@/lib/task-catalog';

const mockValidateUpgrade = jest.fn<(opts: ValidationServiceOpts) => Promise<ValidationData>>();

jest.unstable_mockModule('@/lib/validation-service', () => ({
  validateUpgrade: mockValidateUpgrade,
}));

const { POST } = await import('../route');

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/validate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/validate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockValidateUpgrade.mockResolvedValue({} as ValidationData);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each<[TaskCatalogErrorKind, number]>([
    ['invalid-id', 400],
    ['outside-root', 403],
    ['not-found', 404],
    ['invalid-profile', 422],
  ])('maps catalog error %s to status %i with its exact message', async (kind, status) => {
    mockValidateUpgrade.mockRejectedValue(new TaskCatalogError(kind, `Profile error: ${kind}`));

    const res = await POST(
      createRequest({
        upgradeId: '2025-08-01-upgrade-qux',
        network: 'mainnet',
        userType: 'base-sc',
      })
    );

    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: `Profile error: ${kind}` });
  });

  it.each([
    [new Error('Simulation failed'), 'Simulation failed'],
    ['unexpected rejection', 'Validation failed'],
  ])('keeps a non-catalog rejection %p at 500 with the exact body', async (error, message) => {
    mockValidateUpgrade.mockRejectedValue(error);

    const res = await POST(
      createRequest({
        upgradeId: '2025-08-01-upgrade-qux',
        network: 'mainnet',
        userType: 'base-sc',
      })
    );

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: message });
  });

  it('accepts zeronet as a supported network', async () => {
    const res = await POST(
      createRequest({
        upgradeId: '2025-08-01-upgrade-qux',
        network: 'zeronet',
        userType: 'base-sc',
      })
    );

    expect(res.status).toBe(200);
    expect(mockValidateUpgrade).toHaveBeenCalledWith({
      upgradeId: '2025-08-01-upgrade-qux',
      network: NetworkType.Zeronet,
      taskConfigFileName: 'base-sc',
    });
  });

  it('rejects unsupported networks and lists zeronet in supported values', async () => {
    const res = await POST(
      createRequest({
        upgradeId: '2025-08-01-upgrade-qux',
        network: 'hoodi',
        userType: 'base-sc',
      })
    );

    expect(res.status).toBe(400);
    expect(mockValidateUpgrade).not.toHaveBeenCalled();

    const body = await res.json();
    expect(body.message).toMatch(/unsupported network/i);
    expect(body.message).toContain('zeronet');
  });
});
