import { describe, expect, it } from '@jest/globals';
import { encodeAbiParameters, keccak256, type Hex } from 'viem';
import {
  buildSafeTxTypedData,
  hashSafeTxTypedData,
  SafeTxTypedDataSchema,
  safeTxTypedDataMatches,
  toEip712Json,
  type SafeTxTypedData,
} from '../safe-typed-data';

// Constants from Safe's contracts, so hashes are checked independently of viem's EIP-712 code.
const DOMAIN_SEPARATOR_TYPEHASH =
  '0x47e79534a245952e8b16893a336b85a3d9ea9fa8c573f3d803afb92a79469218'; // Safe >= 1.3.0
const LEGACY_DOMAIN_SEPARATOR_TYPEHASH =
  '0x035aff83d86937d35b32e04f0ddc6ff469290eef2f1b692d8a815c89404d4749'; // Safe < 1.3.0
const SAFE_TX_TYPEHASH = '0xbb8310d486368db6bd6f849402fdd73ad53d316b5a4b2644ad6efe0f941286d8';

const SAFE = '0x9855054731540A48b28990B63DcF4f33d8AE46A1';
const ZERO = '0x0000000000000000000000000000000000000000';

const tx = {
  to: '0xcA11bde05977b3631167028862bE2a173976CA11',
  value: BigInt(0),
  data: '0x174dea71000000000000000000000000000000000000000000000000000000000000002a' as Hex,
  operation: 1,
  safeTxGas: BigInt(0),
  baseGas: BigInt(0),
  gasPrice: BigInt(0),
  gasToken: ZERO,
  refundReceiver: ZERO,
  nonce: BigInt(42),
} as const;

const SAFE_TX_COMPONENTS = [
  { name: 'to', type: 'address' },
  { name: 'value', type: 'uint256' },
  { name: 'data', type: 'bytes' },
  { name: 'operation', type: 'uint8' },
  { name: 'safeTxGas', type: 'uint256' },
  { name: 'baseGas', type: 'uint256' },
  { name: 'gasPrice', type: 'uint256' },
  { name: 'gasToken', type: 'address' },
  { name: 'refundReceiver', type: 'address' },
  { name: 'nonce', type: 'uint256' },
] as const;

const encodedSafeTx = encodeAbiParameters(
  [{ type: 'tuple', components: SAFE_TX_COMPONENTS }],
  [tx]
);

const domainHash = keccak256(
  encodeAbiParameters(
    [{ type: 'bytes32' }, { type: 'uint256' }, { type: 'address' }],
    [DOMAIN_SEPARATOR_TYPEHASH, BigInt(8453), SAFE]
  )
);
const legacyDomainHash = keccak256(
  encodeAbiParameters(
    [{ type: 'bytes32' }, { type: 'address' }],
    [LEGACY_DOMAIN_SEPARATOR_TYPEHASH, SAFE]
  )
);
const messageHash = keccak256(
  encodeAbiParameters(
    [
      { type: 'bytes32' },
      { type: 'address' },
      { type: 'uint256' },
      { type: 'bytes32' },
      { type: 'uint8' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'address' },
      { type: 'address' },
      { type: 'uint256' },
    ],
    [
      SAFE_TX_TYPEHASH,
      tx.to,
      tx.value,
      keccak256(tx.data),
      tx.operation,
      tx.safeTxGas,
      tx.baseGas,
      tx.gasPrice,
      tx.gasToken,
      tx.refundReceiver,
      tx.nonce,
    ]
  )
);

describe('buildSafeTxTypedData', () => {
  it('builds Safe >= 1.3.0 typed data matching the on-chain hashes', () => {
    const typed = buildSafeTxTypedData({
      encodedSafeTx,
      safe: SAFE.toLowerCase(),
      chainId: '8453',
      domainHash,
      messageHash,
    });
    expect(typed.domain).toEqual({ chainId: '8453', verifyingContract: SAFE });
    expect(typed.message).toMatchObject({ operation: 1, nonce: '42', value: '0' });
    expect(hashSafeTxTypedData(typed)).toEqual({ domainHash, messageHash });
    expect(SafeTxTypedDataSchema.safeParse(typed).success).toBe(true);
  });

  it('falls back to the legacy (no chainId) domain', () => {
    const typed = buildSafeTxTypedData({
      encodedSafeTx,
      safe: SAFE,
      chainId: '8453',
      domainHash: legacyDomainHash,
      messageHash,
    });
    expect(typed.domain).toEqual({ verifyingContract: SAFE });
    expect(toEip712Json(typed).types.EIP712Domain).toEqual([
      { name: 'verifyingContract', type: 'address' },
    ]);
  });

  it('throws when the SafeTx does not hash to the signed hashes', () => {
    expect(() =>
      buildSafeTxTypedData({
        encodedSafeTx,
        safe: SAFE,
        chainId: '1',
        domainHash,
        messageHash,
      })
    ).toThrow(/does not hash/);
  });
});

describe('safeTxTypedDataMatches', () => {
  const typed: SafeTxTypedData = buildSafeTxTypedData({
    encodedSafeTx,
    safe: SAFE,
    chainId: '8453',
    domainHash,
    messageHash,
  });

  it('accepts case-insensitive hash matches', () => {
    expect(
      safeTxTypedDataMatches(typed, {
        domainHash: domainHash.toUpperCase().replace('0X', '0x'),
        messageHash,
      })
    ).toBe(true);
  });

  it('rejects a tampered field', () => {
    const tampered = { ...typed, message: { ...typed.message, nonce: '43' } };
    expect(safeTxTypedDataMatches(tampered, { domainHash, messageHash })).toBe(false);
  });
});

describe('toEip712Json', () => {
  it('emits the SafeTx primary type with chainId domain', () => {
    const typed = buildSafeTxTypedData({
      encodedSafeTx,
      safe: SAFE,
      chainId: '8453',
      domainHash,
      messageHash,
    });
    const json = toEip712Json(typed);
    expect(json.primaryType).toBe('SafeTx');
    expect(json.types.EIP712Domain.map(f => f.name)).toEqual(['chainId', 'verifyingContract']);
    expect(json.types.SafeTx.map(f => f.name)).toEqual(SAFE_TX_COMPONENTS.map(f => f.name));
  });

  // base/usbwallet reads integer strings as hex (common.FromHex), so decimal strings would reach
  // the Trezor with the wrong values ("560048" -> 0x560048) and fail with "Message hash mismatch".
  it('encodes integers as 0x-hex strings that parse back to the validated values', () => {
    const typed = buildSafeTxTypedData({
      encodedSafeTx,
      safe: SAFE,
      chainId: '8453',
      domainHash,
      messageHash,
    });
    const { domain, message } = toEip712Json(typed);
    expect(domain.chainId).toBe('0x2105');
    for (const field of ['value', 'safeTxGas', 'baseGas', 'gasPrice', 'nonce'] as const) {
      expect(message[field]).toMatch(/^0x[0-9a-f]+$/);
      expect(BigInt(message[field]).toString()).toBe(typed.message[field]);
    }
    expect(message.operation).toBe(typed.message.operation);
    expect(message.data).toBe(typed.message.data);
  });
});
