import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';

const mockAccess = jest.fn<(path: string) => Promise<void>>();
const mockRm =
  jest.fn<(path: string, options: { recursive: boolean; force: boolean }) => Promise<void>>();
const mockExecAsync = jest.fn<() => Promise<{ stdout: string; stderr: string }>>();
const mockFindContractDeploymentsRoot = jest.fn<() => string>();

jest.unstable_mockModule('fs', () => ({
  promises: { access: mockAccess, rm: mockRm },
}));

jest.unstable_mockModule('util', () => ({
  promisify: () => mockExecAsync,
}));

jest.unstable_mockModule('@/lib/deployments', () => ({
  findContractDeploymentsRoot: mockFindContractDeploymentsRoot,
}));

const { POST } = await import('../route');

function createRequest(body: object): NextRequest {
  return new NextRequest('http://localhost/api/install-deps', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/install-deps', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    mockFindContractDeploymentsRoot.mockReturnValue('/repo');
    mockAccess.mockResolvedValue(undefined);
    mockRm.mockResolvedValue(undefined);
    mockExecAsync.mockResolvedValue({ stdout: 'installed', stderr: '' });
  });

  it('purges shared libs and installs with the selected task Makefile', async () => {
    const response = await POST(
      createRequest({ network: 'zeronet', upgradeId: '2026-07-10-transfer-owner' })
    );

    expect(response.status).toBe(200);
    expect(mockRm).toHaveBeenCalledWith('/repo/active/evm/lib', {
      recursive: true,
      force: true,
    });
    expect(mockExecAsync).toHaveBeenCalledWith(
      'make -f tasks/2026-07-10-transfer-owner/Makefile deps',
      expect.objectContaining({ cwd: '/repo/active/evm' })
    );
  });
});
