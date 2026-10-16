import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { readFileSync } from 'fs';
import { keccak256, serializeSignature, type Hex } from 'viem';
import { privateKeyToAccount, sign } from 'viem/accounts';
import type { SafeTxTypedData } from '../safe-typed-data';

type ExecCallback = (
  error: (Error & { killed?: boolean }) | null,
  stdout: string,
  stderr: string
) => void;

let nextResult: { error: (Error & { killed?: boolean }) | null; stdout: string; stderr: string };
let lastArgs: string[] = [];
let lastTypedDataJson: unknown;

const mockExecFile = jest.fn((_cmd: string, args: string[], _opts: unknown, cb: ExecCallback) => {
  lastArgs = args;
  const file = args[args.length - 1];
  if (file.endsWith('.json')) lastTypedDataJson = JSON.parse(readFileSync(file, 'utf8'));
  setImmediate(() => cb(nextResult.error, nextResult.stdout, nextResult.stderr));
  return { stdin: { end: jest.fn() } };
});

jest.unstable_mockModule('child_process', () => ({ execFile: mockExecFile }));

const { signSafeTxWithTrezor, mapTrezorError, checkTrezorctlAvailability } =
  await import('../trezor-signing');
const { hashSafeTxTypedData } = await import('../safe-typed-data');

const PRIVATE_KEY = ('0x' + '11'.repeat(32)) as Hex;
const account = privateKeyToAccount(PRIVATE_KEY);
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

async function deviceSignature(): Promise<{ data: Hex; signature: Hex }> {
  const { domainHash, messageHash } = hashSafeTxTypedData(typedData);
  const data = `0x1901${domainHash.slice(2)}${messageHash.slice(2)}` as Hex;
  const signature = serializeSignature(
    await sign({ hash: keccak256(data), privateKey: PRIVATE_KEY })
  );
  return { data, signature };
}

describe('signSafeTxWithTrezor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    lastTypedDataJson = undefined;
  });

  it('signs via trezorctl and returns eip712sign-compatible output', async () => {
    const { data, signature } = await deviceSignature();
    nextResult = {
      error: null,
      stdout: JSON.stringify({ address: account.address, signature }),
      stderr: '',
    };

    const res = await signSafeTxWithTrezor({ typedData, accountIndex: 3 });

    expect(res).toEqual({
      success: true,
      data,
      signer: account.address,
      signature: signature.slice(2),
    });
    expect(lastArgs.slice(0, 5)).toEqual([
      '--json',
      'ethereum',
      'sign-typed-data',
      '-n',
      "m/44'/60'/3'/0/0",
    ]);
    expect(lastTypedDataJson).toMatchObject({
      primaryType: 'SafeTx',
      domain: typedData.domain,
      message: typedData.message,
    });
  });

  it('rejects a signature that does not recover to the reported address', async () => {
    const { signature } = await deviceSignature();
    nextResult = {
      error: null,
      stdout: JSON.stringify({ address: '0x' + '2'.repeat(40), signature }),
      stderr: '',
    };
    const res = await signSafeTxWithTrezor({ typedData });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/recovers to/);
  });

  it('fails on unparseable output', async () => {
    nextResult = { error: null, stdout: 'address: 0xabc', stderr: '' };
    const res = await signSafeTxWithTrezor({ typedData });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Could not parse trezorctl output/);
  });

  it('maps device errors', async () => {
    nextResult = {
      error: new Error('exit 1'),
      stdout: '',
      stderr: 'Error: Action cancelled by user',
    };
    const res = await signSafeTxWithTrezor({ typedData });
    expect(res).toEqual({ success: false, error: 'Signing was cancelled on the Trezor device' });
  });

  it('reports timeouts', async () => {
    const err = Object.assign(new Error('killed'), { killed: true });
    nextResult = { error: err, stdout: '', stderr: '' };
    const res = await signSafeTxWithTrezor({ typedData });
    expect(res.error).toMatch(/Timed out/);
  });
});

describe('checkTrezorctlAvailability', () => {
  it('returns false when trezorctl fails', async () => {
    nextResult = { error: new Error('spawn trezorctl ENOENT'), stdout: '', stderr: '' };
    expect(await checkTrezorctlAvailability()).toBe(false);
  });
});

describe('mapTrezorError', () => {
  it.each([
    ['spawn trezorctl ENOENT', /trezorctl not found/],
    ['No Trezor found', /No Trezor found/],
    ['LIBUSB_ERROR_ACCESS', /Close Trezor Suite/],
    ['Aborted!', /passphrase/],
    ['Failure_UnexpectedMessage', /firmware/],
    ['something else', /something else/],
  ])('%s', (stderr, expected) => {
    expect(mapTrezorError(stderr)).toMatch(expected);
  });
});
