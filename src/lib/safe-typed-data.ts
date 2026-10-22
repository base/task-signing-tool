import {
  decodeAbiParameters,
  getAddress,
  hashDomain,
  hashStruct,
  maxUint256,
  type Hex,
  type TypedData,
} from 'viem';
import { z } from 'zod';

// Trezor Core devices (Model T, Safe 3/5) cannot blind-sign a domain/message hash pair;
// they need the full EIP-712 typed data. This module turns the SafeTx emitted by the task
// simulation into typed data and refuses to return anything whose hashes differ from the
// hashes the signer validated.

const AddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'must be a 0x-prefixed address');
const UintSchema = z
  .string()
  .regex(/^\d+$/, 'must be a decimal integer string')
  // zod keeps running refinements after a failed regex, so guard BigInt() against non-digits.
  .refine(v => !/^\d+$/.test(v) || BigInt(v) <= maxUint256, 'must fit in uint256');

export const SafeTxTypedDataSchema = z
  .object({
    domain: z
      .object({
        // Omitted for Safe < 1.3.0, whose domain only contains verifyingContract.
        chainId: UintSchema.optional(),
        verifyingContract: AddressSchema,
      })
      .strict(),
    message: z
      .object({
        to: AddressSchema,
        value: UintSchema,
        data: z.string().regex(/^0x([a-fA-F0-9]{2})*$/, 'must be 0x-prefixed hex bytes'),
        operation: z.union([z.literal(0), z.literal(1)]),
        safeTxGas: UintSchema,
        baseGas: UintSchema,
        gasPrice: UintSchema,
        gasToken: AddressSchema,
        refundReceiver: AddressSchema,
        nonce: UintSchema,
      })
      .strict(),
  })
  .strict();

export type SafeTxTypedData = z.infer<typeof SafeTxTypedDataSchema>;

const SAFE_TX_TYPE = [
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

function domainType(typedData: SafeTxTypedData) {
  return typedData.domain.chainId === undefined
    ? [{ name: 'verifyingContract', type: 'address' }]
    : [
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ];
}

const toHexUint = (v: string) => `0x${BigInt(v).toString(16)}`;

/**
 * Full eth_signTypedData_v4 JSON, as consumed by `eip712sign --trezor --data`.
 *
 * Integers are sent as 0x-hex strings: base/usbwallet encodes every integer string for the device
 * with `common.FromHex`, so a decimal string such as "560048" would reach the Trezor as 0x560048.
 * go-ethereum (which computes the expected hash) reads hex strings the same way.
 */
export function toEip712Json(typedData: SafeTxTypedData) {
  const { domain, message } = typedData;
  return {
    types: { EIP712Domain: domainType(typedData), SafeTx: SAFE_TX_TYPE },
    primaryType: 'SafeTx',
    domain: {
      ...(domain.chainId === undefined ? {} : { chainId: toHexUint(domain.chainId) }),
      verifyingContract: domain.verifyingContract,
    },
    message: {
      ...message,
      value: toHexUint(message.value),
      safeTxGas: toHexUint(message.safeTxGas),
      baseGas: toHexUint(message.baseGas),
      gasPrice: toHexUint(message.gasPrice),
      nonce: toHexUint(message.nonce),
    },
  };
}

export function hashSafeTxTypedData(typedData: SafeTxTypedData): {
  domainHash: Hex;
  messageHash: Hex;
} {
  const { domain, message } = typedData;
  // Widened to TypedData: the domain shape is only known at runtime (legacy vs >= 1.3.0).
  const types: TypedData = { EIP712Domain: domainType(typedData), SafeTx: SAFE_TX_TYPE };
  const domainHash = hashDomain({
    domain: {
      ...(domain.chainId === undefined ? {} : { chainId: BigInt(domain.chainId) }),
      verifyingContract: domain.verifyingContract as Hex,
    },
    types,
  });
  const messageHash = hashStruct({
    primaryType: 'SafeTx',
    types,
    data: {
      ...message,
      value: BigInt(message.value),
      safeTxGas: BigInt(message.safeTxGas),
      baseGas: BigInt(message.baseGas),
      gasPrice: BigInt(message.gasPrice),
      nonce: BigInt(message.nonce),
    },
  });
  return { domainHash, messageHash };
}

export function safeTxTypedDataMatches(
  typedData: SafeTxTypedData,
  expected: { domainHash: string; messageHash: string }
): boolean {
  const actual = hashSafeTxTypedData(typedData);
  return (
    actual.domainHash.toLowerCase() === expected.domainHash.toLowerCase() &&
    actual.messageHash.toLowerCase() === expected.messageHash.toLowerCase()
  );
}

/**
 * Decodes the `safeTx` field of stateDiff.json (hex-encoded `abi.encode(SafeTx)` struct) and
 * builds typed data for `safe` on `chainId`. Tries the Safe >= 1.3.0 domain first, then the
 * legacy domain. Throws unless the result hashes to the given domain/message hashes.
 */
export function buildSafeTxTypedData(params: {
  encodedSafeTx: string;
  safe: string;
  chainId: string;
  domainHash: string;
  messageHash: string;
}): SafeTxTypedData {
  const [tx] = decodeAbiParameters(
    [{ type: 'tuple', components: SAFE_TX_TYPE.map(f => ({ ...f })) }],
    params.encodedSafeTx as Hex
  );

  const message: SafeTxTypedData['message'] = {
    to: getAddress(tx.to),
    value: tx.value.toString(),
    data: tx.data,
    operation: tx.operation === 1 ? 1 : 0,
    safeTxGas: tx.safeTxGas.toString(),
    baseGas: tx.baseGas.toString(),
    gasPrice: tx.gasPrice.toString(),
    gasToken: getAddress(tx.gasToken),
    refundReceiver: getAddress(tx.refundReceiver),
    nonce: tx.nonce.toString(),
  };
  if (tx.operation > 1) {
    throw new Error(`SafeTx operation must be 0 or 1, got ${tx.operation}`);
  }

  const verifyingContract = getAddress(params.safe);
  const candidates: SafeTxTypedData[] = [
    { domain: { chainId: params.chainId, verifyingContract }, message },
    { domain: { verifyingContract }, message },
  ];
  const match = candidates.find(c => safeTxTypedDataMatches(c, params));
  if (!match) {
    throw new Error(
      'SafeTx emitted by the task simulation does not hash to the domain/message hashes being signed'
    );
  }
  return match;
}
