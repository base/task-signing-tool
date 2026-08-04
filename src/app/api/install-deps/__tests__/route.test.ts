import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';

const mockAccess = jest.fn<(path: string) => Promise<void>>();
const mockExecAsync =
  jest.fn<
    (
      command: string,
      options: { cwd: string; timeout: number; env: NodeJS.ProcessEnv }
    ) => Promise<{ stdout: string; stderr: string }>
  >();
const mockFindContractDeploymentsRoot = jest.fn<() => string>();

jest.unstable_mockModule('fs', () => ({
  promises: { access: mockAccess },
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
    mockExecAsync.mockResolvedValue({ stdout: 'installed', stderr: '' });
  });

  it('installs missing shared libs with the selected task Makefile', async () => {
    mockAccess
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('missing'))
      .mockResolvedValueOnce(undefined);

    const response = await POST(
      createRequest({ network: 'zeronet', upgradeId: '2026-07-10-transfer-owner' })
    );

    expect(response.status).toBe(200);
    expect(mockExecAsync).toHaveBeenCalledWith(
      'make -f tasks/2026-07-10-transfer-owner/Makefile deps',
      expect.objectContaining({ cwd: '/repo/active/evm' })
    );
  });
});
