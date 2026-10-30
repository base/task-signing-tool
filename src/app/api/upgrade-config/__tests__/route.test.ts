import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { NextRequest } from 'next/server';

const mockReaddir = jest.fn<(path: string) => Promise<string[]>>();
const mockReadFile = jest.fn<(path: string, encoding: BufferEncoding) => Promise<string>>();

jest.unstable_mockModule('fs', () => ({
  promises: {
    readdir: mockReaddir,
    readFile: mockReadFile,
  },
}));

const mockFindContractDeploymentsRoot = jest.fn<() => string>();

jest.unstable_mockModule('@/lib/deployments', () => ({
  findContractDeploymentsRoot: mockFindContractDeploymentsRoot,
}));

const mockParseFromString = jest.fn();

jest.unstable_mockModule('@/lib/parser', () => ({
  parseFromString: mockParseFromString,
}));

const { GET } = await import('../route');

function createRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/upgrade-config');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

describe('GET /api/upgrade-config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFindContractDeploymentsRoot.mockReturnValue('/mock-root');
    mockReaddir.mockResolvedValue(['config1.json']);
    mockReadFile.mockResolvedValue('{}');
    mockParseFromString.mockReturnValue({
      success: true,
      config: { ledgerId: 1 },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('missing parameters', () => {
    it('returns 400 when network is missing', async () => {
      const res = await GET(createRequest({ upgradeId: 'test' }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/missing required parameter/i);
    });

    it('returns 400 when upgradeId is missing', async () => {
      const res = await GET(createRequest({ network: 'mainnet' }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/missing required parameter/i);
    });
  });

  describe('path traversal prevention', () => {
    it.each(['..', 'foo/bar', 'main net', '.'])(
      'returns 400 when network is "%s"',
      async network => {
        const res = await GET(createRequest({ network, upgradeId: 'test' }));
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toMatch(/invalid network/i);
      }
    );
    it('returns 400 when upgradeId contains path separators', async () => {
      const res = await GET(createRequest({ network: 'mainnet', upgradeId: 'foo/bar' }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/invalid network or upgradeId/i);
    });
  });

  describe('valid safe characters', () => {
    it('accepts hyphens in network names', async () => {
      const res = await GET(createRequest({ network: 'op-mainnet', upgradeId: 'test' }));
      expect(res.status).toBe(200);
    });
  });

  describe('happy path', () => {
    it('returns 200 with config options', async () => {
      const res = await GET(createRequest({ network: 'mainnet', upgradeId: 'test' }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.configOptions).toHaveLength(1);
      expect(body.configOptions[0]).toEqual({
        fileName: 'config1',
        displayName: 'Config1',
        ledgerId: 1,
      });
    });

    it('returns the default config option when parsing fails', async () => {
      mockParseFromString.mockReturnValue({ success: false });
      const res = await GET(createRequest({ network: 'mainnet', upgradeId: 'test' }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.configOptions).toEqual([
        { fileName: 'config1', displayName: 'Config1', ledgerId: 0 },
      ]);
      expect(console.warn).toHaveBeenCalledWith(
        'Failed to parse config1.json, using default ledgerId: 0'
      );
    });

    it('returns the default config option when reading fails', async () => {
      const error = new Error('Read failed');
      mockReadFile.mockRejectedValue(error);
      const res = await GET(createRequest({ network: 'mainnet', upgradeId: 'test' }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.configOptions).toEqual([
        { fileName: 'config1', displayName: 'Config1', ledgerId: 0 },
      ]);
      expect(console.warn).toHaveBeenCalledWith(
        'Error reading config1.json, using default ledgerId: 0',
        error
      );
    });

    it('returns 200 with empty array on ENOENT', async () => {
      const enoentError = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      mockReaddir.mockRejectedValue(enoentError);
      const res = await GET(createRequest({ network: 'mainnet', upgradeId: 'test' }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.configOptions).toEqual([]);
    });
  });

  describe('post-validation', () => {
    it('returns 500 on unexpected fs errors', async () => {
      mockReaddir.mockRejectedValue(new Error('Unexpected disk error'));
      const res = await GET(createRequest({ network: 'mainnet', upgradeId: 'test' }));
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toMatch(/failed to fetch upgrade configuration/i);
    });
  });

  describe('does not call fs', () => {
    it('readdir not called when validation rejects', async () => {
      await GET(createRequest({ network: '..', upgradeId: 'test' }));
      expect(mockReaddir).not.toHaveBeenCalled();
      expect(mockFindContractDeploymentsRoot).not.toHaveBeenCalled();
    });
  });
});
