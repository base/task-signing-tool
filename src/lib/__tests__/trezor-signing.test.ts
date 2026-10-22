import { jest, describe, it, expect, beforeEach } from '@jest/globals';
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

const mockExecFile = jest.fn((_cmd: string, args: string[], _opts: unknown, cb: ExecCallback) => {
  lastArgs = args;
  setImmediate(() => cb(nextResult.error, nextResult.stdout, nextResult.stderr));
  return { stdin: { end: jest.fn() } };
});

jest.unstable_mockModule('child_process', () => ({ execFile: mockExecFile }));

const { signSafeTxWithTrezor, mapTrezorError } = await import('../trezor-signing');
const { hashSafeTxTypedData, toEip712Json } = await import('../safe-typed-data');

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

/** stdout shaped like eip712sign v0.0.15 after a successful typed-data signature. */
function eip712signOutput(o: { data: string; signer: string; signature: string }): string {
  return [
    `Domain hash: 0x${o.data.slice(6, 70)}`,
    `Message hash: 0x${o.data.slice(70)}`,
    `Signing as: ${o.signer}`,
    '',
    'Data sent to device, awaiting signature...done',
    '',
    'Typed: 0x7b7d',
    `Data: ${o.data}`,
    `Signer: ${o.signer}`,
    `Signature: ${o.signature}`,
    '',
  ].join('\n');
}

describe('signSafeTxWithTrezor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('signs the full typed data with eip712sign --trezor', async () => {
    const { data, signature } = await deviceSignature();
    nextResult = {
      error: null,
      stdout: eip712signOutput({ data, signer: account.address, signature: signature.slice(2) }),
      stderr: '',
    };

    const res = await signSafeTxWithTrezor({ typedData, accountIndex: 3 });

    expect(res).toEqual({
      success: true,
      data,
      signer: account.address,
      signature: signature.slice(2),
    });
    expect(lastArgs.slice(0, 4)).toEqual(['--trezor', '--hd-paths', "m/44'/60'/3'/0/0", '--data']);
    expect(JSON.parse(lastArgs[4])).toEqual(toEip712Json(typedData));
  });

  it('normalizes device v = 0/1 to 27/28', async () => {
    const { data, signature } = await deviceSignature();
    const v = signature.slice(-2) === '1b' ? '00' : '01';
    nextResult = {
      error: null,
      stdout: eip712signOutput({
        data,
        signer: account.address,
        signature: signature.slice(2, -2) + v,
      }),
      stderr: '',
    };
    const res = await signSafeTxWithTrezor({ typedData });
    expect(res).toMatchObject({ success: true, signature: signature.slice(2) });
  });

  it('rejects a signature that does not recover to the reported signer', async () => {
    const { data, signature } = await deviceSignature();
    nextResult = {
      error: null,
      stdout: eip712signOutput({
        data,
        signer: '0x' + '2'.repeat(40),
        signature: signature.slice(2),
      }),
      stderr: '',
    };
    const res = await signSafeTxWithTrezor({ typedData });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/recovers to/);
  });

  it('rejects output for different hashes than the validated ones', async () => {
    const { signature } = await deviceSignature();
    nextResult = {
      error: null,
      stdout: eip712signOutput({
        data: '0x1901' + 'ab'.repeat(64),
        signer: account.address,
        signature: signature.slice(2),
      }),
      stderr: '',
    };
    const res = await signSafeTxWithTrezor({ typedData });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/eip712sign signed .* expected/);
  });

  it('fails on unparseable output', async () => {
    nextResult = { error: null, stdout: 'Signer: 0xabc', stderr: '' };
    const res = await signSafeTxWithTrezor({ typedData });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Could not extract signature/);
  });

  it('maps device errors', async () => {
    nextResult = {
      error: new Error('exit 1'),
      stdout: '',
      stderr: '2026/10/21 10:00:00 Error signing data: trezor: Action cancelled by user',
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

describe('mapTrezorError', () => {
  it.each([
    ['flag provided but not defined: -trezor', /eip712sign is too old.*v0\.0\.15/],
    ['trezor: typed data signing requires firmware v2.9.1 or newer', /firmware 2\.9\.1/],
    [
      'Error creating signer: no hardware wallets found, please connect your device',
      /No Trezor found/,
    ],
    ['spawn eip712sign ENOENT', /eip712sign not found/],
    ['LIBUSB_ERROR_ACCESS', /Close Trezor Suite/],
    ['Error signing data: trezor: Message hash mismatch', /different message hash.*Do not retry/],
    [
      'error opening device: trezor: expected reply types [Success], got Features',
      /Unplug and reconnect/,
    ],
    ['something else', /something else/],
  ])('%s', (stderr, expected) => {
    expect(mapTrezorError(stderr)).toMatch(expected);
  });
});
