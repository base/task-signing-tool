import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import type { ValidationServiceOpts } from '@/lib/validation-service';
import { NetworkType, type ValidationData } from '@/lib/types';

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
