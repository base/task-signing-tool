import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { maxUint256 } from 'viem';
import type { LedgerSigningOptions, LedgerSigningResult } from '@/lib/ledger-signing';
import type { TrezorSigningOptions } from '@/lib/trezor-signing';
import { hashSafeTxTypedData, type SafeTxTypedData } from '@/lib/safe-typed-data';

const mockCheckLedgerAvailability = jest.fn<() => Promise<boolean>>();
const mockSignDomainAndMessageHash =
  jest.fn<(options: LedgerSigningOptions) => Promise<LedgerSigningResult>>();

jest.unstable_mockModule('@/lib/ledger-signing', () => ({
  checkLedgerAvailability: mockCheckLedgerAvailability,
  signDomainAndMessageHash: mockSignDomainAndMessageHash,
}));

const mockEnsureTrezorctl = jest.fn<() => Promise<string | null>>();
const mockSignSafeTxWithTrezor =
  jest.fn<(options: TrezorSigningOptions) => Promise<LedgerSigningResult>>();

jest.unstable_mockModule('@/lib/trezor-signing', () => ({
  ensureTrezorctl: mockEnsureTrezorctl,
  signSafeTxWithTrezor: mockSignSafeTxWithTrezor,
}));

const { POST } = await import('../route');

const VALID_DOMAIN_HASH = '0x' + 'a'.repeat(64);
const VALID_MESSAGE_HASH = '0x' + 'b'.repeat(64);

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/sign', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/sign', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckLedgerAvailability.mockResolvedValue(true);
    mockSignDomainAndMessageHash.mockResolvedValue({
      success: true,
      data: '0x1901' + 'a'.repeat(64) + 'b'.repeat(64),
      signature: '0x' + 'f'.repeat(130),
      signer: '0x' + '1'.repeat(40),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('missing required fields', () => {
    it('returns 400 when domainHash is missing', async () => {
      const res = await POST(createRequest({ messageHash: VALID_MESSAGE_HASH }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/missing required fields/i);
    });

    it('returns 400 when messageHash is missing', async () => {
      const res = await POST(createRequest({ domainHash: VALID_DOMAIN_HASH }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/missing required fields/i);
    });

    it('returns 400 when both are missing', async () => {
      const res = await POST(createRequest({}));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/missing required fields/i);
    });
  });

  describe('HashSchema - domainHash', () => {
    it('returns 400 when too short (63 hex chars)', async () => {
      const res = await POST(
        createRequest({
          domainHash: '0x' + 'a'.repeat(63),
          messageHash: VALID_MESSAGE_HASH,
        })
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/invalid domainHash/i);
    });

    it('returns 400 when missing 0x prefix', async () => {
      const res = await POST(
        createRequest({
          domainHash: 'a'.repeat(64),
          messageHash: VALID_MESSAGE_HASH,
        })
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/invalid domainHash/i);
    });

    it('returns 400 when too long (65 hex chars)', async () => {
      const res = await POST(
        createRequest({
          domainHash: '0x' + 'a'.repeat(65),
          messageHash: VALID_MESSAGE_HASH,
        })
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/invalid domainHash/i);
    });

    it('returns 400 when contains non-hex chars', async () => {
      const res = await POST(
        createRequest({
          domainHash: '0x' + 'g'.repeat(64),
          messageHash: VALID_MESSAGE_HASH,
        })
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/invalid domainHash/i);
    });
  });

  describe('HashSchema - messageHash', () => {
    it('returns 400 when invalid format', async () => {
      const res = await POST(
        createRequest({
          domainHash: VALID_DOMAIN_HASH,
          messageHash: '0xinvalid',
        })
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/invalid messageHash/i);
    });
  });

  describe('ledgerAccount', () => {
    it('returns 400 when negative (-1)', async () => {
      const res = await POST(
        createRequest({
          domainHash: VALID_DOMAIN_HASH,
          messageHash: VALID_MESSAGE_HASH,
          ledgerAccount: -1,
        })
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/invalid ledgerAccount/i);
    });

    it('returns 400 when float (1.5)', async () => {
      const res = await POST(
        createRequest({
          domainHash: VALID_DOMAIN_HASH,
          messageHash: VALID_MESSAGE_HASH,
          ledgerAccount: 1.5,
        })
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/invalid ledgerAccount/i);
    });

    it('returns 400 when string ("abc")', async () => {
      const res = await POST(
        createRequest({
          domainHash: VALID_DOMAIN_HASH,
          messageHash: VALID_MESSAGE_HASH,
          ledgerAccount: 'abc',
        })
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/invalid ledgerAccount/i);
    });
  });

  describe('happy path', () => {
    it('returns 200 with valid hashes, default ledgerAccount', async () => {
      const res = await POST(
        createRequest({
          domainHash: VALID_DOMAIN_HASH,
          messageHash: VALID_MESSAGE_HASH,
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.signature).toBeDefined();
      expect(body.signer).toBeDefined();
    });

    it('returns 200 with valid hashes, explicit ledgerAccount', async () => {
      const res = await POST(
        createRequest({
          domainHash: VALID_DOMAIN_HASH,
          messageHash: VALID_MESSAGE_HASH,
          ledgerAccount: 2,
        })
      );
      expect(res.status).toBe(200);
      expect(mockSignDomainAndMessageHash).toHaveBeenCalledWith({
        domainHash: VALID_DOMAIN_HASH,
        messageHash: VALID_MESSAGE_HASH,
        ledgerAccount: 2,
      });
    });

    it('does not call ledger functions when validation fails', async () => {
      await POST(
        createRequest({
          domainHash: '0xinvalid',
          messageHash: VALID_MESSAGE_HASH,
        })
      );
      expect(mockCheckLedgerAvailability).not.toHaveBeenCalled();
      expect(mockSignDomainAndMessageHash).not.toHaveBeenCalled();
    });
  });

  describe('post-validation', () => {
    it('returns 500 when ledger unavailable', async () => {
      mockCheckLedgerAvailability.mockResolvedValue(false);
      const res = await POST(
        createRequest({
          domainHash: VALID_DOMAIN_HASH,
          messageHash: VALID_MESSAGE_HASH,
        })
      );
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toMatch(/eip712sign binary not found/i);
    });

    it('returns 500 when signing fails', async () => {
      mockSignDomainAndMessageHash.mockResolvedValue({
        success: false,
        error: 'Signing failed',
      });
      const res = await POST(
        createRequest({
          domainHash: VALID_DOMAIN_HASH,
          messageHash: VALID_MESSAGE_HASH,
        })
      );
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe('Signing failed');
    });
  });

  describe('device: trezor', () => {
    const ZERO = '0x0000000000000000000000000000000000000000';
    const typedData: SafeTxTypedData = {
      domain: { chainId: '8453', verifyingContract: '0x9855054731540A48b28990B63DcF4f33d8AE46A1' },
      message: {
        to: '0xcA11bde05977b3631167028862bE2a173976CA11',
        value: '0',
        data: '0x1234',
        operation: 1,
        safeTxGas: '0',
        baseGas: '0',
        gasPrice: '0',
        gasToken: ZERO,
        refundReceiver: ZERO,
        nonce: '7',
      },
    };
    const { domainHash, messageHash } = hashSafeTxTypedData(typedData);

    beforeEach(() => {
      mockEnsureTrezorctl.mockResolvedValue(null);
      mockSignSafeTxWithTrezor.mockResolvedValue({
        success: true,
        data: '0x1901',
        signature: 'f'.repeat(130),
        signer: '0x' + '1'.repeat(40),
      });
    });

    it('signs with the Trezor when typed data matches the hashes', async () => {
      const res = await POST(
        createRequest({ device: 'trezor', domainHash, messageHash, ledgerAccount: 2, typedData })
      );
      expect(res.status).toBe(200);
      expect(mockSignSafeTxWithTrezor).toHaveBeenCalledWith({ typedData, accountIndex: 2 });
      expect(mockSignDomainAndMessageHash).not.toHaveBeenCalled();
    });

    it('returns 400 when typedData is missing', async () => {
      const res = await POST(createRequest({ device: 'trezor', domainHash, messageHash }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/invalid typedData/i);
    });

    it('returns 400 when typedData has unexpected fields', async () => {
      const res = await POST(
        createRequest({
          device: 'trezor',
          domainHash,
          messageHash,
          typedData: { ...typedData, primaryType: 'Other' },
        })
      );
      expect(res.status).toBe(400);
      expect(mockSignSafeTxWithTrezor).not.toHaveBeenCalled();
    });

    it('returns 400 when typedData does not hash to the provided hashes', async () => {
      const res = await POST(
        createRequest({
          device: 'trezor',
          domainHash,
          messageHash,
          typedData: { ...typedData, message: { ...typedData.message, nonce: '8' } },
        })
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/does not hash/i);
      expect(mockSignSafeTxWithTrezor).not.toHaveBeenCalled();
    });

    it('accepts the maximum uint256 value', async () => {
      const maxTyped: SafeTxTypedData = {
        ...typedData,
        message: { ...typedData.message, value: maxUint256.toString() },
      };
      const hashes = hashSafeTxTypedData(maxTyped);
      const res = await POST(createRequest({ device: 'trezor', ...hashes, typedData: maxTyped }));
      expect(res.status).toBe(200);
    });

    it('returns 400 when a uint256 field overflows', async () => {
      const res = await POST(
        createRequest({
          device: 'trezor',
          domainHash,
          messageHash,
          typedData: {
            ...typedData,
            message: { ...typedData.message, value: (maxUint256 + BigInt(1)).toString() },
          },
        })
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/uint256/);
      expect(mockSignSafeTxWithTrezor).not.toHaveBeenCalled();
    });

    it('returns 500 with the install error when trezorctl is unavailable', async () => {
      mockEnsureTrezorctl.mockResolvedValue('trezorctl not found. Install mise');
      const res = await POST(
        createRequest({ device: 'trezor', domainHash, messageHash, typedData })
      );
      expect(res.status).toBe(500);
      expect((await res.json()).error).toMatch(/trezorctl not found/i);
    });

    it('returns 400 for an unknown device', async () => {
      const res = await POST(createRequest({ device: 'keystone', domainHash, messageHash }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/invalid device/i);
    });
  });
});
